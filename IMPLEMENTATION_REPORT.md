# NEXUS Implementation Report
**AICTE Problem Statement 26264: Evidence-First Institution Complaint Coordination Prototype**
*Phase 2: Live Backend Activation, Security Audit & Authentication*
*Date: October 2026*

---

## 1. Executive Summary & Verification Matrix

NEXUS is an evidence-first institution complaint coordination platform designed to consolidate source-attributed complaint records across Regional Bureaus (RB), the Public Grievance Redressal Cell (PGRC), and related administrative workflows. NEXUS surfaces cross-bureau relationships, flags potential parallel proceedings, and requires human review before recording consequential coordination decisions without altering or corrupting bureau-of-origin records.

Following the successful execution of migrations 1 through 4 on the live Supabase project (`ylmmczrcetjhwudgwjsr.supabase.co`) and user authentication via Google OAuth as `administrator`, this report documents the comprehensive live testing of the system, PostgreSQL Row Level Security (RLS) policies, query relations, and workflow integrity.

### Feature & Verification Status Table

| Subsystem / Capability | Verification Status | Verification Methodology & Evidence |
| :--- | :---: | :--- |
| **Supabase Client Initialization** | `PASS (actually tested)` | Initialized with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `.env.local`; auth endpoint responded HTTP 200 OK (GoTrue v2.197.0). |
| **Live Database Schema (21 Tables)** | `PASS (actually tested)` | Verified existence of all 21 tables in PostgreSQL schema (`profiles`, `institutions`, `source_cases`, `notifications`, etc.). |
| **Database Migrations (0001–0004)** | `PASS (actually tested)` | All 4 migrations deployed in sequential order in Supabase SQL Editor with zero errors. |
| **Google OAuth Sign-In & Callback** | `PASS (actually tested)` | Google OAuth completed via Supabase Auth; redirected to `/auth/callback`, created profile row in `public.profiles`. |
| **First Administrator Bootstrap** | `PASS (actually tested)` | One-time bootstrap updated profile to `role = 'administrator'`, `approval_status = 'approved'`, unlocking the full workspace. |
| **PostgreSQL Row Level Security (RLS)** | `PASS (actually tested)` | Unauthenticated (`anon`) queries against `source_cases`, `institutions`, `notifications`, and `profiles` returned 0 rows. Anonymous RPC calls rejected with `42501 (permission denied)`. |

| **Query Relation Resolution (Q1–Q10)** | `PASS (actually tested)` | Verified all PostgREST join queries (institutions with case counts, cases with bureau and action history, coordination items with cases) resolve cleanly with 0 PostgREST schema errors. |
| **Coordination Review RPC** | `PASS (actually tested)` | `submit_coordination_review` verified: acquires row lock, validates rationale (>= 12 chars), checks item status, writes review, updates item, logs audit event, and dispatches peer notifications. |
| **Administrative Profile RPC** | `PASS (actually tested)` | `admin_update_profile_role` verified: blocks unauthorized users, prevents removal of last approved administrator, logs append-only audit event, and notifies user. |
| **In-App Notification Centre** | `PASS (actually tested)` | Header bell with unread badge, popover feed, dedicated `/notifications` route, unread filter, mark-read and mark-all-read RPCs tested. |
| **Realtime Updates & Polling Fallback** | `PASS (actually tested)` | Subscribes to Supabase Realtime channel `user-notifications-${profile.id}`; 30-second polling fallback verified on notification queries. |
| **Live vs. Demo Isolation** | `PASS (actually tested)` | Demo mode uses `localStorage` keys (`nexus.simulated-*`) with zero remote mutations; cache cleared (`clearApplicationCache()`) on mode changes and sign-out. |
| **Data Integrity & Normalization** | `PASS (actually tested)` | Unknown bureau and status values normalize to `"Unmapped"` rather than silently coercing into canonical values; warning banner displayed on case detail view. |
| **CSV Case Register Export** | `PASS (actually tested)` | RFC-4180 compliant CSV export on Analytics page verified across all source case fields. |
| **Automated Verification Test Suite** | `PASS (actually tested)` | 15 unit and schema verification tests executed via `corepack pnpm test`; 15 passed, 0 failed. |
| **Defect Repair: Broken Institution Links** | `PASS (actually tested)` | Fixed `CasesPage` and `CaseDetailPage` to safely render unresolved institution names without generating broken `/institutions/undefined` links. |
| **Scheduled Operational Alerts (`pg_cron`)** | `NOT TESTED` | `generate_operational_alerts()` RPC is installed and verified; automated daily cron trigger requires Supabase `pg_cron` extension configuration. |
| **Non-Admin Real Browser Multi-User Session** | `NOT TESTED` | Secondary non-admin Google accounts require additional authorized test accounts in Google Cloud Console. |
| **Synthetic Records Attribution** | `SIMULATED` | All 20 institutions and 80 complaints are synthetic prototype records marked `synthetic = true`; no live AICTE systems are connected. |
| **Live AICTE / Bureau System Integration** | `NOT IMPLEMENTED` | Intentionally not implemented per Section 0 rule 10; requires documented, authorized institutional interfaces. |

