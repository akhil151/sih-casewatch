-- NEXUS prototype schema. Run in the Supabase SQL Editor or with the Supabase CLI.
-- Source records are read-only in the application; NEXUS stores provenance and review decisions separately.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text not null default '',
  role text not null default 'read_only_viewer'
    check (role in ('administrator', 'bureau_officer', 'regional_officer', 'read_only_viewer')),
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'suspended')),
  region text,
  bureau text check (bureau is null or bureau in ('RB', 'PGRC')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  aicte_permanent_id text unique,
  name text not null,
  address text,
  state text not null,
  region text not null,
  identity_state text not null default 'unresolved'
    check (identity_state in ('verified', 'candidate', 'unresolved')),
  source_labels text[] not null default '{}',
  synthetic boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.institution_aliases (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  alias text not null,
  source_label text,
  created_at timestamptz not null default now(),
  unique (institution_id, alias)
);

create table if not exists public.data_sources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('RB', 'PGRC')),
  name text not null,
  connection_state text not null default 'disconnected'
    check (connection_state in ('simulated', 'connected', 'disconnected')),
  last_successful_sync timestamptz,
  last_attempted_sync timestamptz,
  is_simulated boolean not null default false,
  coverage_notes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (connection_state <> 'simulated' or is_simulated)
);

create table if not exists public.complaint_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  active boolean not null default true
);

create table if not exists public.source_cases (
  id uuid primary key default gen_random_uuid(),
  data_source_id uuid not null,
  source_case_id text not null,
  institution_id uuid,
  source_institution_name text,
  category_id uuid,
  receiving_bureau text not null check (receiving_bureau in ('RB', 'PGRC')),
  current_bureau text not null check (current_bureau in ('RB', 'PGRC')),
  assigned_officer_id uuid references public.profiles(id) on delete set null,
  status text not null check (status in ('pending', 'under_process', 'disposed', 'transferred')),
  received_at timestamptz not null,
  source_updated_at timestamptz,
  expected_disposal_at timestamptz,
  source_revision text,
  referral_reference text,
  restricted boolean not null default false,
  synthetic boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint source_cases_data_source_fk
    foreign key (data_source_id) references public.data_sources(id),
  constraint source_cases_institution_fk
    foreign key (institution_id) references public.institutions(id) on delete set null,
  constraint source_cases_category_fk
    foreign key (category_id) references public.complaint_categories(id) on delete set null,
  unique (data_source_id, source_case_id)
);

