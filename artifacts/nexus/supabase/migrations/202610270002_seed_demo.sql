-- Deterministic synthetic dataset. This script is idempotent and does not create user accounts.
-- Every row is marked synthetic; no record represents an actual AICTE case or institution.

insert into public.data_sources (
  id, code, name, connection_state, is_simulated, coverage_notes
) values
  ('10000000-0000-4000-8000-000000000001', 'RB', 'Regulation Bureau (simulated)', 'simulated', true,
   array['Illustrative connector only; no live source-system connection.']),
  ('10000000-0000-4000-8000-000000000002', 'PGRC', 'Public Grievance Redressal Cell (simulated)', 'simulated', true,
   array['Illustrative connector only; no live source-system connection.'])
on conflict (id) do nothing;

insert into public.complaint_categories (id, name, description, active) values
  ('20000000-0000-4000-8000-000000000001', 'Academic Standards', 'Synthetic category mapping.', true),
  ('20000000-0000-4000-8000-000000000002', 'Faculty Qualification', 'Synthetic category mapping.', true),
  ('20000000-0000-4000-8000-000000000003', 'Infrastructure Compliance', 'Synthetic category mapping.', true),
  ('20000000-0000-4000-8000-000000000004', 'Student Grievance', 'Synthetic category mapping.', true),
  ('20000000-0000-4000-8000-000000000005', 'Financial Disclosure', 'Synthetic category mapping.', true),
  ('20000000-0000-4000-8000-000000000006', 'Approval Conditions', 'Synthetic category mapping.', true),
  ('20000000-0000-4000-8000-000000000007', 'Examination Governance', 'Synthetic category mapping.', true),
  ('20000000-0000-4000-8000-000000000008', 'Safety and Accessibility', 'Synthetic category mapping.', true)
on conflict (id) do nothing;

do $$
declare
  institution_names text[] := array[
    'National Institute of Technical Studies, Delhi',
    'Eastern Institute of Technology, Kolkata',
    'Eastern Technical Institute, Kolkata',
    'Coastal College of Engineering, Chennai',
    'Saraswati Institute of Applied Sciences, Pune',
    'Deccan School of Engineering, Hyderabad',
    'North Valley Technical University, Jaipur',
    'Riverbend College of Technology, Lucknow',
    'Central Institute for Digital Engineering, Bhopal',
    'Central Institute of Digital Engineering, Indore',
    'Western Polytechnic and Research Centre, Ahmedabad',
    'Sahyadri Institute of Engineering, Bengaluru',
    'Delta College of Technical Education, Vijayawada',
    'Himalayan School of Applied Technology, Dehradun',
    'Meridian Institute of Engineering, Patna',
    'Sunrise Technical College, Guwahati',
    'Pioneer Institute of Technology, Ranchi',
    'Crescent School of Engineering, Kochi',
    'Lakeview College of Technical Studies, Srinagar',
    'Greenfield Institute of Engineering, Raipur'
  ];
  states text[] := array[
    'Delhi', 'West Bengal', 'West Bengal', 'Tamil Nadu', 'Maharashtra',
    'Telangana', 'Rajasthan', 'Uttar Pradesh', 'Madhya Pradesh', 'Madhya Pradesh',
    'Gujarat', 'Karnataka', 'Andhra Pradesh', 'Uttarakhand', 'Bihar',
    'Assam', 'Jharkhand', 'Kerala', 'Jammu and Kashmir', 'Chhattisgarh'
  ];
  regions text[] := array[
    'North', 'East', 'East', 'South', 'West', 'South', 'North', 'North',
    'Central', 'Central', 'West', 'South', 'South', 'North', 'East',
    'North East', 'East', 'South', 'North', 'Central'
  ];
  i integer;
  institution_uuid uuid;
begin
  for i in 1..20 loop
    institution_uuid := (
      '00000000-0000-4000-8000-' || lpad(i::text, 12, '0')
    )::uuid;

    insert into public.institutions (
      id, aicte_permanent_id, name, address, state, region,
      identity_state, source_labels, synthetic
    ) values (
      institution_uuid,
      case when i in (15, 19) then null else 'SIM-AICTE-' || (260000 + i)::text end,
      institution_names[i],
      'Demonstration campus ' || i::text || ', ' || states[i],
      states[i],
      regions[i],
      case when i = 15 then 'unresolved' when i in (9, 10) then 'candidate' else 'verified' end,
      array['SIMULATED RB', 'SIMULATED PGRC'],
      true
    )
    on conflict (id) do nothing;
  end loop;
