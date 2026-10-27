import type {
  CaseAction,
  CaseRelationship,
  CoordinationItem,
  Institution,
  SourceCase,
} from "@/types/nexus";

const DEMO_AS_OF = new Date("2026-10-27T12:00:00.000Z");

const institutionNames = [
  "National Institute of Technical Studies, Delhi",
  "Eastern Institute of Technology, Kolkata",
  "Eastern Technical Institute, Kolkata",
  "Coastal College of Engineering, Chennai",
  "Saraswati Institute of Applied Sciences, Pune",
  "Deccan School of Engineering, Hyderabad",
  "North Valley Technical University, Jaipur",
  "Riverbend College of Technology, Lucknow",
  "Central Institute for Digital Engineering, Bhopal",
  "Central Institute of Digital Engineering, Indore",
  "Western Polytechnic and Research Centre, Ahmedabad",
  "Sahyadri Institute of Engineering, Bengaluru",
  "Delta College of Technical Education, Vijayawada",
  "Himalayan School of Applied Technology, Dehradun",
  "Meridian Institute of Engineering, Patna",
  "Sunrise Technical College, Guwahati",
  "Pioneer Institute of Technology, Ranchi",
  "Crescent School of Engineering, Kochi",
  "Lakeview College of Technical Studies, Srinagar",
  "Greenfield Institute of Engineering, Raipur",
];

const locations = [
  ["Delhi", "North"],
  ["West Bengal", "East"],
  ["West Bengal", "East"],
  ["Tamil Nadu", "South"],
  ["Maharashtra", "West"],
  ["Telangana", "South"],
  ["Rajasthan", "North"],
  ["Uttar Pradesh", "North"],
  ["Madhya Pradesh", "Central"],
  ["Madhya Pradesh", "Central"],
  ["Gujarat", "West"],
  ["Karnataka", "South"],
  ["Andhra Pradesh", "South"],
  ["Uttarakhand", "North"],
  ["Bihar", "East"],
  ["Assam", "North East"],
  ["Jharkhand", "East"],
  ["Kerala", "South"],
  ["Jammu and Kashmir", "North"],
  ["Chhattisgarh", "Central"],
];

function fixedDate(daysFromDemoDate: number, hour = 10) {
  const result = new Date(DEMO_AS_OF);
  result.setUTCDate(result.getUTCDate() + daysFromDemoDate);
  result.setUTCHours(hour, 0, 0, 0);
  return result.toISOString();
}

function caseId(number: number) {
  return `SIM-${number.toString().padStart(4, "0")}`;
}

export const demoInstitutions: Institution[] = institutionNames.map(
  (name, index) => {
    const institutionNumber = index + 1;
    const [state, region] = locations[index];
    return {
      id: `demo-inst-${institutionNumber.toString().padStart(2, "0")}`,
      permanentId:
        institutionNumber === 15 || institutionNumber === 19
          ? undefined
          : `SIM-AICTE-${(260000 + institutionNumber).toString()}`,
      name,
      aliases:
        institutionNumber === 2
          ? ["Eastern Institute of Technology"]
          : institutionNumber === 10
            ? ["Central Digital Engineering Institute"]
            : institutionNumber === 15
              ? ["Meridian Institute"]
              : [],
      address: `Demonstration campus ${institutionNumber}, ${state}`,
      state,
      region,
      identityState:
        institutionNumber === 15
          ? "unresolved"
          : institutionNumber === 9 || institutionNumber === 10
            ? "candidate"
            : "verified",
      sourceLabels: ["SIMULATED RB", "SIMULATED PGRC"],
      caseCount: 0,
    };
  },
);

const categories = [
  "Academic Standards",
  "Faculty Qualification",
  "Infrastructure Compliance",
  "Student Grievance",
  "Financial Disclosure",
  "Approval Conditions",
  "Examination Governance",
  "Safety and Accessibility",
];

const statusByNumber = [
  "Pending",
  "Under Process",
  "Under Process",
  "Disposed",
  "Transferred",
  "Pending",
] as const;

