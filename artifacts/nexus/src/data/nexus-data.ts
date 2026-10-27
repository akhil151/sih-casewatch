import {
  demoCases,
  demoCoordinationItems,
  demoInstitutions,
  getDemoAsOf,
} from "./demo-data";
import { supabase } from "../lib/supabase";
import type {
  AdministrationSnapshot,
  AnalyticsSnapshot,
  Bureau,
  CaseStatus,
  CoordinationItem,
  CoordinationReview,
  DashboardSnapshot,
  Freshness,
  Institution,
  NexusNotification,
  NotificationType,
  ReliabilitySnapshot,
  ReviewDecision,
  SourceCase,
  TimelineEvent,
} from "../types/nexus";
export type { ReviewDecision, NexusNotification, NotificationType } from "../types/nexus";

const DEMO_MODE_KEY = "nexus.simulated-demo-mode";
const DEMO_REVIEW_KEY = "nexus.simulated-reviews";
const DEMO_REVIEWER = "Demo Bureau Reviewer";
const DEMO_ADMIN_USERS_KEY = "nexus.simulated-admin-users";
const DEMO_ADMIN_MAPPINGS_KEY = "nexus.simulated-admin-mappings";
const DEMO_ADMIN_AUDIT_KEY = "nexus.simulated-admin-audit";
const DEMO_NOTIFICATIONS_KEY = "nexus.simulated-notifications";

export interface InstitutionFilters {
  query?: string;
  state?: string;
  identityState?: string;
}

export interface CaseFilters {
  query?: string;
  bureau?: string;
  region?: string;
  category?: string;
  status?: string;
  from?: string;
  to?: string;
}

function isDemoMode() {
  return (
    typeof window !== "undefined" &&
    window.sessionStorage.getItem(DEMO_MODE_KEY) === "true"
  );
}

function requireSupabase() {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Add the documented public project URL and anon/publishable key, or explicitly enter simulated demo mode.",
    );
  }
  return supabase;
}

function requiredResult<T>(
  result: { data: T | null; error: { message: string } | null },
  label: string,
) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  if (result.data === null) throw new Error(`${label}: no data was returned.`);
  return result.data;
}

export function bureau(value: unknown): Bureau {
  if (value === "RB") return "RB";
  if (value === "PGRC") return "PGRC";
  return "Unmapped";
}

export function status(value: unknown): CaseStatus {
  if (typeof value === "string") {
    const s = value.trim();
    if (s === "pending" || s === "Pending") return "Pending";
    if (s === "under_process" || s === "Under process" || s === "Under Process") return "Under Process";
    if (s === "disposed" || s === "Disposed") return "Disposed";
    if (s === "transferred" || s === "Transferred" || s === "Transferred to RB" || s === "Transferred to PGRC") return "Transferred";
  }
  return "Unmapped";
}

function freshness(updatedAt?: string | null): Freshness {
  if (!updatedAt) return "unknown";
  return Date.now() - new Date(updatedAt).getTime() > 30 * 24 * 60 * 60 * 1000
    ? "stale"
    : "fresh";
}

function getDemoReviews(): Record<string, CoordinationReview> {
  try {
    const raw = window.localStorage.getItem(DEMO_REVIEW_KEY);
    return raw ? (JSON.parse(raw) as Record<string, CoordinationReview>) : {};
  } catch {
    return {};
  }
}

function readDemoJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function getDemoCoordinationItems(): CoordinationItem[] {
  const reviews = getDemoReviews();
  return demoCoordinationItems.map((item) => {
    const review = reviews[item.id];
    if (!review) return { ...item, cases: [...item.cases] };
    return {
      ...item,
      reviewStatus:
        review.decision === "dismissed_suggestion" ? "dismissed" : "reviewed",
      reviewDecision: review.decision,
      rationale: review.rationale,
      assignedReviewer: review.reviewer,
      updatedAt: review.reviewedAt,
      cases: [...item.cases],
    };
  });
}

function filterInstitutions(
  institutions: Institution[],
  filters: InstitutionFilters = {},
) {
  const query = filters.query?.trim().toLowerCase();
  return institutions.filter((institution) => {
    const matchesQuery =
      !query ||
      institution.name.toLowerCase().includes(query) ||
      institution.aliases.some((alias) => alias.toLowerCase().includes(query)) ||
      institution.permanentId?.toLowerCase().includes(query);
    const matchesState = !filters.state || institution.state === filters.state;
    const matchesIdentity =
      !filters.identityState || institution.identityState === filters.identityState;
    return matchesQuery && matchesState && matchesIdentity;
  });
}

function filterCases(
  cases: SourceCase[],
  filters: CaseFilters = {},
  institutions: Institution[] = demoInstitutions,
) {
  const query = filters.query?.trim().toLowerCase();
  return cases.filter((sourceCase) => {
    const matchesQuery =
      !query ||
      sourceCase.sourceCaseId.toLowerCase().includes(query) ||
      sourceCase.institutionName.toLowerCase().includes(query) ||
      sourceCase.category.toLowerCase().includes(query);
    const matchesBureau =
      !filters.bureau ||
      sourceCase.source === filters.bureau ||
      sourceCase.currentBureau === filters.bureau;
    const institution = institutions.find(
      (entry) => entry.id === sourceCase.institutionId,
    );
    const matchesRegion = !filters.region || institution?.region === filters.region;
    const matchesCategory = !filters.category || sourceCase.category === filters.category;
    const matchesStatus = !filters.status || sourceCase.status === filters.status;
    const receivedTime = new Date(sourceCase.receivedAt).getTime();
    const matchesFrom =
      !filters.from || receivedTime >= new Date(filters.from).getTime();
    const matchesTo =
      !filters.to || receivedTime <= new Date(`${filters.to}T23:59:59`).getTime();
    return (
      matchesQuery &&
      matchesBureau &&
      matchesRegion &&
      matchesCategory &&
      matchesStatus &&
      matchesFrom &&
      matchesTo
    );
  });
}

type DbInstitutionRow = {
  id: string;
  aicte_permanent_id: string | null;
  name: string;
  aliases?: Array<{ alias: string }> | null;
  address: string | null;
  state: string;
  region: string;
  identity_state: Institution["identityState"];
  source_labels: string[] | null;
  cases?: Array<{ count: number }> | null;
};

