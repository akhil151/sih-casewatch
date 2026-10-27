# NEXUS — Hackathon Demonstration Runbook
**AICTE Problem Statement 26264: Evidence-First Institution Complaint Coordination Platform**
*Prototype Demonstration Guide & Operational Runbook*

---

## 1. Executive Summary & Architecture Overview

NEXUS is an evidence-first institution complaint coordination platform designed to consolidate source-attributed complaint records across Regional Bureaus (RB), the Public Grievance Redressal Cell (PGRC), and related administrative workflows.

### Core Architectural Principles
1. **Source Attribution & Evidence Integrity**: Originating bureau records remain authoritative and read-only. NEXUS stores provenance, candidate relationships, and coordination reviews separately without altering bureau source facts.
2. **Human Review Before Action**: System suggestions are triage cues, not official determinations. Consequential coordination decisions require an explicit human decision and rationale (>= 12 characters).
3. **No Silent Normalization**: Unrecognized bureau or status values are never silently coerced to default official values (e.g. `PGRC` or `Pending`). They are explicitly flagged as `"Unmapped"` and highlighted as data quality notices.
4. **Identity Distinction**: Institutions with similar names (e.g. Bhopal vs. Indore) are maintained as separate `candidate` identities and never automatically merged without human verification.
5. **Dual-Mode Operational Resilience**:
   - **Live Mode**: Backed by PostgreSQL on Supabase (`ylmmczrcetjhwudgwjsr.supabase.co`) with Row Level Security (RLS) and real-time event distribution.
   - **Simulated Demo Mode**: Fully offline, client-side demonstration using deterministic synthetic records (`SIM-*`) in browser storage (`sessionStorage`/`localStorage`), with zero database mutations.

---

## 2. Pre-Flight Verification & Quick Start