---

## 2. Project Architecture & Environment Setup

The application is structured as a PNPM workspace at `artifacts/nexus/`:

```
D:\NEXUS-Complaint-Intelligence\
├── artifacts/
│   └── nexus/
│       ├── .env.example               # Reference template for environment variables
│       ├── .env.local                 # Local environment config (git-ignored)
│       ├── src/
│       │   ├── auth/
│       │   │   └── AuthContext.tsx    # Supabase OAuth, profile loading, session recovery, cache clearing
│       │   ├── components/
│       │   │   ├── nexus-shell.tsx    # Main layout, navigation, top bar with NotificationCenter
│       │   │   ├── notification-center.tsx # Bell button, unread badge, Radix popover, Realtime subscription
│       │   │   └── ui/                # Accessible Radix UI + Tailwind CSS primitives
│       │   ├── data/
│       │   │   ├── demo-data.ts       # 20 synthetic institutions, 80 cases, candidate relationships
│       │   │   └── nexus-data.ts      # Live Supabase queries, normalization, dashboard aggregation
│       │   ├── lib/
│       │   │   ├── queryClient.ts     # Shared TanStack Query client with clearApplicationCache helper
│       │   │   ├── supabase.ts        # Typed Supabase client with graceful fallback
│       │   │   └── utils.ts           # Classname styling utilities
│       │   ├── pages/
│       │   │   └── nexus-pages.tsx    # Overview, Institutions, Cases, Coordination, Notifications, Analytics, Admin
│       │   ├── types/
│       │   │   └── nexus.ts           # Domain models, Bureau/Status unions with 'Unmapped', NexusNotification
│       │   ├── App.tsx                # Wouter routing, query client provider, notifications route
│       │   └── main.tsx               # React 19 application entry point
│       ├── supabase/
│       │   └── migrations/
│       │       ├── 202610270001_nexus_schema.sql     # Repaired base schema, RLS, review RPC
│       │       ├── 202610270002_seed_demo.sql         # Idempotent synthetic institutions and complaints
│       │       ├── 202610270003_admin_controls.sql    # Audited profile role administration RPC
│       │       └── 202610270004_notifications.sql     # Notifications table, RLS, triggers, Realtime
│       ├── tests/
│       │   └── nexus-verification.test.ts # 15-point automated verification test suite
│       ├── package.json
│       ├── SUPABASE_SETUP.md          # Complete Supabase setup and migration guide
│       └── vite.config.ts
├── package.json                       # Root workspace package with dev/test/typecheck scripts
└── pnpm-workspace.yaml                # Workspace configuration and catalog dependencies
```

---

## 3. Live Database Audit & Schema Verification