function mapInstitution(row: DbInstitutionRow): Institution {
  return {
    id: row.id,
    permanentId: row.aicte_permanent_id ?? undefined,
    name: row.name,
    aliases: (row.aliases ?? []).map((alias) => alias.alias),
    address: row.address ?? undefined,
    state: row.state,
    region: row.region,
    identityState: row.identity_state,
    sourceLabels: row.source_labels ?? [],
    caseCount: row.cases?.[0]?.count ?? 0,
  };
}

type DbActionRow = {
  id: string;
  occurred_at: string;
  bureau: string;
  label: string;
  source_reference: string | null;
  note: string | null;
};

type RelationValue<T> = T | T[] | null;

function firstRelation<T>(value: RelationValue<T> | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

type DbCaseRow = {
  id: string;
  source_case_id: string;
  source_institution_name: string | null;
  data_source: RelationValue<{ code: string }>;
  institution: RelationValue<{ name: string; state: string; region: string }>;
  category: RelationValue<{ name: string }>;
  institution_id: string | null;
  category_id: string | null;
  receiving_bureau: string;
  current_bureau: string;
  assigned_officer_id: string | null;
  status: string;
  received_at: string;
  source_updated_at: string | null;
  expected_disposal_at: string | null;
  source_revision: string | null;
  referral_reference: string | null;
  restricted: boolean;
  actions: DbActionRow[] | null;
};

type DbRelationshipRow = {
  source_case_id: string;
  related_case_id: string;
  relationship_type: SourceCase["relationships"][number]["type"];
};

async function loadLiveCases(): Promise<SourceCase[]> {
  const client = requireSupabase();
  const [caseResult, relationshipResult] = await Promise.all([
    client
      .from("source_cases")
      .select(
        "id,source_case_id,source_institution_name,data_source:data_sources!source_cases_data_source_fk(code),institution:institutions!source_cases_institution_fk(name,state,region),category:complaint_categories!source_cases_category_fk(name),institution_id,category_id,receiving_bureau,current_bureau,assigned_officer_id,status,received_at,source_updated_at,expected_disposal_at,source_revision,referral_reference,restricted,actions:case_actions!case_actions_source_case_fk(id,occurred_at,bureau,label,source_reference,note)",
      )
      .order("received_at", { ascending: false }),
    client
      .from("case_relationships")
      .select("source_case_id,related_case_id,relationship_type"),
  ]);

  const rows = requiredResult(
    caseResult,
    "Could not load source cases",
  ) as unknown as DbCaseRow[];
  const relationships = requiredResult(
    relationshipResult,
    "Could not load case relationships",
  ) as DbRelationshipRow[];
  const relationshipsByCase = new Map<string, DbRelationshipRow[]>();
  for (const relation of relationships) {
    const current = relationshipsByCase.get(relation.source_case_id) ?? [];
    current.push(relation);
    relationshipsByCase.set(relation.source_case_id, current);
  }

  return rows.map((row) => {
    const dataSource = firstRelation(row.data_source);
    const institution = firstRelation(row.institution);
    const category = firstRelation(row.category);
    const sourceBureau = bureau(dataSource?.code);
    return {
      id: row.id,
      sourceCaseId: row.source_case_id,
      source: sourceBureau,
      rawSource: dataSource?.code ?? undefined,
      receivingBureau: bureau(row.receiving_bureau),
      rawReceivingBureau: row.receiving_bureau,
      currentBureau: bureau(row.current_bureau),
      rawCurrentBureau: row.current_bureau,
      institutionId: row.institution_id,
      institutionName:
        institution?.name ||
        row.source_institution_name ||
        "Unresolved institution identity",
      category: category?.name ?? "Unmapped category",
      status: status(row.status),
      rawStatus: row.status,
      assignedOfficer: row.assigned_officer_id ?? undefined,
      receivedAt: row.received_at,
      lastUpdatedAt: row.source_updated_at ?? row.received_at,
      expectedDisposalAt: row.expected_disposal_at ?? undefined,
      freshness: freshness(row.source_updated_at),
      sourceRevision: row.source_revision ?? undefined,
      referralReference: row.referral_reference ?? undefined,
      restricted: row.restricted,
      actions: (row.actions ?? []).map((action) => ({
        id: action.id,
        occurredAt: action.occurred_at,
        bureau: bureau(action.bureau),
        label: action.label,
        sourceReference: action.source_reference ?? undefined,
        note: action.note ?? undefined,
      })),
      relationships: (relationshipsByCase.get(row.id) ?? []).map((relation) => ({
        caseId: relation.related_case_id,
        type: relation.relationship_type,
        label: relation.relationship_type.replaceAll("_", " "),
      })),
    };
  });
}

async function loadLiveInstitutions(): Promise<Institution[]> {
  const client = requireSupabase();
  const result = await client
    .from("institutions")
    .select(
      "id,aicte_permanent_id,name,address,state,region,identity_state,source_labels,aliases:institution_aliases(alias),cases:source_cases(count)",
    )
    .order("name");
  return (requiredResult(result, "Could not load institutions") as DbInstitutionRow[]).map(
    mapInstitution,
  );
}

type DbCoordinationRow = {
  id: string;
  institution_id: string | null;
  suggested_relationship: string;
  matching_evidence: string[] | null;
  conflicting_evidence: string[] | null;
  missing_information: string[] | null;
  rule_version: string;
  review_status: CoordinationItem["reviewStatus"];
  review_decision: ReviewDecision | null;
  assigned_reviewer_id: string | null;
  rationale: string | null;
  suggested_decision: ReviewDecision;
  created_at: string;
  updated_at: string;
};

type DbCoordinationCaseRow = {
  coordination_item_id: string;
  source_case_id: string;
};

async function loadLiveCoordinationItems(): Promise<CoordinationItem[]> {
  const client = requireSupabase();
  const [itemsResult, linksResult, cases] = await Promise.all([
    client
      .from("coordination_items")
      .select(
        "id,institution_id,suggested_relationship,matching_evidence,conflicting_evidence,missing_information,rule_version,review_status,review_decision,assigned_reviewer_id,rationale,suggested_decision,created_at,updated_at",
      )
      .order("updated_at", { ascending: false }),
    client
      .from("coordination_item_cases")
      .select("coordination_item_id,source_case_id"),
    loadLiveCases(),
  ]);
  const items = requiredResult(
    itemsResult,
    "Could not load coordination items",
  ) as DbCoordinationRow[];
  const links = requiredResult(
    linksResult,
    "Could not load coordination item cases",
  ) as DbCoordinationCaseRow[];
  const casesById = new Map(cases.map((sourceCase) => [sourceCase.id, sourceCase]));
  const linksByItem = new Map<string, string[]>();
  for (const link of links) {
    const current = linksByItem.get(link.coordination_item_id) ?? [];
    current.push(link.source_case_id);
    linksByItem.set(link.coordination_item_id, current);
  }
  const institutions = await loadLiveInstitutions();
  const institutionsById = new Map(
    institutions.map((institution) => [institution.id, institution]),
  );

  return items.map((row) => {
    const caseIds = linksByItem.get(row.id) ?? [];
    const involvedCases = caseIds
      .map((caseId) => casesById.get(caseId))
      .filter((sourceCase): sourceCase is SourceCase => Boolean(sourceCase));
    const institution = row.institution_id
      ? institutionsById.get(row.institution_id)
      : undefined;
    return {
      id: row.id,
      institutionId: row.institution_id,
      institutionName:
        institution?.name ??
        involvedCases[0]?.institutionName ??
        "Unresolved institution identity",
      caseIds,
      cases: involvedCases,
      bureaus: [...new Set(involvedCases.map((sourceCase) => sourceCase.source))],
      suggestedRelationship: row.suggested_relationship,
      matchingEvidence: row.matching_evidence ?? [],
      conflictingEvidence: row.conflicting_evidence ?? [],
      missingInformation: row.missing_information ?? [],
      freshness: involvedCases.some((sourceCase) => sourceCase.freshness === "stale")
        ? "stale"
        : involvedCases.length === 0
          ? "unknown"
          : "fresh",
      ruleVersion: row.rule_version,
      reviewStatus: row.review_status,
      reviewDecision: row.review_decision ?? undefined,
      assignedReviewer: row.assigned_reviewer_id ?? undefined,
      rationale: row.rationale ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      suggestedDecision: row.suggested_decision,
    };
  });
}

function buildDashboard(
  cases: SourceCase[],
  institutions: Institution[],
  coordinationItems: CoordinationItem[],
  reliability: ReliabilitySnapshot,
): DashboardSnapshot {
  const total = cases.length;
  const unmappedCount = cases.filter((sourceCase) => sourceCase.status === "Unmapped").length;
  const statusCounts: DashboardSnapshot["statusCounts"] = [
    "Pending",
    "Under Process",
    "Disposed",
    "Transferred",
    ...(unmappedCount > 0 ? ["Unmapped" as const] : []),
  ].map((caseStatus) => ({
    status: caseStatus as CaseStatus,
    count: cases.filter((sourceCase) => sourceCase.status === caseStatus).length,
  }));
  const openItems = coordinationItems.filter(
    (item) => item.reviewStatus === "open",
  );
  const now = Date.now();
  const overdue = cases.filter(
    (sourceCase) =>
      sourceCase.status !== "Disposed" &&
      sourceCase.expectedDisposalAt &&
      new Date(sourceCase.expectedDisposalAt).getTime() < now,
  ).length;
  const monthCounts = new Map<string, number>();
  for (const sourceCase of cases) {
    const month = sourceCase.receivedAt.slice(0, 7);
    monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
  }
  const monthlyTrend = [...monthCounts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-7)
    .map(([month, count]) => ({ month, count }));
  const sourceFreshness = (["RB", "PGRC"] as const).map((sourceBureau) => {
    const source = reliability.sources.find(
      (entry) => entry.bureau === sourceBureau,
    );
    return {
      bureau: sourceBureau,
      label: source?.connectionState === "simulated" ? "Simulated source" : source?.name ?? sourceBureau,
      state:
        source?.connectionState === "simulated"
          ? "unknown"
          : source?.lastSuccessfulSync
            ? freshness(source.lastSuccessfulSync)
            : "unknown",
    } as DashboardSnapshot["reliability"]["sourceFreshness"][number];
  });

  return {
    metrics: {
      totalSourceCases: total,
      pendingCases: cases.filter((sourceCase) => sourceCase.status === "Pending").length,
      underProcessCases: cases.filter((sourceCase) => sourceCase.status === "Under Process").length,
      disposedCases: cases.filter((sourceCase) => sourceCase.status === "Disposed").length,
      transferredCases: cases.filter((sourceCase) => sourceCase.status === "Transferred").length,
      overdueCases: overdue,
      potentialOverlapAlerts: openItems.filter(
        (item) =>
          item.suggestedDecision === "potential_parallel_action" ||
          item.suggestedDecision === "confirmed_same_matter",
      ).length,
      unresolvedInstitutionIdentities: institutions.filter(
        (institution) => institution.identityState === "unresolved",
      ).length + cases.filter((sourceCase) => !sourceCase.institutionId).length,
    },
    statusCounts,
    bureauCounts: (["RB", "PGRC"] as const).map((sourceBureau) => ({
      bureau: sourceBureau,
      count: cases.filter((sourceCase) => sourceCase.currentBureau === sourceBureau).length,
    })),
    monthlyTrend,
    recentUpdates: [...cases]
      .sort(
        (left, right) =>
          new Date(right.lastUpdatedAt).getTime() -
          new Date(left.lastUpdatedAt).getTime(),
      )
      .slice(0, 6),
    priorityItems: openItems.slice(0, 5),
    reliability: {
      staleCases: cases.filter((sourceCase) => sourceCase.freshness === "stale").length,
      unresolvedIssues:
        reliability.discrepancies.filter((issue) => issue.state === "open").length +
        unmappedCount,
      sourceFreshness,
    },
  };
}

function demoReliability(): ReliabilitySnapshot {
  const staleCases = demoCases.filter((sourceCase) => sourceCase.freshness === "stale");
  return {
    sources: (["RB", "PGRC"] as const).map((sourceBureau) => ({
      bureau: sourceBureau,
      name:
        sourceBureau === "RB"
          ? "Regulation Bureau demonstration source"
          : "Public Grievance Redressal Cell demonstration source",
      connectionState: "simulated",
      lastSuccessfulSync: null,
      lastAttemptedSync: null,
      received: demoCases.filter((sourceCase) => sourceCase.source === sourceBureau).length,
      processed: demoCases.filter((sourceCase) => sourceCase.source === sourceBureau).length,
      quarantined: sourceBureau === "PGRC" ? 2 : 1,
      unresolvedDiscrepancies: staleCases.filter(
        (sourceCase) => sourceCase.source === sourceBureau,
      ).length,
      coverageLimitations: [
        "Synthetic demonstration records only; no bureau system is connected.",
        "No source document bytes or personal complainant details are included.",
      ],
    })),
    discrepancies: [
      {
        id: "demo-issue-stale-rb",
        source: "RB",
        caseId: "SIM-0019",
        type: "Stale source observation",
        detail: "The simulated source update exceeds the freshness threshold.",
        state: "open",
      },
      {
        id: "demo-issue-history",
        source: "PGRC",
        caseId: "SIM-0012",
        type: "Incomplete action history",
        detail: "No action history was received for this simulated source record.",
        state: "open",
      },
      {
        id: "demo-issue-unresolved",
        source: "PGRC",
        caseId: "SIM-0077",
        type: "Unresolved institution mapping",
        detail: "The simulated source record does not include a verified institution identifier.",
        state: "open",
      },
    ],
    coverageNotes: [
      "RB and PGRC are illustrative simulated connectors. No AICTE system connection exists.",
      "Source coverage, freshness and reconciliation counts are calculated from synthetic records.",
      "A shared institution, matter or date window is a candidate signal, not a duplicate finding.",
    ],
  };
}

function demoAdministration(): AdministrationSnapshot {
  const baseUsers: AdministrationSnapshot["users"] = [
      {
        id: "demo-user-1",
        displayName: "Demo Administrator",
        email: "admin@example.invalid",
        role: "administrator",
        approvalStatus: "approved",
      },
      {
        id: "demo-user-2",
        displayName: "Demo Bureau Reviewer",
        email: "reviewer@example.invalid",
        role: "bureau_officer",
        approvalStatus: "approved",
        bureau: "RB",
      },
      {
        id: "demo-user-3",
        displayName: "Demo Regional Officer",
        email: "regional@example.invalid",
        role: "regional_officer",
        approvalStatus: "pending",
        region: "North",
      },
      {
        id: "demo-user-4",
        displayName: "Demo Read-Only Viewer",
        email: "viewer@example.invalid",
        role: "read_only_viewer",
        approvalStatus: "approved",
      },
    ];
  const userOverrides = readDemoJson<
    Record<string, Partial<AdministrationSnapshot["users"][number]>>
  >(DEMO_ADMIN_USERS_KEY, {});
  const baseMappings: AdministrationSnapshot["mappings"] = [
      { sourceValue: "Under process", canonicalValue: "Under Process", mappingType: "status" },
      { sourceValue: "Disposed", canonicalValue: "Disposed", mappingType: "status" },
      { sourceValue: "Transferred to RB", canonicalValue: "Transferred", mappingType: "status" },
      { sourceValue: "Academic quality", canonicalValue: "Academic Standards", mappingType: "category" },
    ];
  const mappingOverrides = readDemoJson<AdministrationSnapshot["mappings"]>(
    DEMO_ADMIN_MAPPINGS_KEY,
    [],
  );
  const mapped = new Map(
    [...baseMappings, ...mappingOverrides].map((mapping) => [
      `${mapping.mappingType}:${mapping.sourceValue}`,
      mapping,
    ]),
  );
  const recentAudit = readDemoJson<AdministrationSnapshot["auditEvents"]>(
    DEMO_ADMIN_AUDIT_KEY,
    [],
  );
  return {
    users: baseUsers.map((user) => ({ ...user, ...userOverrides[user.id] })),
    mappings: [...mapped.values()],
    auditEvents: [
      ...recentAudit,
      {
        id: "demo-audit-1",
        actor: "Demo Administrator",
        action: "Reviewed source mapping",
        target: "RB status: Under process",
        occurredAt: demoDateOffset(-2),
      },
      {
        id: "demo-audit-2",
        actor: DEMO_REVIEWER,
        action: "Recorded coordination review",
        target: "SIM-0003 ↔ SIM-0022",
        occurredAt: demoDateOffset(-12),
      },
    ],
    ruleVersions: [
      {
        version: "NEXUS-RULES-0.4",
        name: "Evidence-first candidate generation",
        description: "Deterministic rules; candidate signals require human review.",
        active: true,
      },
      {
        version: "NEXUS-RULES-0.3",
        name: "Referral lineage",
        description: "Separates formal referrals from potential parallel actions.",
        active: false,
      },
    ],
  };
}

export async function listInstitutions(
  filters: InstitutionFilters = {},
): Promise<Institution[]> {
  if (isDemoMode()) return filterInstitutions(demoInstitutions, filters);
  const institutions = await loadLiveInstitutions();
  return filterInstitutions(institutions, filters);
}

export async function getInstitution(id: string): Promise<Institution | null> {
  const institutions = await listInstitutions();
  return institutions.find((institution) => institution.id === id) ?? null;
}

export async function listCases(filters: CaseFilters = {}): Promise<SourceCase[]> {
  if (isDemoMode()) return filterCases(demoCases, filters, demoInstitutions);
  const [cases, institutions] = await Promise.all([
    loadLiveCases(),
    loadLiveInstitutions(),
  ]);
  return filterCases(cases, filters, institutions);
}

export async function getCase(id: string): Promise<SourceCase | null> {
  const cases = await listCases();
  return cases.find((sourceCase) => sourceCase.id === id) ?? null;
}

export async function listCoordinationItems(
  filters: { reviewStatus?: string } = {},
): Promise<CoordinationItem[]> {
  const items = isDemoMode()
    ? getDemoCoordinationItems()
    : await loadLiveCoordinationItems();
  return filters.reviewStatus
    ? items.filter((item) => item.reviewStatus === filters.reviewStatus)
    : items;
}

export async function submitCoordinationReview(input: {
  itemId: string;
  decision: ReviewDecision;
  rationale: string;
  expectedUpdatedAt: string;
}): Promise<CoordinationReview> {
  const rationale = input.rationale.trim();
  if (rationale.length < 12) {
    throw new Error("Add a review rationale of at least 12 characters.");
  }

  if (isDemoMode()) {
    const items = getDemoCoordinationItems();
    const item = items.find((entry) => entry.id === input.itemId);
    if (!item) throw new Error("Coordination item was not found.");
    if (item.reviewStatus !== "open" || item.updatedAt !== input.expectedUpdatedAt) {
      throw new Error("This item changed or was reviewed by another user. Refresh before reviewing.");
    }
    const review: CoordinationReview = {
      decision: input.decision,
      rationale,
      reviewer: DEMO_REVIEWER,
      reviewedAt: new Date().toISOString(),
    };
    const reviews = getDemoReviews();
    reviews[item.id] = review;
    window.localStorage.setItem(DEMO_REVIEW_KEY, JSON.stringify(reviews));

    const newNotif: NexusNotification = {
      id: `demo-notif-rev-${Date.now()}`,
      recipientId: "demo-user-1",
      type: "coordination_reviewed",
      title: "Coordination Review Recorded",
      message: `A human decision (${input.decision.replaceAll("_", " ")}) was recorded for ${item.institutionName}.`,
      entityType: "coordination_item",
      entityId: item.id,
      destinationPath: `/coordination?item=${item.id}`,
      createdAt: new Date().toISOString(),
      readAt: null,
      isSimulated: true,
      dedupeKey: `demo-rev-${item.id}-${Date.now()}`,
    };
    const currentNotifs = getDemoNotifications();
    currentNotifs.unshift(newNotif);
    window.localStorage.setItem(DEMO_NOTIFICATIONS_KEY, JSON.stringify(currentNotifs.slice(0, 30)));

    return review;
  }

  const client = requireSupabase();
  const { data, error } = await client.rpc("submit_coordination_review", {
    p_item_id: input.itemId,
    p_decision: input.decision,
    p_rationale: rationale,
    p_expected_updated_at: input.expectedUpdatedAt,
  });
  if (error) throw new Error(error.message);
  const review = data as {
    decision: ReviewDecision;
    rationale: string;
    reviewer: string;
    reviewed_at: string;
  };
  return {
    decision: review.decision,
    rationale: review.rationale,
    reviewer: review.reviewer,
    reviewedAt: review.reviewed_at,
  };
}

export async function getDashboard(): Promise<DashboardSnapshot> {
  if (isDemoMode()) {
    return buildDashboard(
      demoCases,
      demoInstitutions,
      getDemoCoordinationItems(),
      demoReliability(),
    );
  }
  const [cases, institutions, items, reliability] = await Promise.all([
    loadLiveCases(),
    loadLiveInstitutions(),
    loadLiveCoordinationItems(),
    getReliability(),
  ]);
  return buildDashboard(cases, institutions, items, reliability);
}

export async function getTimeline(): Promise<TimelineEvent[]> {
  const cases = await listCases();
  const events: TimelineEvent[] = [];
  for (const sourceCase of cases) {
    for (const action of sourceCase.actions) {
      events.push({
        id: action.id,
        occurredAt: action.occurredAt,
        caseId: sourceCase.id,
        sourceCaseId: sourceCase.sourceCaseId,
        bureau: action.bureau,
        title: action.label,
        description: action.note ?? "Source-attributed action history.",
        relationType: "source_update",
        sourceReference: action.sourceReference,
      });
    }
    for (const relationship of sourceCase.relationships) {
      events.push({
        id: `${sourceCase.id}-${relationship.caseId}-${relationship.type}`,
        occurredAt: sourceCase.lastUpdatedAt,
        caseId: sourceCase.id,
        sourceCaseId: sourceCase.sourceCaseId,
        bureau: sourceCase.source,
        title: relationship.label,
        description: `Explicit source relationship to ${relationship.caseId}.`,
        relationType: relationship.type,
        sourceReference: sourceCase.referralReference,
      });
    }
  }
  return events.sort(
    (left, right) =>
      new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
  );
}

function monthlyCounts(cases: SourceCase[]) {
  const counts = new Map<string, number>();
  for (const sourceCase of cases) {
    const month = sourceCase.receivedAt.slice(0, 7);
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-7)
    .map(([month, count]) => ({ month, count }));
}

export async function getAnalytics(): Promise<AnalyticsSnapshot> {
  const [cases, institutions, items] = await Promise.all([
    listCases(),
    listInstitutions(),
    listCoordinationItems(),
  ]);
  const activeCases = cases.filter((sourceCase) => sourceCase.status !== "Disposed");
  const age = (sourceCase: SourceCase) =>
    (Date.now() - new Date(sourceCase.receivedAt).getTime()) / 86_400_000;
  const outcomes: Array<{ decision: ReviewDecision; label: string; count: number }> = [
    ["confirmed_same_matter", "Confirmed same matter"],
    ["related_but_distinct", "Related but distinct"],
    ["legitimate_procedural_progression", "Legitimate progression"],
    ["potential_parallel_action", "Potential parallel action"],
    ["insufficient_evidence", "Insufficient evidence"],
    ["dismissed_suggestion", "Dismissed suggestion"],
  ].map(([decision, label]) => ({
    decision: decision as ReviewDecision,
    label: label as string,
    count: items.filter((item) => item.reviewDecision === decision).length,
  }));

  return {
    ageingBuckets: [
      { label: "0–30 days", count: activeCases.filter((sourceCase) => age(sourceCase) <= 30).length },
      { label: "31–60 days", count: activeCases.filter((sourceCase) => age(sourceCase) > 30 && age(sourceCase) <= 60).length },
      { label: "61–90 days", count: activeCases.filter((sourceCase) => age(sourceCase) > 60 && age(sourceCase) <= 90).length },
      { label: "90+ days", count: activeCases.filter((sourceCase) => age(sourceCase) > 90).length },
    ],
    disposalRate:
      cases.length === 0
        ? 0
        : Math.round((cases.filter((sourceCase) => sourceCase.status === "Disposed").length / cases.length) * 100),
    currentBureauCounts: (["RB", "PGRC"] as const).map((sourceBureau) => ({
      bureau: sourceBureau,
      count: cases.filter((sourceCase) => sourceCase.currentBureau === sourceBureau).length,
    })),
    overlapCounts: [
      {
        label: "Open potential parallel actions",
        count: items.filter(
          (item) =>
            item.reviewStatus === "open" &&
            item.suggestedDecision === "potential_parallel_action",
        ).length,
      },
      {
        label: "Open identity reviews",
        count: items.filter(
          (item) => item.reviewStatus === "open" && !item.institutionId,
        ).length,
      },
      {
        label: "Procedural progressions",
        count: items.filter(
          (item) =>
            item.suggestedDecision === "legitimate_procedural_progression" ||
            item.reviewDecision === "legitimate_procedural_progression",
        ).length,
      },
    ],
    reviewOutcomes: outcomes,
    unresolvedMappings: institutions.filter(
      (institution) => institution.identityState !== "verified",
    ).length + cases.filter((sourceCase) => !sourceCase.institutionId).length,
    sourceCoverage: (["RB", "PGRC"] as const).map((sourceBureau) => {
      const sourceCases = cases.filter((sourceCase) => sourceCase.source === sourceBureau);
      const mapped = sourceCases.filter((sourceCase) => sourceCase.institutionId).length;
      return {
        bureau: sourceBureau,
        coverage: sourceCases.length === 0 ? 0 : Math.round((mapped / sourceCases.length) * 100),
        label: "Cases with a linked institution identity",
      };
    }),
    monthlyTrend: monthlyCounts(cases),
  };
}

export async function getReliability(): Promise<ReliabilitySnapshot> {
  if (isDemoMode()) return demoReliability();
  const client = requireSupabase();
  const [sourcesResult, runsResult, issuesResult] = await Promise.all([
    client
      .from("data_sources")
      .select("id,code,name,connection_state,last_successful_sync,last_attempted_sync")
      .order("code"),
    client
      .from("ingestion_runs")
      .select("data_source_id,records_received,records_processed,records_quarantined,started_at,completed_at")
      .order("started_at", { ascending: false }),
    client
      .from("reconciliation_issues")
      .select("id,data_source_id,source_case_id,issue_type,detail,state")
      .order("created_at", { ascending: false }),
  ]);
  const sources = requiredResult(sourcesResult, "Could not load sources") as Array<{
    id: string;
    code: string;
    name: string;
    connection_state: ReliabilitySnapshot["sources"][number]["connectionState"];
    last_successful_sync: string | null;
    last_attempted_sync: string | null;
  }>;
  const runs = requiredResult(runsResult, "Could not load ingestion runs") as Array<{
    data_source_id: string;
    records_received: number;
    records_processed: number;
    records_quarantined: number;
    started_at: string;
    completed_at: string | null;
  }>;
  const issues = requiredResult(issuesResult, "Could not load reconciliation issues") as Array<{
    id: string;
    data_source_id: string;
    source_case_id: string | null;
    issue_type: string;
    detail: string;
    state: "open" | "resolved";
  }>;
  const latestRunBySource = new Map<string, (typeof runs)[number]>();
  for (const run of runs) {
    if (!latestRunBySource.has(run.data_source_id)) {
      latestRunBySource.set(run.data_source_id, run);
    }
  }
  return {
    sources: sources.map((source) => {
      const latest = latestRunBySource.get(source.id);
      const relatedIssues = issues.filter((issue) => issue.data_source_id === source.id);
      return {
        bureau: bureau(source.code),
        name: source.name,
        connectionState: source.connection_state,
        lastSuccessfulSync: source.last_successful_sync,
        lastAttemptedSync: source.last_attempted_sync,
        received: latest?.records_received ?? 0,
        processed: latest?.records_processed ?? 0,
        quarantined: latest?.records_quarantined ?? 0,
        unresolvedDiscrepancies: relatedIssues.filter((issue) => issue.state === "open").length,
        coverageLimitations:
          source.connection_state === "simulated"
            ? ["Simulated source; no bureau system is connected."]
            : [],
      };
    }),
    discrepancies: issues.map((issue) => ({
      id: issue.id,
      source:
        bureau(sources.find((source) => source.id === issue.data_source_id)?.code),
      caseId: issue.source_case_id ?? undefined,
      type: issue.issue_type,
      detail: issue.detail,
      state: issue.state,
    })),
    coverageNotes: [
      "Source connection state is configured by an administrator; simulated sources are not operational integrations.",
      "Freshness is calculated from the last source-attributed update. Missing updates are not treated as proof of no activity.",
    ],
  };
}

export async function getAdministration(): Promise<AdministrationSnapshot> {
  if (isDemoMode()) return demoAdministration();
  const client = requireSupabase();
  const [profilesResult, mappingsResult, auditResult, rulesResult] = await Promise.all([
    client
      .from("profiles")
      .select("id,display_name,email,role,approval_status,region,bureau")
      .order("created_at", { ascending: false }),
    client.from("status_mappings").select("source_value,canonical_value,mapping_type").order("mapping_type"),
    client
      .from("audit_events")
      .select("id,actor_profile_id,action,target,created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    client
      .from("rule_versions")
      .select("version,name,description,active")
      .order("created_at", { ascending: false }),
  ]);
  const profiles = requiredResult(profilesResult, "Could not load user roles") as Array<{
    id: string;
    display_name: string | null;
    email: string;
    role: string;
    approval_status: string;
    region: string | null;
    bureau: string | null;
  }>;
  const mappings = requiredResult(mappingsResult, "Could not load mappings") as Array<{
    source_value: string;
    canonical_value: string;
    mapping_type: string;
  }>;
  const audits = requiredResult(auditResult, "Could not load audit events") as Array<{
    id: string;
    actor_profile_id: string | null;
    action: string;
    target: string;
    created_at: string;
  }>;
  const rules = requiredResult(rulesResult, "Could not load rule versions") as Array<{
    version: string;
    name: string;
    description: string;
    active: boolean;
  }>;
  return {
    users: profiles.map((profile) => ({
      id: profile.id,
      displayName: profile.display_name ?? "User",
      email: profile.email,
      role: profile.role,
      approvalStatus: profile.approval_status,
      region: profile.region ?? undefined,
      bureau: profile.bureau ?? undefined,
    })),
    mappings: mappings.map((mapping) => ({
      sourceValue: mapping.source_value,
      canonicalValue: mapping.canonical_value,
      mappingType: mapping.mapping_type,
    })),
    auditEvents: audits.map((event) => ({
      id: event.id,
      actor: event.actor_profile_id ?? "System",
      action: event.action,
      target: event.target,
      occurredAt: event.created_at,
    })),
    ruleVersions: rules,
  };
}

export async function updateProfileAccess(input: {
  userId: string;
  role: "administrator" | "bureau_officer" | "regional_officer" | "read_only_viewer";
  approvalStatus: "pending" | "approved" | "suspended";
  region?: string;
  bureau?: Bureau;
}): Promise<AdministrationSnapshot["users"][number]> {
  if (input.role === "regional_officer" && !input.region?.trim()) {
    throw new Error("Assign a region to regional officers.");
  }
  if (input.role === "bureau_officer" && !input.bureau) {
    throw new Error("Assign a bureau to bureau officers.");
  }

  if (isDemoMode()) {
    const snapshot = demoAdministration();
    const current = snapshot.users.find((user) => user.id === input.userId);
    if (!current) throw new Error("Demo user was not found.");
    const isLastApprovedAdmin =
      current.role === "administrator" &&
      current.approvalStatus === "approved" &&
      (input.role !== "administrator" || input.approvalStatus !== "approved") &&
      snapshot.users.filter(
        (user) => user.role === "administrator" && user.approvalStatus === "approved",
      ).length <= 1;
    if (isLastApprovedAdmin) {
      throw new Error("At least one approved administrator must remain.");
    }
    const updated = {
      ...current,
      role: input.role,
      approvalStatus: input.approvalStatus,
      region: input.region?.trim() || undefined,
      bureau: input.bureau,
    };
    const overrides = readDemoJson<
      Record<string, Partial<AdministrationSnapshot["users"][number]>>
    >(DEMO_ADMIN_USERS_KEY, {});
    overrides[input.userId] = updated;
    window.localStorage.setItem(DEMO_ADMIN_USERS_KEY, JSON.stringify(overrides));
    const audit = readDemoJson<AdministrationSnapshot["auditEvents"]>(
      DEMO_ADMIN_AUDIT_KEY,
      [],
    );
    audit.unshift({
      id: `demo-admin-${Date.now()}`,
      actor: "Demo Administrator",
      action: "Updated simulated role access",
      target: `${updated.displayName}: ${updated.role} / ${updated.approvalStatus}`,
      occurredAt: new Date().toISOString(),
    });
    window.localStorage.setItem(DEMO_ADMIN_AUDIT_KEY, JSON.stringify(audit.slice(0, 20)));

    const newNotif: NexusNotification = {
      id: `demo-notif-access-${Date.now()}`,
      recipientId: input.userId,
      type: "access_updated",
      title: "Account Access Updated",
      message: `Access assigned: ${input.role.replaceAll("_", " ")} (Approval: ${input.approvalStatus}).`,
      entityType: "profile",
      entityId: input.userId,
      destinationPath: "/administration",
      createdAt: new Date().toISOString(),
      readAt: null,
      isSimulated: true,
      dedupeKey: `demo-access-${input.userId}-${Date.now()}`,
    };
    const currentNotifs = getDemoNotifications();
    currentNotifs.unshift(newNotif);
    window.localStorage.setItem(DEMO_NOTIFICATIONS_KEY, JSON.stringify(currentNotifs.slice(0, 30)));

    return updated;
  }

  const client = requireSupabase();
  const { data, error } = await client.rpc("admin_update_profile_role", {
    p_user_id: input.userId,
    p_role: input.role,
    p_approval_status: input.approvalStatus,
    p_region: input.region?.trim() || null,
    p_bureau: input.bureau ?? null,
  });
  if (error) throw new Error(error.message);
  const profile = data as {
    id: string;
    display_name: string | null;
    email: string;
    role: string;
    approval_status: string;
    region: string | null;
    bureau: string | null;
  };
  return {
    id: profile.id,
    displayName: profile.display_name ?? "User",
    email: profile.email,
    role: profile.role,
    approvalStatus: profile.approval_status,
    region: profile.region ?? undefined,
    bureau: profile.bureau ?? undefined,
  };
}

export async function upsertStatusMapping(input: {
  sourceValue: string;
  canonicalValue: string;
  mappingType: "status" | "category" | "bureau";
}): Promise<AdministrationSnapshot["mappings"][number]> {
  if (!input.sourceValue.trim() || !input.canonicalValue.trim()) {
    throw new Error("Enter both the source value and canonical value.");
  }
  if (isDemoMode()) {
    const current = demoAdministration().mappings;
    const mapping = {
      sourceValue: input.sourceValue.trim(),
      canonicalValue: input.canonicalValue.trim(),
      mappingType: input.mappingType,
    };
    const overrides = current.filter(
      (entry) =>
        entry.sourceValue !== mapping.sourceValue ||
        entry.mappingType !== mapping.mappingType,
    );
    overrides.push(mapping);
    window.localStorage.setItem(DEMO_ADMIN_MAPPINGS_KEY, JSON.stringify(overrides));
    const audit = readDemoJson<AdministrationSnapshot["auditEvents"]>(
      DEMO_ADMIN_AUDIT_KEY,
      [],
    );
    audit.unshift({
      id: `demo-mapping-${Date.now()}`,
      actor: "Demo Administrator",
      action: "Updated simulated source mapping",
      target: `${mapping.mappingType}: ${mapping.sourceValue} → ${mapping.canonicalValue}`,
      occurredAt: new Date().toISOString(),
    });
    window.localStorage.setItem(DEMO_ADMIN_AUDIT_KEY, JSON.stringify(audit.slice(0, 20)));
    return mapping;
  }

  const client = requireSupabase();
  const { data, error } = await client.rpc("admin_upsert_status_mapping", {
    p_source_value: input.sourceValue.trim(),
    p_canonical_value: input.canonicalValue.trim(),
    p_mapping_type: input.mappingType,
  });
  if (error) throw new Error(error.message);
  const mapping = data as {
    source_value: string;
    canonical_value: string;
    mapping_type: string;
  };
  return {
    sourceValue: mapping.source_value,
    canonicalValue: mapping.canonical_value,
    mappingType: mapping.mapping_type,
  };
}

export function resetSimulatedChanges() {
  window.localStorage.removeItem(DEMO_REVIEW_KEY);
  window.localStorage.removeItem(DEMO_ADMIN_USERS_KEY);
  window.localStorage.removeItem(DEMO_ADMIN_MAPPINGS_KEY);
  window.localStorage.removeItem(DEMO_ADMIN_AUDIT_KEY);
  window.localStorage.removeItem(DEMO_NOTIFICATIONS_KEY);
}

function demoDateOffset(days: number) {
  const date = getDemoAsOf();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

export function getSimulationAsOf() {
  return getDemoAsOf();
}

function getInitialDemoNotifications(): NexusNotification[] {
  return [
    {
      id: "demo-notif-1",
      recipientId: "demo-user-1",
      type: "coordination_available",
      title: "Coordination Item Awaiting Review",
      message: "Candidate cross-bureau overlap for Eastern Institute of Technology (SIM-0008 ↔ SIM-0028) requires evidence review.",
      entityType: "coordination_item",
      entityId: "demo-coord-overlap",
      destinationPath: "/coordination?item=demo-coord-overlap",
      createdAt: demoDateOffset(-2),
      readAt: null,
      dedupeKey: "demo-coord-overlap-avail",
      isSimulated: true,
    },
    {
      id: "demo-notif-2",
      recipientId: "demo-user-1",
      type: "operational_alert",
      title: "Source Freshness Alert: RB",
      message: "Regulation Bureau demonstration source has stale observations exceeding the 30-day freshness threshold.",
      entityType: "data_source",
      entityId: "10000000-0000-4000-8000-000000000001",
      destinationPath: "/reliability",
      createdAt: demoDateOffset(-3),
      readAt: null,
      dedupeKey: "demo-stale-source-rb",
      isSimulated: true,
    },
    {
      id: "demo-notif-3",
      recipientId: "demo-user-1",
      type: "operational_alert",
      title: "Overdue Case: SIM-0016",
      message: "Expected disposal date has passed for North Valley Technical University (SIM-0016).",
      entityType: "case",
      entityId: "SIM-0016",
      destinationPath: "/complaints/SIM-0016",
      createdAt: demoDateOffset(-4),
      readAt: null,
      dedupeKey: "demo-overdue-16",
      isSimulated: true,
    },
    {
      id: "demo-notif-4",
      recipientId: "demo-user-1",
      type: "coordination_reviewed",
      title: "Coordination Review Recorded",
      message: "Demo Bureau Reviewer recorded a decision (legitimate procedural progression) for Eastern Institute of Technology.",
      entityType: "coordination_item",
      entityId: "demo-coord-referral",
      destinationPath: "/coordination?item=demo-coord-referral",
      createdAt: demoDateOffset(-12),
      readAt: demoDateOffset(-11),
      dedupeKey: "demo-coord-referral-reviewed",
      isSimulated: true,
    },
  ];
}

export function getDemoNotifications(): NexusNotification[] {
  try {
    const raw = window.localStorage.getItem(DEMO_NOTIFICATIONS_KEY);
    if (!raw) {
      const initial = getInitialDemoNotifications();
      window.localStorage.setItem(DEMO_NOTIFICATIONS_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw) as NexusNotification[];
  } catch {
    return getInitialDemoNotifications();
  }
}

export async function listNotifications(
  filters: { unreadOnly?: boolean } = {},
): Promise<NexusNotification[]> {
  if (isDemoMode()) {
    let items = getDemoNotifications();
    if (filters.unreadOnly) {
      items = items.filter((item) => !item.readAt);
    }
    return items.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  const client = requireSupabase();
  let query = client
    .from("notifications")
    .select(
      "id, recipient_id, notification_type, title, message, entity_type, entity_id, destination_path, created_at, read_at, dedupe_key",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (filters.unreadOnly) {
    query = query.is("read_at", null);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Could not load notifications: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    recipientId: row.recipient_id,
    type: row.notification_type as NotificationType,
    title: row.title,
    message: row.message,
    entityType: row.entity_type ?? undefined,
    entityId: row.entity_id ?? undefined,
    destinationPath: row.destination_path || "/",
    createdAt: row.created_at,
    readAt: row.read_at,
    dedupeKey: row.dedupe_key ?? undefined,
    isSimulated: false,
  }));
}

export async function getUnreadNotificationCount(): Promise<number> {
  if (isDemoMode()) {
    return getDemoNotifications().filter((item) => !item.readAt).length;
  }
  const client = requireSupabase();
  const { count, error } = await client
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  if (error) throw new Error(`Could not count unread notifications: ${error.message}`);
  return count ?? 0;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  if (isDemoMode()) {
    const notifications = getDemoNotifications();
    const updated = notifications.map((n) =>
      n.id === notificationId ? { ...n, readAt: new Date().toISOString() } : n,
    );
    window.localStorage.setItem(DEMO_NOTIFICATIONS_KEY, JSON.stringify(updated));
    return;
  }
  const client = requireSupabase();
  const { error } = await client.rpc("mark_notification_read", {
    p_notification_id: notificationId,
  });
  if (error) throw new Error(`Could not mark notification read: ${error.message}`);
}

export async function markAllNotificationsRead(): Promise<void> {
  if (isDemoMode()) {
    const notifications = getDemoNotifications();
    const now = new Date().toISOString();
    const updated = notifications.map((n) => (n.readAt ? n : { ...n, readAt: now }));
    window.localStorage.setItem(DEMO_NOTIFICATIONS_KEY, JSON.stringify(updated));
    return;
  }
  const client = requireSupabase();
  const { error } = await client.rpc("mark_all_notifications_read");
  if (error) throw new Error(`Could not mark all notifications read: ${error.message}`);
}

export async function triggerOperationalAlertsCheck(): Promise<number> {
  if (isDemoMode()) {
    return 0;
  }
  const client = requireSupabase();
  const { data, error } = await client.rpc("generate_operational_alerts");
  if (error) {
    console.warn("Could not generate operational alerts:", error.message);
    return 0;
  }
  return Number(data) || 0;
}


