-- Forward migration for NEXUS notifications and coordination review repair.
-- Safe to apply over existing migrations 0001, 0002, and 0003.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  notification_type text not null check (notification_type in (
    'coordination_available',
    'coordination_reviewed',
    'access_updated',
    'operational_alert'
  )),
  title text not null,
  message text not null,
  entity_type text,
  entity_id text,
  destination_path text not null default '/',
  created_at timestamptz not null default now(),
  read_at timestamptz,
  dedupe_key text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists notifications_recipient_created_idx
  on public.notifications(recipient_id, created_at desc);

create index if not exists notifications_recipient_unread_idx
  on public.notifications(recipient_id, read_at)
  where read_at is null;

create unique index if not exists notifications_recipient_dedupe_idx
  on public.notifications(recipient_id, dedupe_key)
  where dedupe_key is not null;

alter table public.notifications enable row level security;

drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications
  for select to authenticated
  using (recipient_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

grant select on public.notifications to authenticated;

-- Trusted helper to mark a notification as read
create or replace function public.mark_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id
    and recipient_id = auth.uid();
end;
$$;

-- Trusted helper to mark all notifications as read for current user
create or replace function public.mark_all_notifications_read()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.notifications
  set read_at = now()
  where recipient_id = auth.uid()
    and read_at is null;
end;
$$;

grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
revoke all on function public.mark_notification_read(uuid) from public, anon;
revoke all on function public.mark_all_notifications_read() from public, anon;

-- Function to notify authorized users when a coordination review decision is recorded
create or replace function public.notify_coordination_review(
  p_item_id uuid,
  p_decision text,
  p_reviewer_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_institution_name text := 'Institution';
  v_reviewer_name text := 'An officer';
  v_title text;
  v_message text;
  v_target_profile record;
  v_destination text := '/coordination?item=' || p_item_id::text;
begin
  select ci.*, i.name as inst_name
  into v_item
  from public.coordination_items ci
  left join public.institutions i on i.id = ci.institution_id
  where ci.id = p_item_id;

  if not found then
    return;
  end if;

  if v_item.inst_name is not null then
    v_institution_name := v_item.inst_name;
  end if;

  select coalesce(display_name, email, 'An officer')
  into v_reviewer_name
  from public.profiles
  where id = p_reviewer_id;

  v_title := 'Coordination Review Recorded';
  v_message := v_reviewer_name || ' recorded a decision (' || replace(p_decision, '_', ' ') || ') for ' || v_institution_name || '.';

  for v_target_profile in
    select p.id
    from public.profiles p
    where p.approval_status = 'approved'
      and p.role in ('administrator', 'bureau_officer', 'regional_officer')
      and p.id <> p_reviewer_id
  loop
    -- Check that target user has permission to view this item (no leakage of restricted cases)
    if exists (
      select 1
      where p_reviewer_id = v_target_profile.id
         or (
           select coalesce(public.nexus_role() = 'administrator', false)
           from (select p_decision) d
         )
         or not exists (
           select 1
           from public.coordination_item_cases cic
           join public.source_cases sc on sc.id = cic.source_case_id
           where cic.coordination_item_id = p_item_id
             and sc.restricted
         )
    ) then
      insert into public.notifications (
        recipient_id,
        notification_type,
        title,
        message,
        entity_type,
        entity_id,
        destination_path,
        dedupe_key
      ) values (
        v_target_profile.id,
        'coordination_reviewed',
        v_title,
        v_message,
        'coordination_item',
        p_item_id::text,
        v_destination,
        'coord_rev_' || p_item_id::text || '_' || v_target_profile.id::text
      )
      on conflict (recipient_id, dedupe_key) do nothing;
    end if;
  end loop;
end;
$$;

-- Forward fix for submit_coordination_review with repaired SQL syntax & review notification
create or replace function public.submit_coordination_review(
  p_item_id uuid,
  p_decision text,
  p_rationale text,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.coordination_items%rowtype;
  v_role text;
  v_reviewer text;
  v_reviewed_at timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.is_nexus_approved() then
    raise exception 'An approved account is required' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_rationale, ''))) < 12 then
    raise exception 'A review rationale of at least 12 characters is required' using errcode = '22023';
  end if;
  if p_decision not in (
    'confirmed_same_matter',
    'related_but_distinct',
    'legitimate_procedural_progression',
    'potential_parallel_action',
    'insufficient_evidence',
    'dismissed_suggestion'
  ) then
    raise exception 'Unsupported review decision' using errcode = '22023';
  end if;

  v_role := public.nexus_role();
  if v_role not in ('administrator', 'bureau_officer', 'regional_officer') then
    raise exception 'This role cannot review coordination items' using errcode = '42501';
  end if;

  select * into v_item
  from public.coordination_items
  where id = p_item_id
  for update;
  if not found then
    raise exception 'Coordination item not found' using errcode = 'P0002';
  end if;
  if v_item.updated_at is distinct from p_expected_updated_at then
    raise exception 'Coordination item changed; refresh before reviewing' using errcode = '40001';
  end if;
  if v_item.review_status <> 'open' then
    raise exception 'Coordination item has already been reviewed' using errcode = '40001';
  end if;
  if not public.can_view_coordination_item(p_item_id) then
    raise exception 'You cannot review this item' using errcode = '42501';
  end if;
  if v_role = 'regional_officer' and not exists (
    select 1
    from public.coordination_item_cases cic
    join public.source_cases sc on sc.id = cic.source_case_id
    join public.institutions i on i.id = sc.institution_id
    join public.profiles p on p.id = auth.uid()
    where cic.coordination_item_id = p_item_id
      and i.region = p.region
  ) then
    raise exception 'This item is outside your assigned region' using errcode = '42501';
  end if;

  select coalesce(display_name, email, 'Officer')
  into v_reviewer
  from public.profiles
  where id = auth.uid();

  insert into public.coordination_reviews (
    coordination_item_id, reviewer_profile_id, decision, rationale, reviewed_at
  ) values (
    p_item_id, auth.uid(), p_decision, trim(p_rationale), v_reviewed_at
  );

  update public.coordination_items
  set review_status = case when p_decision = 'dismissed_suggestion' then 'dismissed' else 'reviewed' end,
      review_decision = p_decision,
      assigned_reviewer_id = auth.uid(),
      rationale = trim(p_rationale),
      updated_at = v_reviewed_at
  where id = p_item_id;

  -- A human decision is stored as a non-authoritative NEXUS relationship.
  -- It never rewrites source cases, source actions, or bureau records.
  if p_decision in ('confirmed_same_matter', 'related_but_distinct') then
    insert into public.case_relationships (
      source_case_id, related_case_id, relationship_type, provenance, is_authoritative
    )
    select left_case.source_case_id,
           right_case.source_case_id,
           p_decision,
           'human_review',
           false
    from public.coordination_item_cases left_case
    join public.coordination_item_cases right_case
      on right_case.coordination_item_id = left_case.coordination_item_id
     and right_case.source_case_id > left_case.source_case_id
     where left_case.coordination_item_id = p_item_id
     on conflict (source_case_id, related_case_id, relationship_type, provenance)
     do nothing;
  end if;

  insert into public.audit_events (actor_profile_id, action, target, details)
  values (
    auth.uid(),
    'coordination_review_recorded',
    p_item_id::text,
    jsonb_build_object('decision', p_decision, 'rationale', trim(p_rationale))
  );

  -- Trigger notifications for authorized peers
  perform public.notify_coordination_review(p_item_id, p_decision, auth.uid());

  return jsonb_build_object(
    'decision', p_decision,
    'rationale', trim(p_rationale),
    'reviewer', coalesce(v_reviewer, 'Officer'),
    'reviewed_at', v_reviewed_at
  );