### Development Server Quick Start
Open PowerShell from `D:\NEXUS-Complaint-Intelligence`:
```powershell
# Set required environment parameters
$env:PORT = "5173"
$env:BASE_PATH = "/"

# Verify tests, typecheck, and build
corepack pnpm test
corepack pnpm --filter @workspace/nexus run typecheck

# Start local server (if not already running in background)
corepack pnpm --filter @workspace/nexus run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## 3. Step-by-Step Hackathon Demonstration Script (5–7 Minutes)

### Phase 1: Operational Overview (`/`)
1. **Navigate to the Overview**:
   - Point out the **Data Status** indicator in the top right (`available` in live mode, or `simulated` in demo mode).
2. **Explain Metric Cards**:
   - `Total source cases: 80` (deterministic synthetic cases).
   - Show status counts: `Pending`, `Under Process`, `Disposed`, `Transferred`.
   - Point out **Bureau Workload**: Displays active distribution across `RB` and `PGRC`.
   - Explain the **Unresolved Identities** metric: Reflects records requiring verified institution linking.
3. **Highlight Priority Queue**:
   - In the right-hand panel, point out **Riverbend College of Technology** flagged for *Potential parallel action*.
   - Click the item to deep-link directly into the Coordination workbench.

---

### Phase 2: Evidence-First Coordination Review (`/coordination`)
1. **Inspect Candidate Matter**:
   - In the review queue, select **Riverbend College of Technology** (`demo-coord-overlap`).
   - Notice the involved cases: `SIM-0008` (RB) and `SIM-0028` (RB/PGRC) for *Financial Disclosure*.
2. **Walk Through the Tri-Partite Evidence Layout**:
   - **Matching Evidence**: Verified institution match, overlapping receipt dates within review window.
   - **Conflicting Evidence**: No shared referral, proceeding, or action reference.
   - **Missing Information**: Emphasizes that underlying case documents have not yet been compared and human review is required.
   - Point out the **Procedural Lineage** links that let officers inspect both source cases side-by-side.
3. **Execute a Human Review Decision**:
   - Scroll down to the **Human review decision** panel.
   - Select: `Confirmed — same matter` (or `Potential parallel action`).
   - Try typing a short rationale (e.g. `"Looks same"`): Notice the validation guard requires at least 12 characters.
   - Enter a valid operational rationale:
     > `"Both complaints cite identical audit discrepancies for Riverbend during Q3 2026 without formal transfer."`
   - Click **Submit human decision**.
4. **Observe the Outcome**:
   - A success banner appears: *"Review submitted. The human decision is recorded separately from the system suggestion."*
   - Status updates from `open` to `reviewed`.
   - The decision is permanently stamped with the signed-in reviewer's identity and timestamp.
   - Source cases remain unchanged.

---

### Phase 3: In-App Notifications & Realtime Feed (`/notifications`)
1. **Header Bell & Popover**:
   - Direct attention to the bell icon in the top header.
   - Notice the unread badge count updates dynamically.
   - Click the bell: The popover displays the review outcome and recent system notices with relative timestamps (e.g. *"Just now"*, *"2h ago"*).
   - Click the checkmark icon to mark a notification as read.
2. **Dedicated Notifications Page**:
   - Click **View full notifications** (or navigate to `/notifications` in the sidebar).
   - Demonstrate the **Type Filter** (`Review queue`, `Review outcome`, `Account access`, `System alert`).
   - Demonstrate the **Unread only** toggle.
   - Demonstrate **Mark all read**.
   - Click **Open record** on any notification to navigate directly to the associated case or review workbench.

---

### Phase 4: Procedural Lineage vs. Parallel Action (`/timeline`)
1. **Navigate to Procedural Lineage (`/timeline`)**:
   - Show the chronological feed of source events, actions, and transfers.
2. **Key Talking Point — Legitimate Referrals vs. Parallel Action**:
   - Highlight cases `SIM-0003` and `SIM-0022` linked by formal referral `SIM-REF-2026-014`.
   - Explain that NEXUS distinguishes sequential institutional progression (PGRC referral followed by RB action) from harmful, uncoordinated parallel investigations.

---

### Phase 5: Institution Registry & Identity Governance (`/institutions`)
1. **Navigate to Institutions (`/institutions`)**:
   - Show the 20 synthetic educational institutions with AICTE Permanent IDs, regions, and case footprints.
2. **Search and Filter**:
   - Type `"Kolkata"` into the search box:
     - Notice two distinct entities: *Eastern Institute of Technology* and *Eastern Technical Institute*.
     - Explain: Even though names and cities are similar, NEXUS preserves them as separate candidate records rather than aggressively auto-merging them.
3. **Open an Institution Detail Page**:
   - Click on an institution to inspect its aliases, source labels, permanent ID, and linked complaints.

---

### Phase 6: Case Register & Safe Data Handling (`/complaints`)
1. **Navigate to Complaints (`/complaints`)**:
   - Demonstrates the source case register with filtering across bureaus, categories, statuses, and date ranges.
2. **Unresolved Identity Handling**:
   - Open case `SIM-0077`:
   - Point out that because the source record has an unverified institution name, NEXUS displays the raw name with an explicit `(Unresolved identity)` label and **does not generate broken links**.

---

### Phase 7: Operational Reporting & CSV Export (`/analytics`)
1. **Navigate to Analytics (`/analytics`)**:
   - Review Ageing Buckets (`0–30 days`, `31–60 days`, `61–90 days`, `90+ days`).
   - Review Disposal Rates and Intake Trends.
2. **Export Case Register**:
   - Click **Export cases CSV** in the header.
   - Shows instantaneous client-side generation and download of an RFC-4180 compliant CSV file (`nexus-cases-export-YYYY-MM-DD.csv`).

---

### Phase 8: Role Governance & Audit Trail (`/administration`)
1. **Navigate to Administration (`/administration`)**:
   - Accessible to administrators (or in demo mode).
2. **User Role Management**:
   - Displays user profiles, approval statuses (`pending`, `approved`, `suspended`), and bureau/region scopes.
   - Explain the **Last-Admin Protection**: The database function prevents the last administrator from removing their own privileges.
3. **Append-Only Audit History**:
   - Shows the permanent audit log of review actions, role modifications, and source mapping changes.

---

## 4. Troubleshooting & Fallback Procedures

| Scenario | Immediate Action | Expected Result |
| :--- | :--- | :--- |
| **No Internet / Supabase Disconnected** | Click **"Enter simulated workspace"** on the Access Gate sign-in page. | Instant switch to simulated demo mode. 100% functional locally with zero external network dependency. |
| **Reset Demo Changes to Clean State** | Run in browser console: `sessionStorage.clear(); localStorage.clear(); location.reload();` | Clears all demo reviews and resets to the default 80-case synthetic baseline. |
| **Realtime Updates Slow or Blocked** | No action required. Polling fallback automatically runs every 30 seconds. | Queries automatically refetch and synchronize unread badges and feeds. |
| **Port 5173 Already in Use** | Run `$env:PORT="5174"; corepack pnpm --filter @workspace/nexus run dev` in PowerShell. | Launches application cleanly on port 5174. |
| **Stale Session / React Query Cache** | Click user avatar at bottom of sidebar → **Sign Out** or **Exit demo**. | Automatically invokes `clearApplicationCache()`, wiping all memory queries. |

---

## 5. Hackathon Talking Points & AICTE Alignment

- **AICTE Problem Statement 26264**: Inter-bureau coordination of technical education complaints without creating a monolithic, slow database replacement.
- **Evidence-First**: We never touch or overwrite source databases. We listen, correlate, surface evidence, and present review queues.
- **Explainability**: Reviewers are never shown a black-box AI score. They see matching evidence, conflicting evidence, and missing information side-by-side.
- **Legal & Procedural Safety**: A human decision is recorded as a non-authoritative NEXUS coordination relationship; it never alters official bureau case numbers or statuses.
- **Zero Fabrication**: When data is missing, we label it unmapped rather than guessing.
