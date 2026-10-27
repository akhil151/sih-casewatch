export type Bureau = "RB" | "PGRC" | "Unmapped";

export type CaseStatus =
  | "Pending"
  | "Under Process"
  | "Disposed"
  | "Transferred"
  | "Unmapped";

export type Freshness = "fresh" | "stale" | "unknown";

export type ReviewDecision =
  | "confirmed_same_matter"
  | "related_but_distinct"
  | "legitimate_procedural_progression"
  | "potential_parallel_action"
  | "insufficient_evidence"
  | "dismissed_suggestion";

export type ReviewStatus = "open" | "reviewed" | "dismissed";

export interface Institution {
  id: string;
  permanentId?: string;
  name: string;
  aliases: string[];
  address?: string;
  state: string;
  region: string;
  identityState: "verified" | "candidate" | "unresolved";
  sourceLabels: string[];
  caseCount: number;
}

export interface CaseAction {
  id: string;
  occurredAt: string;
  bureau: Bureau;
  label: string;
  sourceReference?: string;
  note?: string;
}

export interface CaseRelationship {
  caseId: string;
  type:
    | "formal_referral"
    | "proceeding_stage_of"
    | "action_derived_from"
    | "appeal_of"
    | "potential_same_matter"
    | "confirmed_same_matter"
    | "related_but_distinct";
  label: string;
}

export interface SourceCase {
  id: string;
  sourceCaseId: string;
  source: Bureau;
  rawSource?: string;
  receivingBureau: Bureau;
  rawReceivingBureau?: string;
  currentBureau: Bureau;
  rawCurrentBureau?: string;
  institutionId: string | null;
  institutionName: string;
  category: string;
  status: CaseStatus;
  rawStatus?: string;
  assignedOfficer?: string;
  receivedAt: string;
  lastUpdatedAt: string;
  expectedDisposalAt?: string;
  freshness: Freshness;
  sourceRevision?: string;
  referralReference?: string;
  restricted: boolean;
  actions: CaseAction[];
  relationships: CaseRelationship[];
}

export interface CoordinationItem {
  id: string;
  institutionId: string | null;
  institutionName: string;
  caseIds: string[];
  cases: SourceCase[];
  bureaus: Bureau[];
  suggestedRelationship: string;
  matchingEvidence: string[];
  conflictingEvidence: string[];
  missingInformation: string[];
  freshness: Freshness;
  ruleVersion: string;
  reviewStatus: ReviewStatus;
  reviewDecision?: ReviewDecision;
  assignedReviewer?: string;
  rationale?: string;
  createdAt: string;
  updatedAt: string;
  suggestedDecision: ReviewDecision;
}

export interface CoordinationReview {
  decision: ReviewDecision;
  rationale: string;
  reviewer: string;
  reviewedAt: string;
}

export interface DashboardSnapshot {
  metrics: {
    totalSourceCases: number;
    pendingCases: number;
    underProcessCases: number;
    disposedCases: number;
    transferredCases: number;
    overdueCases: number;
    potentialOverlapAlerts: number;
    unresolvedInstitutionIdentities: number;
  };
  statusCounts: Array<{ status: CaseStatus; count: number }>;
  bureauCounts: Array<{ bureau: Bureau; count: number }>;
  monthlyTrend: Array<{ month: string; count: number }>;
  recentUpdates: SourceCase[];
  priorityItems: CoordinationItem[];
  reliability: {
    staleCases: number;
    unresolvedIssues: number;
    sourceFreshness: Array<{ bureau: Bureau; label: string; state: Freshness }>;
  };
}

export interface TimelineEvent {
  id: string;
  occurredAt: string;
  caseId: string;
  sourceCaseId: string;
  bureau: Bureau;
  title: string;
  description: string;
  relationType: CaseRelationship["type"] | "source_update";
  sourceReference?: string;
}

export interface AnalyticsSnapshot {
  ageingBuckets: Array<{ label: string; count: number }>;
  disposalRate: number;
  currentBureauCounts: Array<{ bureau: Bureau; count: number }>;
  overlapCounts: Array<{ label: string; count: number }>;
  reviewOutcomes: Array<{ decision: ReviewDecision; label: string; count: number }>;
  unresolvedMappings: number;
  sourceCoverage: Array<{ bureau: Bureau; coverage: number; label: string }>;
  monthlyTrend: Array<{ month: string; count: number }>;
}

export interface ReliabilitySource {
  bureau: Bureau;
  name: string;
  connectionState: "simulated" | "connected" | "disconnected";
  lastSuccessfulSync: string | null;
  lastAttemptedSync: string | null;
  received: number;
  processed: number;
  quarantined: number;
  unresolvedDiscrepancies: number;
  coverageLimitations: string[];
}

export interface ReliabilitySnapshot {
  sources: ReliabilitySource[];
  discrepancies: Array<{
    id: string;
    source: Bureau;
    caseId?: string;
    type: string;
    detail: string;
    state: "open" | "resolved";
  }>;
  coverageNotes: string[];
}

export interface AdministrationSnapshot {
  users: Array<{
    id: string;
    displayName: string;
    email: string;
    role: string;
    approvalStatus: string;
    region?: string;
    bureau?: string;
  }>;
  mappings: Array<{ sourceValue: string; canonicalValue: string; mappingType: string }>;
  auditEvents: Array<{
    id: string;
    actor: string;
    action: string;
    target: string;
    occurredAt: string;
  }>;
  ruleVersions: Array<{
    version: string;
    name: string;
    description: string;
    active: boolean;
  }>;
}

export type NotificationType =
  | "coordination_available"
  | "coordination_reviewed"
  | "access_updated"
  | "operational_alert";

export interface NexusNotification {
  id: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  destinationPath: string;
  createdAt: string;
  readAt?: string | null;
  dedupeKey?: string;
  isSimulated?: boolean;
}