function sourceActions(
  number: number,
  bureau: "RB" | "PGRC",
  receivedAt: string,
  lastUpdatedAt: string,
): CaseAction[] {
  if (number === 12) return [];

  const actions: CaseAction[] = [
    {
      id: `${caseId(number)}-action-1`,
      occurredAt: receivedAt,
      bureau,
      label: "Source record received",
      sourceReference: `${bureau}-SIM-${number.toString().padStart(4, "0")}`,
      note: "Simulated source observation; the source record remains authoritative.",
    },
  ];

  if (number % 4 !== 0) {
    actions.push({
      id: `${caseId(number)}-action-2`,
      occurredAt: lastUpdatedAt,
      bureau,
      label: number % 3 === 0 ? "Status updated by source" : "Review activity recorded",
      sourceReference: `${bureau}-REV-${number.toString().padStart(4, "0")}`,
    });
  }

  return actions;
}

function sourceRelationships(number: number): CaseRelationship[] {
  if (number === 3) {
    return [
      {
        caseId: caseId(22),
        type: "formal_referral",
        label: "RB action follows documented PGRC referral",
      },
    ];
  }
  if (number === 22) {
    return [
      {
        caseId: caseId(3),
        type: "formal_referral",
        label: "Referred from PGRC source case",
      },
    ];
  }
  return [];
}

export const demoCases: SourceCase[] = Array.from({ length: 80 }, (_, index) => {
  const number = index + 1;
  const bureau: "RB" | "PGRC" = number % 2 === 0 ? "RB" : "PGRC";
  const institutionNumber =
    number === 22 ? 3 : number === 28 ? 8 : ((number - 1) % 20) + 1;
  const institution = demoInstitutions[institutionNumber - 1];
  const status = statusByNumber[(number - 1) % statusByNumber.length];
  const receivedDaysAgo = 12 + ((number * 7) % 135);
  const receivedAt = fixedDate(-receivedDaysAgo, 9 + (number % 6));
  const isStale = number === 19 || number === 47 || number === 67;
  const lastUpdatedAt = isStale
    ? fixedDate(-52 - (number % 13), 11)
    : fixedDate(-((number * 5) % 9), 12);
  const currentBureau =
    status === "Transferred" ? (bureau === "RB" ? "PGRC" : "RB") : bureau;

  let category = categories[(number - 1) % categories.length];
  if (number === 3 || number === 22) category = "Academic Standards";
  if (number === 8 || number === 28) category = "Financial Disclosure";
  if (number === 5) category = "Faculty Qualification";
  if (number === 25) category = "Infrastructure Compliance";

  const referralReference =
    number === 3 || number === 22 ? "SIM-REF-2026-014" : undefined;
  const unresolvedInstitution = number === 77;
  const receivedBureau = bureau;
  const dueAt =
    number % 8 === 0
      ? fixedDate(-4, 17)
      : status === "Disposed"
        ? undefined
        : fixedDate(18 + (number % 22), 17);

  return {
    id: caseId(number),
    sourceCaseId: `SIM-${bureau}-2026-${number.toString().padStart(4, "0")}`,
    source: bureau,
    receivingBureau: receivedBureau,
    currentBureau,
    institutionId: unresolvedInstitution ? null : institution.id,
    institutionName: unresolvedInstitution
      ? "Unverified institute name in submitted source record"
      : institution.name,
    category,
    status,
    assignedOfficer: `Demo Officer ${((number - 1) % 9) + 1}`,
    receivedAt,
    lastUpdatedAt,
    expectedDisposalAt: dueAt,
    freshness: isStale ? "stale" : "fresh",
    sourceRevision: number % 9 === 0 ? undefined : `SIM-REV-${(number % 5) + 1}`,
    referralReference,
    restricted: number === 18,
    actions: sourceActions(number, bureau, receivedAt, lastUpdatedAt),
    relationships: sourceRelationships(number),
  };
});

for (const institution of demoInstitutions) {
  institution.caseCount = demoCases.filter(
    (sourceCase) => sourceCase.institutionId === institution.id,
  ).length;
}

function casesFor(...numbers: number[]) {
  return numbers.map((number) => demoCases[number - 1]);
}