create table if not exists public.source_observations (
  id uuid primary key default gen_random_uuid(),
  source_case_id uuid not null references public.source_cases(id) on delete cascade,
  observed_at timestamptz not null default now(),
  source_revision text,
  observation_type text not null,
  payload jsonb not null default '{}'::jsonb,
  provenance text not null default 'source_record'
    check (provenance in ('source_record', 'human_review', 'system_derived')),
  synthetic boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.case_assignments (
  id uuid primary key default gen_random_uuid(),
  source_case_id uuid not null references public.source_cases(id) on delete cascade,
  officer_id uuid references public.profiles(id) on delete set null,
  bureau text not null check (bureau in ('RB', 'PGRC')),
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz,
  assigned_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.case_actions (
  id uuid primary key default gen_random_uuid(),
  source_case_id uuid not null,
  occurred_at timestamptz not null,
  bureau text not null check (bureau in ('RB', 'PGRC')),
  label text not null,
  source_reference text,
  note text,
  provenance text not null default 'source_record'
    check (provenance in ('source_record', 'human_review', 'system_derived')),
  synthetic boolean not null default false,
  created_at timestamptz not null default now(),
  constraint case_actions_source_case_fk
    foreign key (source_case_id) references public.source_cases(id) on delete cascade
);

create table if not exists public.proceedings (
  id uuid primary key default gen_random_uuid(),
  source_case_id uuid not null references public.source_cases(id) on delete cascade,
  proceeding_reference text,
  stage text not null,
  started_at timestamptz,
  ended_at timestamptz,
  source_reference text,
  synthetic boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.case_relationships (
  id uuid primary key default gen_random_uuid(),
  source_case_id uuid not null references public.source_cases(id) on delete cascade,
  related_case_id uuid not null references public.source_cases(id) on delete cascade,
  relationship_type text not null check (relationship_type in (
    'formal_referral',
    'proceeding_stage_of',
    'action_derived_from',
    'appeal_of',
    'potential_same_matter',
    'confirmed_same_matter',
    'related_but_distinct'
  )),
  source_reference text,
  provenance text not null default 'source_record'
    check (provenance in ('source_record', 'human_review', 'system_derived')),
  is_authoritative boolean not null default false,
  synthetic boolean not null default false,
  created_at timestamptz not null default now(),
  check (source_case_id <> related_case_id),
  unique (source_case_id, related_case_id, relationship_type, provenance)
);

create table if not exists public.coordination_episodes (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institutions(id) on delete set null,
  title text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coordination_items (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid references public.coordination_episodes(id) on delete set null,
  institution_id uuid references public.institutions(id) on delete set null,
  suggested_relationship text not null,
  matching_evidence jsonb not null default '[]'::jsonb,
  conflicting_evidence jsonb not null default '[]'::jsonb,
  missing_information jsonb not null default '[]'::jsonb,
  freshness_state text not null default 'unknown'
    check (freshness_state in ('fresh', 'stale', 'unknown')),
  rule_version text not null,
  review_status text not null default 'open'
    check (review_status in ('open', 'reviewed', 'dismissed')),
  review_decision text check (review_decision is null or review_decision in (
    'confirmed_same_matter',
    'related_but_distinct',
    'legitimate_procedural_progression',
    'potential_parallel_action',
    'insufficient_evidence',
    'dismissed_suggestion'
  )),
  assigned_reviewer_id uuid references public.profiles(id) on delete set null,
  rationale text,
  suggested_decision text not null check (suggested_decision in (
    'confirmed_same_matter',
    'related_but_distinct',
    'legitimate_procedural_progression',
    'potential_parallel_action',
    'insufficient_evidence',
    'dismissed_suggestion'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coordination_item_cases (
  coordination_item_id uuid not null references public.coordination_items(id) on delete cascade,
  source_case_id uuid not null references public.source_cases(id) on delete cascade,
  primary key (coordination_item_id, source_case_id)
);

create table if not exists public.coordination_reviews (
  id uuid primary key default gen_random_uuid(),
  coordination_item_id uuid not null references public.coordination_items(id) on delete cascade,
  reviewer_profile_id uuid references public.profiles(id) on delete set null,
  decision text not null check (decision in (
    'confirmed_same_matter',
    'related_but_distinct',
    'legitimate_procedural_progression',
    'potential_parallel_action',
    'insufficient_evidence',
    'dismissed_suggestion'
  )),
  rationale text not null check (length(trim(rationale)) >= 12),
  reviewed_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  data_source_id uuid not null references public.data_sources(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  state text not null default 'pending'
    check (state in ('pending', 'running', 'succeeded', 'failed', 'simulated')),
  records_received integer not null default 0 check (records_received >= 0),
  records_processed integer not null default 0 check (records_processed >= 0),
  records_quarantined integer not null default 0 check (records_quarantined >= 0),
  error_summary text,
  synthetic boolean not null default false
);

create table if not exists public.reconciliation_issues (
  id uuid primary key default gen_random_uuid(),
  data_source_id uuid not null references public.data_sources(id) on delete cascade,
  source_case_id text,
  issue_type text not null,
  detail text not null,
  state text not null default 'open' check (state in ('open', 'resolved')),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  synthetic boolean not null default false
);

create table if not exists public.rule_versions (
  version text primary key,
  name text not null,
  description text not null,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.status_mappings (
  id uuid primary key default gen_random_uuid(),
  source_value text not null,
  canonical_value text not null,
  mapping_type text not null check (mapping_type in ('status', 'category', 'bureau')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_value, mapping_type)
);

create index if not exists source_cases_source_case_id_idx on public.source_cases(source_case_id);
create index if not exists source_cases_institution_id_idx on public.source_cases(institution_id);
create index if not exists source_cases_status_idx on public.source_cases(status);
create index if not exists source_cases_bureau_idx on public.source_cases(current_bureau);
create index if not exists source_cases_received_at_idx on public.source_cases(received_at desc);
create index if not exists case_relationships_lookup_idx on public.case_relationships(related_case_id, source_case_id);
create index if not exists coordination_items_review_status_idx on public.coordination_items(review_status, updated_at desc);
create index if not exists source_observations_source_case_idx on public.source_observations(source_case_id, observed_at desc);
create index if not exists case_actions_source_case_idx on public.case_actions(source_case_id, occurred_at desc);
create index if not exists reconciliation_issues_state_idx on public.reconciliation_issues(state, created_at desc);
create index if not exists ingestion_runs_source_started_idx on public.ingestion_runs(data_source_id, started_at desc);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email, role, approval_status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.email, ''),
    'read_only_viewer',
    'pending'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_nexus on auth.users;
create trigger on_auth_user_created_nexus
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

create or replace function public.is_nexus_approved()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and approval_status = 'approved'
  );
$$;

create or replace function public.nexus_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles
  where id = auth.uid() and approval_status = 'approved'
  limit 1;
$$;

create or replace function public.is_nexus_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.nexus_role() = 'administrator', false);
$$;

create or replace function public.can_view_source_case(p_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_nexus_approved() and exists (
    select 1
    from public.source_cases sc
    left join public.institutions i on i.id = sc.institution_id
    left join public.profiles p on p.id = auth.uid()
    where sc.id = p_case_id
      and (
        not sc.restricted
        or public.nexus_role() = 'administrator'
        or (
          public.nexus_role() = 'bureau_officer'
          and p.bureau = sc.current_bureau
        )
        or (
          public.nexus_role() = 'regional_officer'
          and p.region is not null
          and i.region = p.region
        )
      )
  );
$$;

create or replace function public.can_view_coordination_item(p_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_nexus_approved()
    and exists (select 1 from public.coordination_items ci where ci.id = p_item_id)
    and not exists (
      select 1
      from public.coordination_item_cases cic
      join public.source_cases sc on sc.id = cic.source_case_id
      where cic.coordination_item_id = p_item_id
        and not public.can_view_source_case(sc.id)
    );
$$;

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
    on conflict (source_case_id, related_case_id, relationship_type, provenance) do nothing;
  end if;

  insert into public.audit_events (actor_profile_id, action, target, details)
  values (
    auth.uid(),
    'coordination_review_recorded',
    p_item_id::text,
    jsonb_build_object('decision', p_decision, 'rationale', trim(p_rationale))
  );

  return jsonb_build_object(
    'decision', p_decision,
    'rationale', trim(p_rationale),
    'reviewer', coalesce(v_reviewer, 'Officer'),
    'reviewed_at', v_reviewed_at
  );
end;
$$;

alter table public.profiles enable row level security;
alter table public.institutions enable row level security;
alter table public.institution_aliases enable row level security;
alter table public.data_sources enable row level security;
alter table public.complaint_categories enable row level security;
alter table public.source_cases enable row level security;
alter table public.source_observations enable row level security;
alter table public.case_assignments enable row level security;
alter table public.case_actions enable row level security;
alter table public.proceedings enable row level security;
alter table public.case_relationships enable row level security;
alter table public.coordination_episodes enable row level security;
alter table public.coordination_items enable row level security;
alter table public.coordination_item_cases enable row level security;
alter table public.coordination_reviews enable row level security;
alter table public.audit_events enable row level security;
alter table public.ingestion_runs enable row level security;
alter table public.reconciliation_issues enable row level security;
alter table public.rule_versions enable row level security;
alter table public.status_mappings enable row level security;

drop policy if exists profiles_read_self_or_admin on public.profiles;
create policy profiles_read_self_or_admin on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_nexus_admin());

drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
for update to authenticated
using (public.is_nexus_admin())
with check (public.is_nexus_admin());

drop policy if exists institutions_read_approved on public.institutions;
create policy institutions_read_approved on public.institutions
for select to authenticated using (public.is_nexus_approved());
drop policy if exists institutions_admin_write on public.institutions;
create policy institutions_admin_write on public.institutions
for all to authenticated using (public.is_nexus_admin())
with check (public.is_nexus_admin());

drop policy if exists institution_aliases_read_approved on public.institution_aliases;
create policy institution_aliases_read_approved on public.institution_aliases
for select to authenticated using (public.is_nexus_approved());
drop policy if exists institution_aliases_admin_write on public.institution_aliases;
create policy institution_aliases_admin_write on public.institution_aliases
for all to authenticated using (public.is_nexus_admin())
with check (public.is_nexus_admin());

drop policy if exists data_sources_read_approved on public.data_sources;
create policy data_sources_read_approved on public.data_sources
for select to authenticated using (public.is_nexus_approved());
drop policy if exists data_sources_admin_write on public.data_sources;
create policy data_sources_admin_write on public.data_sources
for all to authenticated using (public.is_nexus_admin())
with check (public.is_nexus_admin());

drop policy if exists categories_read_approved on public.complaint_categories;
create policy categories_read_approved on public.complaint_categories
for select to authenticated using (public.is_nexus_approved());

drop policy if exists source_cases_read_by_role on public.source_cases;
create policy source_cases_read_by_role on public.source_cases
for select to authenticated using (public.can_view_source_case(id));

drop policy if exists source_observations_read_by_case on public.source_observations;
create policy source_observations_read_by_case on public.source_observations
for select to authenticated using (public.can_view_source_case(source_case_id));

drop policy if exists case_assignments_read_by_case on public.case_assignments;
create policy case_assignments_read_by_case on public.case_assignments
for select to authenticated using (public.can_view_source_case(source_case_id));

drop policy if exists case_actions_read_by_case on public.case_actions;
create policy case_actions_read_by_case on public.case_actions
for select to authenticated using (public.can_view_source_case(source_case_id));

drop policy if exists proceedings_read_by_case on public.proceedings;
create policy proceedings_read_by_case on public.proceedings
for select to authenticated using (public.can_view_source_case(source_case_id));

drop policy if exists relationships_read_by_both_cases on public.case_relationships;
create policy relationships_read_by_both_cases on public.case_relationships
for select to authenticated using (
  public.can_view_source_case(source_case_id)
  and public.can_view_source_case(related_case_id)
);

drop policy if exists episodes_read_approved on public.coordination_episodes;
create policy episodes_read_approved on public.coordination_episodes
for select to authenticated using (public.is_nexus_approved());

drop policy if exists coordination_items_read_visible on public.coordination_items;
create policy coordination_items_read_visible on public.coordination_items
for select to authenticated using (public.can_view_coordination_item(id));

drop policy if exists coordination_item_cases_read_visible on public.coordination_item_cases;
create policy coordination_item_cases_read_visible on public.coordination_item_cases
for select to authenticated using (public.can_view_coordination_item(coordination_item_id));

drop policy if exists coordination_reviews_read_visible on public.coordination_reviews;
create policy coordination_reviews_read_visible on public.coordination_reviews
for select to authenticated using (public.can_view_coordination_item(coordination_item_id));

drop policy if exists audit_events_admin_read on public.audit_events;
create policy audit_events_admin_read on public.audit_events
for select to authenticated using (public.is_nexus_admin());

drop policy if exists ingestion_runs_read_approved on public.ingestion_runs;
create policy ingestion_runs_read_approved on public.ingestion_runs
for select to authenticated using (public.is_nexus_approved());

drop policy if exists reconciliation_issues_read_approved on public.reconciliation_issues;
create policy reconciliation_issues_read_approved on public.reconciliation_issues
for select to authenticated using (public.is_nexus_approved());

drop policy if exists rules_read_approved on public.rule_versions;
create policy rules_read_approved on public.rule_versions
for select to authenticated using (public.is_nexus_approved());

drop policy if exists mappings_read_approved on public.status_mappings;
create policy mappings_read_approved on public.status_mappings
for select to authenticated using (public.is_nexus_approved());
drop policy if exists mappings_admin_write on public.status_mappings;
create policy mappings_admin_write on public.status_mappings
for all to authenticated using (public.is_nexus_admin())
with check (public.is_nexus_admin());

grant usage on schema public to authenticated;
grant select on public.profiles, public.institutions, public.institution_aliases,
  public.data_sources, public.complaint_categories, public.source_cases,
  public.source_observations, public.case_assignments, public.case_actions,
  public.proceedings, public.case_relationships, public.coordination_episodes,
  public.coordination_items, public.coordination_item_cases,
  public.coordination_reviews, public.audit_events, public.ingestion_runs,
  public.reconciliation_issues, public.rule_versions, public.status_mappings
to authenticated;
grant update on public.profiles to authenticated;
grant insert, update, delete on public.institutions, public.institution_aliases,
  public.data_sources, public.status_mappings to authenticated;
grant execute on function public.is_nexus_approved() to authenticated;
grant execute on function public.nexus_role() to authenticated;
grant execute on function public.is_nexus_admin() to authenticated;
grant execute on function public.can_view_source_case(uuid) to authenticated;
grant execute on function public.can_view_coordination_item(uuid) to authenticated;
grant execute on function public.submit_coordination_review(uuid, text, text, timestamptz)
to authenticated;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.is_nexus_approved() from public, anon;
revoke all on function public.nexus_role() from public, anon;
revoke all on function public.is_nexus_admin() from public, anon;
revoke all on function public.can_view_source_case(uuid) from public, anon;
revoke all on function public.can_view_coordination_item(uuid) from public, anon;
revoke all on function public.submit_coordination_review(uuid, text, text, timestamptz)
from public, anon;