end;
$$;

insert into public.institution_aliases (id, institution_id, alias, source_label)
values
  ('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'Eastern Institute of Technology', 'SIMULATED PGRC'),
  ('30000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000010', 'Central Digital Engineering Institute', 'SIMULATED RB'),
  ('30000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000015', 'Meridian Institute', 'SIMULATED PGRC')
on conflict (institution_id, alias) do nothing;

with generated as (
  select
    n,
    case when n % 2 = 0 then 'RB' else 'PGRC' end as bureau_code,
    case
      when n = 22 then 3
      when n = 28 then 8
      else ((n - 1) % 20) + 1
    end as institution_number,
    case
      when n in (3, 22) then 'Academic Standards'
      when n in (8, 28) then 'Financial Disclosure'
      when n = 5 then 'Faculty Qualification'
      when n = 25 then 'Infrastructure Compliance'
      else (array[
        'Academic Standards', 'Faculty Qualification', 'Infrastructure Compliance',
        'Student Grievance', 'Financial Disclosure', 'Approval Conditions',
        'Examination Governance', 'Safety and Accessibility'
      ])[((n - 1) % 8) + 1]
    end as category_name,
    case ((n - 1) % 6)
      when 0 then 'pending'
      when 1 then 'under_process'
      when 2 then 'under_process'
      when 3 then 'disposed'
      when 4 then 'transferred'
      else 'pending'
    end as case_status
  from generate_series(1, 80) as n
)
insert into public.source_cases (
  id, data_source_id, source_case_id, institution_id, source_institution_name,
  category_id, receiving_bureau, current_bureau, status, received_at,
  source_updated_at, expected_disposal_at, source_revision, referral_reference,
  restricted, synthetic
)
select
  ('00000000-0000-4000-9000-' || lpad(g.n::text, 12, '0'))::uuid,
  case when g.bureau_code = 'RB'
    then '10000000-0000-4000-8000-000000000001'::uuid
    else '10000000-0000-4000-8000-000000000002'::uuid
  end,
  'SIM-' || g.bureau_code || '-2026-' || lpad(g.n::text, 4, '0'),
  case when g.n = 77 then null
    else ('00000000-0000-4000-8000-' || lpad(g.institution_number::text, 12, '0'))::uuid
  end,
  case when g.n = 77 then 'Unverified institute name in submitted source record'
    else institution_names.name
  end,
  categories.id,
  g.bureau_code,
  case when g.case_status = 'transferred' and g.bureau_code = 'RB' then 'PGRC'
       when g.case_status = 'transferred' and g.bureau_code = 'PGRC' then 'RB'
       else g.bureau_code end,
  g.case_status,
  timestamptz '2026-10-27 09:00:00+00' - make_interval(days => 12 + ((g.n * 7) % 135)),
  case when g.n in (19, 47, 67)
    then timestamptz '2026-10-27 12:00:00+00' - make_interval(days => 52 + (g.n % 13))
    else timestamptz '2026-10-27 12:00:00+00' - make_interval(days => ((g.n * 5) % 9))
  end,
  case when g.n % 8 = 0
    then timestamptz '2026-10-27 17:00:00+00' - interval '4 days'
    when g.case_status = 'disposed' then null
    else timestamptz '2026-10-27 17:00:00+00' + make_interval(days => 18 + (g.n % 22))
  end,
  case when g.n % 9 = 0 then null else 'SIM-REV-' || ((g.n % 5) + 1)::text end,
  case when g.n in (3, 22) then 'SIM-REF-2026-014' else null end,
  g.n = 18,
  true
from generated g
left join public.institutions institution_names
  on institution_names.id = ('00000000-0000-4000-8000-' || lpad(g.institution_number::text, 12, '0'))::uuid
join public.complaint_categories categories on categories.name = g.category_name
on conflict (data_source_id, source_case_id) do nothing;

insert into public.source_observations (
  id, source_case_id, observed_at, source_revision, observation_type, payload,
  provenance, synthetic
)
select
  ('00000000-0000-4000-8100-' || lpad(n::text, 12, '0'))::uuid,
  ('00000000-0000-4000-9000-' || lpad(n::text, 12, '0'))::uuid,
  coalesce(sc.source_updated_at, sc.received_at),
  sc.source_revision,
  'synthetic_source_snapshot',
  jsonb_build_object(
    'source_case_id', sc.source_case_id,
    'status', sc.status,
    'synthetic', true
  ),
  'source_record',
  true
from generate_series(1, 80) as n
join public.source_cases sc
  on sc.id = ('00000000-0000-4000-9000-' || lpad(n::text, 12, '0'))::uuid
on conflict (id) do nothing;

insert into public.case_actions (
  id, source_case_id, occurred_at, bureau, label, source_reference, note,
  provenance, synthetic
)
select
  ('00000000-0000-4000-8110-' || lpad((n * 2 + action_number)::text, 12, '0'))::uuid,
  sc.id,
  case when action_number = 1 then sc.received_at else coalesce(sc.source_updated_at, sc.received_at) end,
  case when action_number = 1 then sc.receiving_bureau else sc.current_bureau end,
  case when action_number = 1 then 'Source record received' else 'Source status update recorded' end,
  case when action_number = 1 then sc.source_case_id else 'SIM-REV-' || lpad(n::text, 4, '0') end,
  case when n = 12 then null else 'Synthetic source observation; source record remains authoritative.' end,
  'source_record',
  true
from generate_series(1, 80) as n
join public.source_cases sc
  on sc.id = ('00000000-0000-4000-9000-' || lpad(n::text, 12, '0'))::uuid
cross join generate_series(1, 2) as action_number
where n <> 12
  and (action_number = 1 or n % 4 <> 0)
on conflict (id) do nothing;

insert into public.case_relationships (
  id, source_case_id, related_case_id, relationship_type,
  source_reference, provenance, is_authoritative, synthetic
)
values
  (
    '00000000-0000-4000-8120-000000000001',
    '00000000-0000-4000-9000-000000000003',
    '00000000-0000-4000-9000-000000000022',
    'formal_referral',
    'SIM-REF-2026-014',
    'source_record',
    true,
    true
  ),
  (
    '00000000-0000-4000-8120-000000000002',
    '00000000-0000-4000-9000-000000000022',
    '00000000-0000-4000-9000-000000000003',
    'formal_referral',
    'SIM-REF-2026-014',
    'source_record',
    true,
    true
  )
on conflict (source_case_id, related_case_id, relationship_type, provenance) do nothing;

insert into public.proceedings (
  id, source_case_id, proceeding_reference, stage, started_at, source_reference, synthetic
)
values (
  '00000000-0000-4000-8130-000000000001',
  '00000000-0000-4000-9000-000000000022',
  'SIM-PROC-2026-014',
  'Initial regulatory review after formal referral',
  timestamptz '2026-08-15 10:00:00+00',
  'SIM-REF-2026-014',
  true
)
on conflict (id) do nothing;

insert into public.coordination_episodes (id, institution_id, title, status)
values
  ('00000000-0000-4000-8140-000000000001', '00000000-0000-4000-8000-000000000003', 'Referral lineage review (simulated)', 'closed'),
  ('00000000-0000-4000-8140-000000000002', '00000000-0000-4000-8000-000000000008', 'Potential parallel action review (simulated)', 'open')
on conflict (id) do nothing;

insert into public.coordination_items (
  id, episode_id, institution_id, suggested_relationship, matching_evidence,
  conflicting_evidence, missing_information, freshness_state, rule_version,
  review_status, review_decision, rationale, suggested_decision, created_at, updated_at
)
values
  (
    '00000000-0000-4000-8200-000000000001',
    '00000000-0000-4000-8140-000000000001',
    '00000000-0000-4000-8000-000000000003',
    'Documented procedural progression',
    '["Both source records reference the same verified institution.","Both source records share referral SIM-REF-2026-014.","The RB action follows the PGRC referral."]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    'fresh',
    'NEXUS-RULES-0.4',
    'reviewed',
    'legitimate_procedural_progression',
    'The source referral and later RB action indicate a legitimate procedural stage. Keep the bureau actions distinct.',
    'legitimate_procedural_progression',
    timestamptz '2026-10-13 10:00:00+00',
    timestamptz '2026-10-15 10:00:00+00'
  ),
  (
    '00000000-0000-4000-8200-000000000002',
    '00000000-0000-4000-8140-000000000002',
    '00000000-0000-4000-8000-000000000008',
    'Potential parallel action',
    '["Same verified institution and complaint category.","Source receipt dates overlap within the configured review window."]'::jsonb,
    '["No shared referral, proceeding, or action reference is recorded."]'::jsonb,
    '["Underlying source documents have not been compared.","No reviewer has confirmed whether the complaints concern the same matter."]'::jsonb,
    'fresh',
    'NEXUS-RULES-0.4',
    'open',
    null,
    null,
    'potential_parallel_action',
    timestamptz '2026-10-23 10:00:00+00',
    timestamptz '2026-10-26 10:00:00+00'
  ),
  (
    '00000000-0000-4000-8200-000000000003',
    null,
    '00000000-0000-4000-8000-000000000005',
    'Same institution; potentially distinct matters',
    '["Both source records concern the same verified institution."]'::jsonb,
    '["Complaint categories and stated subjects differ.","No formal referral or shared proceeding reference is present."]'::jsonb,
    '["Supporting source documents are not attached in this prototype."]'::jsonb,
    'fresh',
    'NEXUS-RULES-0.4',
    'open',
    null,
    null,
    'related_but_distinct',
    timestamptz '2026-10-24 10:00:00+00',
    timestamptz '2026-10-26 10:00:00+00'
  ),
  (
    '00000000-0000-4000-8200-000000000004',
    null,
    null,
    'Institution identity needs review',
    '["Institution names share several words."]'::jsonb,
    '["The source records identify different states and institution locations."]'::jsonb,
    '["AICTE Permanent IDs are not present in both source records.","Do not merge institutions based on name similarity alone."]'::jsonb,
    'fresh',
    'NEXUS-RULES-0.4',
    'open',
    null,
    null,
    'insufficient_evidence',
    timestamptz '2026-10-25 10:00:00+00',
    timestamptz '2026-10-26 10:00:00+00'
  ),
  (
    '00000000-0000-4000-8200-000000000005',
    null,
    '00000000-0000-4000-8000-000000000019',
    'Potentially related; source freshness is limited',
    '["Source dates fall within the configured candidate window."]'::jsonb,
    '[]'::jsonb,
    '["RB source record has not updated within the configured freshness threshold.","A current source status is needed before review."]'::jsonb,
    'stale',
    'NEXUS-RULES-0.4',
    'open',
    null,
    null,
    'insufficient_evidence',
    timestamptz '2026-10-23 10:00:00+00',
    timestamptz '2026-10-26 10:00:00+00'
  ),
  (
    '00000000-0000-4000-8200-000000000006',
    null,
    null,
    'Incomplete source action history',
    '["A source case exists for the institution."]'::jsonb,
    '[]'::jsonb,
    '["No source-attributed action history was received.","Absence of history is not evidence that no actions occurred."]'::jsonb,
    'unknown',
    'NEXUS-RULES-0.4',
    'open',
    null,
    null,
    'insufficient_evidence',
    timestamptz '2026-10-23 10:00:00+00',
    timestamptz '2026-10-26 10:00:00+00'
  ),
  (
    '00000000-0000-4000-8200-000000000007',
    null,
    null,
    'Institution mapping is unresolved',
    '[]'::jsonb,
    '[]'::jsonb,
    '["No verified institution identifier is present in the source record.","Human identity review is required before linking cases."]'::jsonb,
    'unknown',
    'NEXUS-RULES-0.4',
    'open',
    null,
    null,
    'insufficient_evidence',
    timestamptz '2026-10-24 10:00:00+00',
    timestamptz '2026-10-26 10:00:00+00'
  )
on conflict (id) do nothing;

insert into public.coordination_item_cases (coordination_item_id, source_case_id)
values
  ('00000000-0000-4000-8200-000000000001', '00000000-0000-4000-9000-000000000003'),
  ('00000000-0000-4000-8200-000000000001', '00000000-0000-4000-9000-000000000022'),
  ('00000000-0000-4000-8200-000000000002', '00000000-0000-4000-9000-000000000008'),
  ('00000000-0000-4000-8200-000000000002', '00000000-0000-4000-9000-000000000028'),
  ('00000000-0000-4000-8200-000000000003', '00000000-0000-4000-9000-000000000005'),
  ('00000000-0000-4000-8200-000000000003', '00000000-0000-4000-9000-000000000025'),
  ('00000000-0000-4000-8200-000000000004', '00000000-0000-4000-9000-000000000009'),
  ('00000000-0000-4000-8200-000000000004', '00000000-0000-4000-9000-000000000010'),
  ('00000000-0000-4000-8200-000000000005', '00000000-0000-4000-9000-000000000019'),
  ('00000000-0000-4000-8200-000000000005', '00000000-0000-4000-9000-000000000039'),
  ('00000000-0000-4000-8200-000000000006', '00000000-0000-4000-9000-000000000012'),
  ('00000000-0000-4000-8200-000000000007', '00000000-0000-4000-9000-000000000077')
on conflict do nothing;

insert into public.coordination_reviews (
  id, coordination_item_id, reviewer_profile_id, decision, rationale, reviewed_at
)
values (
  '00000000-0000-4000-8210-000000000001',
  '00000000-0000-4000-8200-000000000001',
  null,
  'legitimate_procedural_progression',
  'The source referral and later RB action indicate a legitimate procedural stage. Keep the bureau actions distinct.',
  timestamptz '2026-10-15 10:00:00+00'
)
on conflict (id) do nothing;

insert into public.ingestion_runs (
  id, data_source_id, started_at, completed_at, state,
  records_received, records_processed, records_quarantined, synthetic
)
values
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   timestamptz '2026-10-26 04:00:00+00', timestamptz '2026-10-26 04:00:04+00',
   'simulated', 40, 39, 1, true),
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002',
   timestamptz '2026-10-26 04:05:00+00', timestamptz '2026-10-26 04:05:05+00',
   'simulated', 40, 38, 2, true)