function item(
  id: string,
  caseNumbers: number[],
  options: Partial<CoordinationItem> &
    Pick<CoordinationItem, "suggestedRelationship" | "suggestedDecision">,
): CoordinationItem {
  const involvedCases = casesFor(...caseNumbers);
  const institutionId = involvedCases[0]?.institutionId ?? null;
  const institutionName = involvedCases[0]?.institutionName ?? "Unresolved identity";
  return {
    id,
    institutionId,
    institutionName,
    caseIds: involvedCases.map((sourceCase) => sourceCase.id),
    cases: involvedCases,
    bureaus: [...new Set(involvedCases.map((sourceCase) => sourceCase.source))],
    matchingEvidence: [],
    conflictingEvidence: [],
    missingInformation: [],
    freshness: involvedCases.some((sourceCase) => sourceCase.freshness === "stale")
      ? "stale"
      : "fresh",
    ruleVersion: "NEXUS-RULES-0.4",
    reviewStatus: "open",
    createdAt: fixedDate(-4),
    updatedAt: fixedDate(-1),
    ...options,
  };
}

export const demoCoordinationItems: CoordinationItem[] = [
  item("demo-coord-referral", [3, 22], {
    suggestedRelationship: "Documented procedural progression",
    suggestedDecision: "legitimate_procedural_progression",
    matchingEvidence: [
      "Both source records reference the same verified institution.",
      "The source records share referral SIM-REF-2026-014.",
      "The RB action is timestamped after the PGRC referral.",
    ],
    conflictingEvidence: [],
    missingInformation: [],
    reviewStatus: "reviewed",
    reviewDecision: "legitimate_procedural_progression",
    assignedReviewer: "Demo Bureau Reviewer",
    rationale:
      "The source referral and later RB action indicate a legitimate procedural stage. Keep the bureau actions distinct.",
    createdAt: fixedDate(-14),
    updatedAt: fixedDate(-12),
  }),
  item("demo-coord-overlap", [8, 28], {
    suggestedRelationship: "Potential parallel action",
    suggestedDecision: "potential_parallel_action",
    matchingEvidence: [
      "Same verified institution and complaint category.",
      "Source receipt dates overlap within the configured review window.",
    ],
    conflictingEvidence: [
      "No shared referral, proceeding, or action reference is recorded.",
    ],
    missingInformation: [
      "Underlying source documents have not been compared.",
      "No reviewer has confirmed whether the complaints concern the same matter.",
    ],
  }),
  item("demo-coord-distinct", [5, 25], {
    suggestedRelationship: "Same institution; potentially distinct matters",
    suggestedDecision: "related_but_distinct",
    matchingEvidence: ["Both source records concern the same verified institution."],
    conflictingEvidence: [
      "Complaint categories and stated subjects differ.",
      "No formal referral or shared proceeding reference is present.",
    ],
    missingInformation: ["Supporting source documents are not attached in this prototype."],
  }),
  item("demo-coord-identity", [9, 10], {
    institutionId: null,
    suggestedRelationship: "Institution identity needs review",
    suggestedDecision: "insufficient_evidence",
    matchingEvidence: ["Institution names share several words."],
    conflictingEvidence: [
      "The source records identify different states and institution locations.",
    ],
    missingInformation: [
      "AICTE Permanent IDs are not present in both source records.",
      "Do not merge institutions based on name similarity alone.",
    ],
    freshness: "fresh",
  }),
  item("demo-coord-stale", [19, 39], {
    suggestedRelationship: "Potentially related; source freshness is limited",
    suggestedDecision: "insufficient_evidence",
    matchingEvidence: ["The source dates fall within the configured candidate window."],
    conflictingEvidence: [],
    missingInformation: [
      "RB source record has not updated within the configured freshness threshold.",
      "A current source status is needed before review.",
    ],
    freshness: "stale",
  }),
  item("demo-coord-history", [12], {
    suggestedRelationship: "Incomplete source action history",
    suggestedDecision: "insufficient_evidence",
    matchingEvidence: ["A source case exists for this institution."],
    conflictingEvidence: [],
    missingInformation: [
      "No source-attributed action history was received for this record.",
      "The absence of history is not evidence that no actions occurred.",
    ],
  }),
  item("demo-coord-unmapped", [77], {
    institutionId: null,
    suggestedRelationship: "Institution mapping is unresolved",
    suggestedDecision: "insufficient_evidence",
    matchingEvidence: [],
    conflictingEvidence: [],
    missingInformation: [
      "No verified institution identifier is present in the source record.",
      "A human identity review is required before linking cases.",
    ],
  }),
];

export function getDemoAsOf() {
  return new Date(DEMO_AS_OF);
}

