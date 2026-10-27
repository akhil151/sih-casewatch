-- Administrative changes are performed through audited, role-checked functions.

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

create or replace function public.admin_upsert_status_mapping(
  p_source_value text,
  p_canonical_value text,
  p_mapping_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mapping public.status_mappings%rowtype;
begin
  if auth.uid() is null or not public.is_nexus_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_source_value, ''))) = 0
     or length(trim(coalesce(p_canonical_value, ''))) = 0 then
    raise exception 'Source and canonical values are required' using errcode = '22023';
  end if;
  if p_mapping_type is null or p_mapping_type not in ('status', 'category', 'bureau') then
    raise exception 'Unsupported mapping type' using errcode = '22023';
  end if;

  insert into public.status_mappings (source_value, canonical_value, mapping_type)
  values (trim(p_source_value), trim(p_canonical_value), p_mapping_type)
  on conflict (source_value, mapping_type)
  do update set canonical_value = excluded.canonical_value, updated_at = now()
  returning * into v_mapping;

  insert into public.audit_events (actor_profile_id, action, target, details)
  values (
    auth.uid(),
    'status_mapping_updated',
    v_mapping.mapping_type || ':' || v_mapping.source_value,
    jsonb_build_object('canonical_value', v_mapping.canonical_value)
  );

  return jsonb_build_object(
    'source_value', v_mapping.source_value,
    'canonical_value', v_mapping.canonical_value,
    'mapping_type', v_mapping.mapping_type
  );
end;
$$;

grant execute on function public.admin_update_profile_role(uuid, text, text, text, text)
to authenticated;
grant execute on function public.admin_upsert_status_mapping(text, text, text)
to authenticated;
revoke all on function public.admin_update_profile_role(uuid, text, text, text, text)
from public, anon;
revoke all on function public.admin_upsert_status_mapping(text, text, text)
from public, anon;
