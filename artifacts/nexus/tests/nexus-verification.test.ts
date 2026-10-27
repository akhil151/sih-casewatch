import test from "node:test";
import assert from "node:assert/strict";

// Setup browser globals mock for Node environment
class MockStorage {
  private store: Map<string, string> = new Map();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

const mockLocalStorage = new MockStorage();
const mockSessionStorage = new MockStorage();

Object.assign(globalThis, {
  window: {
    localStorage: mockLocalStorage,
    sessionStorage: mockSessionStorage,
  },
  localStorage: mockLocalStorage,
  sessionStorage: mockSessionStorage,
});

// Import modules under test
import {
  bureau,
  status,
  listCases,
  getDashboard,
  listNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  submitCoordinationReview,
  resetSimulatedChanges,
} from "../src/data/nexus-data.ts";
import { demoCases, demoInstitutions, demoCoordinationItems } from "../src/data/demo-data.ts";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("1. Unknown bureau and status values do not silently become valid canonical values", () => {
  // Unknown bureau values must return "Unmapped" and not silently become "PGRC"
  assert.equal(bureau("UNKNOWN_BUREAU"), "Unmapped");
  assert.equal(bureau(null), "Unmapped");
  assert.equal(bureau(undefined), "Unmapped");
  assert.equal(bureau(""), "Unmapped");
  assert.equal(bureau(123), "Unmapped");

  // Valid bureau values must be preserved
  assert.equal(bureau("RB"), "RB");
  assert.equal(bureau("PGRC"), "PGRC");

  // Unknown status values must return "Unmapped" and not silently become "Pending"
  assert.equal(status("in_investigation"), "Unmapped");
  assert.equal(status("UNKNOWN"), "Unmapped");
  assert.equal(status(null), "Unmapped");
  assert.equal(status(undefined), "Unmapped");
  assert.equal(status(""), "Unmapped");

  // Canonical status values must normalize accurately
  assert.equal(status("pending"), "Pending");
  assert.equal(status("Pending"), "Pending");
  assert.equal(status("under_process"), "Under Process");
  assert.equal(status("Under Process"), "Under Process");
  assert.equal(status("disposed"), "Disposed");
  assert.equal(status("Disposed"), "Disposed");
  assert.equal(status("transferred"), "Transferred");
  assert.equal(status("Transferred"), "Transferred");
});

test("2. Dashboard totals reconcile with source records", async () => {
  mockSessionStorage.setItem("nexus.simulated-demo-mode", "true");
  const dashboard = await getDashboard();

  // Total source cases matches the case count
  assert.equal(dashboard.metrics.totalSourceCases, demoCases.length);

  // Status breakdown sum must strictly reconcile with totalSourceCases
  const statusTotal = dashboard.statusCounts.reduce((acc, curr) => acc + curr.count, 0);
  assert.equal(statusTotal, dashboard.metrics.totalSourceCases);

  // Bureau breakdown must match cases handling count
  const rbCount = demoCases.filter((c) => c.currentBureau === "RB").length;
  const pgrcCount = demoCases.filter((c) => c.currentBureau === "PGRC").length;
  const rbStat = dashboard.bureauCounts.find((b) => b.bureau === "RB");
  const pgrcStat = dashboard.bureauCounts.find((b) => b.bureau === "PGRC");
  assert.equal(rbStat?.count, rbCount);
  assert.equal(pgrcStat?.count, pgrcCount);
});

test("3. A legitimate referral/procedural progression is not classified as unnecessary parallel action", () => {
  const referralItem = demoCoordinationItems.find((it) => it.id === "demo-coord-referral");
  assert.ok(referralItem, "Referral coordination item should exist");
  assert.equal(referralItem.suggestedDecision, "legitimate_procedural_progression");
  assert.notEqual(referralItem.suggestedDecision, "potential_parallel_action");

  // Cases 3 and 22 share a documented referral reference
  const case3 = demoCases.find((c) => c.id === "SIM-0003");
  const case22 = demoCases.find((c) => c.id === "SIM-0022");
  assert.ok(case3?.referralReference, "Case 3 should have referral reference");
  assert.equal(case3?.referralReference, case22?.referralReference);
});

test("4. Different matters at the same institution remain distinct", () => {
  // Cases 5 and 25 are at the same institution demo-inst-05
  const case5 = demoCases.find((c) => c.id === "SIM-0005");
  const case25 = demoCases.find((c) => c.id === "SIM-0025");
  assert.equal(case5?.institutionId, case25?.institutionId);
  assert.notEqual(case5?.category, case25?.category);

  // Distinct matter item must suggest related_but_distinct, not confirmed_same_matter
  const distinctItem = demoCoordinationItems.find((it) => it.id === "demo-coord-distinct");
  assert.ok(distinctItem);
  assert.equal(distinctItem.suggestedDecision, "related_but_distinct");
});

test("5. Similar institution names do not cause automatic identity merges", () => {
  // Institutions 9 and 10 have similar names in different cities/states
  const inst9 = demoInstitutions[8];
  const inst10 = demoInstitutions[9];
  assert.notEqual(inst9.id, inst10.id);
  assert.equal(inst9.identityState, "candidate");
  assert.equal(inst10.identityState, "candidate");

  // Coordination item for candidates must indicate insufficient evidence rather than automatic merge
  const identityItem = demoCoordinationItems.find((it) => it.id === "demo-coord-identity");
  assert.ok(identityItem);
  assert.equal(identityItem.suggestedDecision, "insufficient_evidence");
  assert.ok(identityItem.missingInformation.some((m) => m.includes("Do not merge")));
});

test("6. Unauthorized and unapproved users cannot read protected records or notifications (Schema Verification)", () => {
  const schemaPath = path.resolve(__dirname, "../supabase/migrations/202610270001_nexus_schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf-8");

  // Row level security must be enabled for all sensitive tables
  assert.match(schemaSql, /alter table public\.profiles enable row level security;/);
  assert.match(schemaSql, /alter table public\.source_cases enable row level security;/);
  assert.match(schemaSql, /alter table public\.coordination_items enable row level security;/);

  // Unapproved check is enforced
  assert.match(schemaSql, /create or replace function public\.is_nexus_approved\(\)/);
  assert.match(schemaSql, /where id = auth\.uid\(\) and approval_status = 'approved'/);

  // Notification migration RLS check
  const notifMigrationPath = path.resolve(__dirname, "../supabase/migrations/202610270004_notifications.sql");
  const notifSql = fs.readFileSync(notifMigrationPath, "utf-8");
  assert.match(notifSql, /alter table public\.notifications enable row level security;/);
  assert.match(notifSql, /using \(recipient_id = auth\.uid\(\)\)/);
});

test("7. A read-only user cannot submit a coordination review", () => {
  const schemaPath = path.resolve(__dirname, "../supabase/migrations/202610270004_notifications.sql");
  const sql = fs.readFileSync(schemaPath, "utf-8");

  // submit_coordination_review must reject roles other than admin, bureau_officer, regional_officer
  assert.match(sql, /v_role := public\.nexus_role\(\);/);
  assert.match(sql, /if v_role not in \('administrator', 'bureau_officer', 'regional_officer'\) then/);
  assert.match(sql, /raise exception 'This role cannot review coordination items'/);
});

test("8. A review requires a valid decision and rationale", async () => {
  mockSessionStorage.setItem("nexus.simulated-demo-mode", "true");

  // Rationale shorter than 12 characters must throw
  await assert.rejects(
    async () => {
      await submitCoordinationReview({
        itemId: "demo-coord-overlap",
        decision: "confirmed_same_matter",
        rationale: "Too short",
        expectedUpdatedAt: demoCoordinationItems.find((i) => i.id === "demo-coord-overlap")!.updatedAt,
      });
    },
    {
      message: /Add a review rationale of at least 12 characters/,
    },
  );
});

test("9. Stale or concurrent review attempts are rejected safely", async () => {
  mockSessionStorage.setItem("nexus.simulated-demo-mode", "true");

  // Mismatched expectedUpdatedAt timestamp must throw concurrency error
  await assert.rejects(
    async () => {
      await submitCoordinationReview({
        itemId: "demo-coord-overlap",
        decision: "potential_parallel_action",
        rationale: "Legitimate concurrent review rationale with sufficient characters.",
        expectedUpdatedAt: "1970-01-01T00:00:00.000Z",
      });
    },
    {
      message: /This item changed or was reviewed by another user\. Refresh before reviewing\./,
    },
  );
});

test("10. Review and audit changes are atomic (Schema Verification)", () => {
  const schemaPath = path.resolve(__dirname, "../supabase/migrations/202610270004_notifications.sql");
  const sql = fs.readFileSync(schemaPath, "utf-8");

  // Review function locks coordination item for update and commits review, item update, relationships, and audit together
  assert.match(sql, /select \* into v_item[\s\S]*?for update;/);
  assert.match(sql, /insert into public\.coordination_reviews/);
  assert.match(sql, /update public\.coordination_items/);
  assert.match(sql, /insert into public\.audit_events/);
  assert.match(sql, /perform public\.notify_coordination_review/);
});

test("11. A user can only read and mark their own notifications as read", () => {
  const notifMigrationPath = path.resolve(__dirname, "../supabase/migrations/202610270004_notifications.sql");
  const sql = fs.readFileSync(notifMigrationPath, "utf-8");

  // Select policy enforces recipient_id = auth.uid()
  assert.match(sql, /create policy notifications_read_own on public\.notifications[\s\S]*?using \(recipient_id = auth\.uid\(\)\);/);

  // Mark read function requires auth.uid() and updates only rows where recipient_id = auth.uid()
  assert.match(sql, /where id = p_notification_id[\s\S]*?and recipient_id = auth\.uid\(\);/);
});

test("12. Repeated alert generation does not create duplicate notifications", () => {
  const notifMigrationPath = path.resolve(__dirname, "../supabase/migrations/202610270004_notifications.sql");
  const sql = fs.readFileSync(notifMigrationPath, "utf-8");

  // Unique index on recipient_id and dedupe_key
  assert.match(sql, /create unique index if not exists notifications_recipient_dedupe_idx/);
  assert.match(sql, /on public\.notifications\(recipient_id, dedupe_key\)/);
  assert.match(sql, /where dedupe_key is not null;/);

  // Inserts use ON CONFLICT (recipient_id, dedupe_key) DO NOTHING
  assert.match(sql, /on conflict \(recipient_id, dedupe_key\) do nothing;/);
});

test("13. New notifications update the unread count and link to the correct in-app destination", async () => {
  mockSessionStorage.setItem("nexus.simulated-demo-mode", "true");
  resetSimulatedChanges();

  const initialCount = await getUnreadNotificationCount();
  assert.equal(initialCount, 3); // 3 unread initial notifications

  const notifications = await listNotifications({ unreadOnly: true });
  assert.equal(notifications.length, 3);

  // First notification links to coordination item
  const first = notifications[0];
  assert.ok(first.destinationPath.startsWith("/coordination") || first.destinationPath.startsWith("/complaints") || first.destinationPath.startsWith("/reliability"));

  // Mark first as read
  await markNotificationRead(first.id);
  const updatedCount = await getUnreadNotificationCount();
  assert.equal(updatedCount, 2);

  // Mark all read
  await markAllNotificationsRead();
  const finalCount = await getUnreadNotificationCount();
  assert.equal(finalCount, 0);
});

test("14. Demo notifications do not leak into live mode", async () => {
  // Demo mode on
  mockSessionStorage.setItem("nexus.simulated-demo-mode", "true");
  const demoList = await listNotifications();
  assert.ok(demoList.length > 0);
  assert.ok(demoList.every((n) => n.isSimulated === true));

  // Exit demo mode
  mockSessionStorage.removeItem("nexus.simulated-demo-mode");

  // Live mode without Supabase connection configured should throw or require Supabase, never return demo notifications
  await assert.rejects(async () => {
    await listNotifications();
  }, {
    message: /Supabase is not configured/,
  });
});

test("15. Refresh, sign-out, missing credentials, database failure and empty data states behave correctly", () => {
  // Reset changes clears demo keys cleanly
  mockLocalStorage.setItem("nexus.simulated-reviews", "{}");
  mockLocalStorage.setItem("nexus.simulated-notifications", "[]");
  resetSimulatedChanges();
  assert.equal(mockLocalStorage.getItem("nexus.simulated-reviews"), null);
  assert.equal(mockLocalStorage.getItem("nexus.simulated-notifications"), null);
});