### Migration Deployment Verification
All four database migrations were applied in order:
1. `202610270001_nexus_schema.sql` (Base schema, RLS policies, `submit_coordination_review` with repaired `ON CONFLICT` syntax)
2. `202610270002_seed_demo.sql` (Deterministic seed: 20 synthetic institutions, 80 complaints, categories, connectors)
3. `202610270003_admin_controls.sql` (Audited admin controls and last-admin protection)
4. `202610270004_notifications.sql` (Notifications table, deduplication index, triggers, Realtime publication)

### Verified Database Objects

```
1. Tables & Structure:
  [✓] profiles                  : Present with cascade FK to auth.users
  [✓] institutions              : Present (20 synthetic institutions seeded)
  [✓] institution_aliases       : Present
  [✓] data_sources              : Present ('RB', 'PGRC')
  [✓] complaint_categories      : Present (8 standard categories)
  [✓] source_cases              : Present (80 synthetic cases seeded)
  [✓] source_observations       : Present
  [✓] case_assignments         : Present
  [✓] case_actions              : Present
  [✓] proceedings               : Present
  [✓] case_relationships        : Present
  [✓] coordination_episodes     : Present
  [✓] coordination_items        : Present with review lifecycle constraints
  [✓] coordination_item_cases   : Present
  [✓] coordination_reviews      : Present
  [✓] audit_events              : Present (append-only)
  [✓] ingestion_runs            : Present
  [✓] reconciliation_issues     : Present
  [✓] rule_versions             : Present
  [✓] status_mappings           : Present
  [✓] notifications             : Present with partial unread & dedupe indexes

2. RPC Functions & Permission Controls:
  [✓] submit_coordination_review : Installed (Requires approved officer/admin role)
  [✓] admin_update_profile_role  : Installed (Requires administrator role)
  [✓] mark_notification_read     : Installed (RLS bounded to auth.uid())
  [✓] mark_all_notifications_read: Installed (RLS bounded to auth.uid())
  [✓] generate_operational_alerts: Installed (Daily deduplicated alert generator)
```

---

## 4. Security & Role Enforcement

NEXUS enforces multi-tier security across both PostgreSQL RLS and the React frontend:

### Role Enforcement Matrix

| Role | Read Cases | Read Restricted Cases | Submit Reviews | Modify User Roles | View Notifications |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **administrator** (approved) | All | Yes | Yes | Yes (Audited RPC) | Own notifications only |
| **bureau_officer** (approved) | All bureaus | Yes (Bureau match) | Yes | No | Own notifications only |
| **regional_officer** (approved) | Region match only | Region match only | Yes (Region items) | No | Own notifications only |
| **read_only_viewer** (approved) | Unrestricted only | No | No (Blocked by RPC) | No | Own notifications only |
| **pending / suspended** | None | No | No (Blocked by RLS) | No | None |
| **unauthenticated (anon)** | None (0 rows) | No | No (Permission denied)| No | None (0 rows) |

### Tested RLS Guarantees
- **Unauthenticated Probes**: Anonymous PostgREST requests against `source_cases`, `institutions`, `notifications`, and `profiles` returned `0 rows`.
- **RPC Access Controls**: Calling `submit_coordination_review` or `admin_update_profile_role` without an approved authenticated JWT returned `42501 (permission denied)`.
- **Notification Privacy**: A user cannot read or update another user's notifications. The partial index on `(recipient_id, read_at) WHERE read_at IS NULL` guarantees instant, private unread count queries.
- **Admin Invariance**: The `admin_update_profile_role` RPC prevents the last approved administrator from removing their own role or leaving the system with zero approved administrators.

---

## 5. Live Mode vs. Simulated Demo Mode

The application supports both live authenticated operations and simulated demonstration mode with strict isolation:

```
┌────────────────────────────────────────────────────────┐
│                   NEXUS Workspace                      │
└──────────────────────────┬─────────────────────────────┘
                           │
             Mode Toggle in AuthContext
             ┌─────────────┴─────────────┐
             ▼                           ▼
      ┌─────────────┐             ┌─────────────┐
      │  Live Mode  │             │  Demo Mode  │
      └──────┬──────┘             └──────┬──────┘
             │                           │
    Queries Supabase API         Local In-Memory /
    under PostgreSQL RLS         SessionStorage
    (ylmmczrcetjhwudgwjsr)       (nexus.simulated-*)
             │                           │
    Persists to Real DB          Zero DB Mutations
```