end;
$$;

-- Forward update to admin_update_profile_role to notify user of access change
create or replace function public.admin_update_profile_role(
  p_user_id uuid,
  p_role text,
  p_approval_status text,
  p_region text default null,
  p_bureau text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is null or not public.is_nexus_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_role is null or p_role not in ('administrator', 'bureau_officer', 'regional_officer', 'read_only_viewer') then
    raise exception 'Unsupported role' using errcode = '22023';
  end if;
  if p_approval_status is null or p_approval_status not in ('pending', 'approved', 'suspended') then
    raise exception 'Unsupported approval status' using errcode = '22023';
  end if;
  if p_bureau is not null and p_bureau not in ('RB', 'PGRC') then
    raise exception 'Unsupported bureau' using errcode = '22023';
  end if;
  if p_role = 'regional_officer' and nullif(trim(coalesce(p_region, '')), '') is null then
    raise exception 'Regional officers require an assigned region' using errcode = '22023';
  end if;
  if p_role = 'bureau_officer' and p_bureau is null then
    raise exception 'Bureau officers require an assigned bureau' using errcode = '22023';
  end if;

  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'User profile not found' using errcode = 'P0002';
  end if;

  if v_profile.role = 'administrator'
     and v_profile.approval_status = 'approved'
     and (p_role <> 'administrator' or p_approval_status <> 'approved')
     and (
       select count(*) from public.profiles
       where role = 'administrator' and approval_status = 'approved'
     ) <= 1 then
    raise exception 'At least one approved administrator must remain' using errcode = '23514';
  end if;

  update public.profiles
  set role = p_role,
      approval_status = p_approval_status,
      region = nullif(trim(coalesce(p_region, '')), ''),
      bureau = p_bureau,
      updated_at = now()
  where id = p_user_id
  returning * into v_profile;

  insert into public.audit_events (actor_profile_id, action, target, details)
  values (
    auth.uid(),
    'profile_access_updated',
    p_user_id::text,
    jsonb_build_object(
      'role', p_role,
      'approval_status', p_approval_status,
      'region', v_profile.region,
      'bureau', v_profile.bureau
    )
  );

  -- Notify the updated user about their access assignment change
  insert into public.notifications (
    recipient_id,
    notification_type,
    title,
    message,
    entity_type,
    entity_id,
    destination_path,
    dedupe_key
  ) values (
    p_user_id,
    'access_updated',
    'Account Access Updated',
    'Your role was updated to ' || replace(p_role, '_', ' ') || ' (Approval: ' || p_approval_status || ').',
    'profile',
    p_user_id::text,
    '/administration',
    'access_update_' || p_user_id::text || '_' || extract(epoch from now())::bigint::text
  )
  on conflict (recipient_id, dedupe_key) do nothing;

  return jsonb_build_object(
    'id', v_profile.id,
    'display_name', v_profile.display_name,
    'email', v_profile.email,
    'role', v_profile.role,
    'approval_status', v_profile.approval_status,
    'region', v_profile.region,
    'bureau', v_profile.bureau
  );
end;
$$;

-- Trigger to notify approved officers when a new coordination item is created
create or replace function public.on_coordination_item_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst_name text := 'Institution';
  v_rec record;
begin
  select name into v_inst_name
  from public.institutions
  where id = new.institution_id;

  for v_rec in
    select id
    from public.profiles
    where approval_status = 'approved'
      and role in ('administrator', 'bureau_officer')
  loop
    insert into public.notifications (
      recipient_id,
      notification_type,
      title,
      message,
      entity_type,
      entity_id,
      destination_path,
      dedupe_key
    ) values (
      v_rec.id,
      'coordination_available',
      'Coordination Item Awaiting Review',
      'A cross-bureau candidate matter for ' || coalesce(v_inst_name, 'unresolved institution') || ' requires review.',
      'coordination_item',
      new.id::text,
      '/coordination?item=' || new.id::text,
      'coord_item_' || new.id::text || '_' || v_rec.id::text
    )
    on conflict (recipient_id, dedupe_key) do nothing;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_notify_new_coordination_item on public.coordination_items;
create trigger trg_notify_new_coordination_item
  after insert on public.coordination_items
  for each row
  execute function public.on_coordination_item_created();

-- Periodic or on-demand operational alert generator (idempotent with daily stable dedupe keys)
create or replace function public.generate_operational_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_today text := to_char(now(), 'YYYY-MM-DD');
  v_admin record;
  v_case record;
  v_source record;
begin
  if auth.uid() is null or not public.is_nexus_approved() then
    return 0;
  end if;

  -- 1. Overdue source cases check
  for v_case in
    select sc.id, sc.source_case_id, sc.current_bureau, sc.expected_disposal_at,
           coalesce(i.name, sc.source_institution_name, 'Institution') as inst_name
    from public.source_cases sc
    left join public.institutions i on i.id = sc.institution_id
    where sc.status not in ('disposed', 'transferred')
      and sc.expected_disposal_at is not null
      and sc.expected_disposal_at < now()
  loop
    for v_admin in
      select p.id
      from public.profiles p
      where p.approval_status = 'approved'
        and (
          p.role = 'administrator'
          or (p.role = 'bureau_officer' and p.bureau = v_case.current_bureau)
        )
    loop
      insert into public.notifications (
        recipient_id,
        notification_type,
        title,
        message,
        entity_type,
        entity_id,
        destination_path,
        dedupe_key
      ) values (
        v_admin.id,
        'operational_alert',
        'Overdue Case: ' || v_case.source_case_id,
        'Expected disposal date passed on ' || to_char(v_case.expected_disposal_at, 'DD Mon YYYY') || ' (' || v_case.inst_name || ').',
        'case',
        v_case.id::text,
        '/complaints/' || v_case.id::text,
        'overdue_' || v_case.id::text || '_' || v_today || '_' || v_admin.id::text
      )
      on conflict (recipient_id, dedupe_key) do nothing;
      if found then
        v_count := v_count + 1;
      end if;
    end loop;
  end loop;

  -- 2. Stale or disconnected source check
  for v_source in
    select ds.id, ds.code, ds.name, ds.connection_state, ds.last_successful_sync
    from public.data_sources ds
    where ds.connection_state = 'disconnected'
       or (ds.last_successful_sync is not null and ds.last_successful_sync < now() - interval '30 days')
  loop
    for v_admin in
      select p.id
      from public.profiles p
      where p.approval_status = 'approved' and p.role = 'administrator'
    loop
      insert into public.notifications (
        recipient_id,
        notification_type,
        title,
        message,
        entity_type,
        entity_id,
        destination_path,
        dedupe_key
      ) values (
        v_admin.id,
        'operational_alert',
        'Source System Alert: ' || v_source.code,
        'Source ' || v_source.name || ' is ' || v_source.connection_state || ' or has stale observations.',
        'data_source',
        v_source.id::text,
        '/reliability',
        'source_alert_' || v_source.id::text || '_' || v_today || '_' || v_admin.id::text
      )
      on conflict (recipient_id, dedupe_key) do nothing;
      if found then
        v_count := v_count + 1;
      end if;
    end loop;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.generate_operational_alerts() to authenticated;
revoke all on function public.generate_operational_alerts() from public, anon;

-- Attempt to enable Supabase Realtime for notifications if publication exists
do $$
begin
  execute 'alter publication supabase_realtime add table public.notifications';
exception
  when undefined_object then
    null;
  when others then
    null;
end;
$$;