on conflict (id) do nothing;

insert into public.reconciliation_issues (
  id, data_source_id, source_case_id, issue_type, detail, state, synthetic
)
values
  ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   'SIM-RB-2026-0019', 'Stale source observation',
   'The simulated source update exceeds the configured freshness threshold.', 'open', true),
  ('50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002',
   'SIM-PGRC-2026-0012', 'Incomplete action history',
   'No source-attributed action history was received for this simulated case.', 'open', true),
  ('50000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002',
   'SIM-PGRC-2026-0077', 'Unresolved institution mapping',
   'The source record does not include a verified institution identifier.', 'open', true)
on conflict (id) do nothing;

insert into public.rule_versions (version, name, description, active)
values
  ('NEXUS-RULES-0.4', 'Evidence-first candidate generation',
   'Deterministic candidate signals require human review; no model conclusion is treated as official fact.', true),
  ('NEXUS-RULES-0.3', 'Referral lineage',
   'Distinguishes recorded referrals from possible parallel actions.', false)
on conflict (version) do nothing;

insert into public.status_mappings (id, source_value, canonical_value, mapping_type)
values
  ('60000000-0000-4000-8000-000000000001', 'Under process', 'Under Process', 'status'),
  ('60000000-0000-4000-8000-000000000002', 'Disposed', 'Disposed', 'status'),
  ('60000000-0000-4000-8000-000000000003', 'Transferred to RB', 'Transferred', 'status'),
  ('60000000-0000-4000-8000-000000000004', 'Academic quality', 'Academic Standards', 'category')
on conflict (source_value, mapping_type) do nothing;

insert into public.audit_events (id, actor_profile_id, action, target, details, created_at)
values (
  '70000000-0000-4000-8000-000000000001',
  null,
  'synthetic_seed_loaded',
  'NEXUS demonstration dataset',
  '{"synthetic":true,"source_systems":["RB","PGRC"]}'::jsonb,
  timestamptz '2026-10-27 08:00:00+00'
)
on conflict (id) do nothing;