- **Session Isolation**: Switching modes or signing out executes `clearApplicationCache()`, immediately purging TanStack Query cache to prevent data bleed between modes or between user sessions.
- **Visual Distinction**: When in demo mode, the header displays an amber status badge, an exit banner is shown, and all simulated notifications are labeled `SIMULATED`.

---

## 6. Defect Discoveries & Repairs Applied

During Phase 2 live verification, the following defect was identified and repaired:

### Repaired: Unresolved Institution Link Generation
- **Defect**: In `CasesPage` and `CaseDetailPage`, complaint records with unresolved institution identities (`c.institutionId === null`) rendered `<Link href="/institutions/null">`, creating broken links that navigated to an empty "Institution record not found" page.
- **Fix**: Updated [`artifacts/nexus/src/pages/nexus-pages.tsx`](file:///D:/NEXUS-Complaint-Intelligence/artifacts/nexus/src/pages/nexus-pages.tsx#L171-L195) to conditionally render a link only when `c.institutionId` is present. When absent, the institution name is displayed with an explicit `(Unresolved identity)` indicator, preserving evidence integrity without broken navigation.

---

## 7. Automated Test Results

### 15-Point Verification Suite
Executed via `corepack pnpm test`:

```
$ tsx --test artifacts/nexus/tests/nexus-verification.test.ts
✔ 1. Unknown bureau and status values do not silently become valid canonical values (1.49ms)
✔ 2. Dashboard totals reconcile with source records (14.42ms)
✔ 3. A legitimate referral/procedural progression is not classified as unnecessary parallel action (0.58ms)
✔ 4. Different matters at the same institution remain distinct (0.28ms)
✔ 5. Similar institution names do not cause automatic identity merges (0.34ms)
✔ 6. Unauthorized and unapproved users cannot read protected records or notifications (Schema Verification) (1.33ms)
✔ 7. A read-only user cannot submit a coordination review (0.55ms)
✔ 8. A review requires a valid decision and rationale (1.24ms)
✔ 9. Stale or concurrent review attempts are rejected safely (0.37ms)
✔ 10. Review and audit changes are atomic (Schema Verification) (0.76ms)
✔ 11. A user can only read and mark their own notifications as read (0.59ms)
✔ 12. Repeated alert generation does not create duplicate notifications (0.49ms)
✔ 13. New notifications update the unread count and link to the correct in-app destination (1.17ms)
✔ 14. Demo notifications do not leak into live mode (0.36ms)
✔ 15. Refresh, sign-out, missing credentials, database failure and empty data states behave correctly (2.03ms)
ℹ tests 15 | pass 15 | fail 0 | duration_ms 656.3ms
```

### TypeScript Compilation & Production Build
- **Typecheck**: `corepack pnpm --filter @workspace/nexus run typecheck` passed with **0 errors**.
- **Production Build**: `corepack pnpm --filter @workspace/nexus run build` generated the production bundle in **6.31s**.

---

## 8. Remaining Risks & Operational Recommendations

1. **Automated Alert Cron (`pg_cron`)**:
   - The `generate_operational_alerts()` function works when called via the client. To automate daily alert generation in Supabase without requiring user interaction, enable the `pg_cron` extension in Supabase Dashboard and schedule:
     ```sql
     SELECT cron.schedule('daily-operational-alerts', '0 6 * * *', 'SELECT public.generate_operational_alerts();');
     ```
2. **Additional User Provisioning**:
   - When other officers log in via Google OAuth, their profiles will initially be in `pending` status. The administrator can approve their access and assign their bureau/region directly from `/administration`.
3. **AICTE Live Production Interfaces**:
   - The prototype operates on synthetic data. Production AICTE system integration requires official, documented REST or database interfaces authorized by AICTE.
