# Supabase setup for NEXUS

NEXUS is a prototype. The SQL below creates a Supabase schema and synthetic demo records; it does not connect to AICTE, RB, or PGRC systems.

## 1. Create a Supabase project

Create or select a Supabase project. In **Project Settings → API**, copy the project URL and the **publishable** key (or legacy `anon` key). The key is designed for browser use only when Row Level Security is enabled. Never place a `service_role` key in this app.

Add these values as Replit environment variables for the web app:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (or `VITE_SUPABASE_PUBLISHABLE_KEY`)

If either value is missing, the app stays in setup mode. You can explicitly enter the simulated demo, but it is not authenticated and demo review changes are stored only in that browser.

## 2. Apply schema and synthetic seed

Run these files in order from the Supabase SQL Editor, or apply them using the Supabase CLI:

1. `supabase/migrations/202610270001_nexus_schema.sql`
2. `supabase/migrations/202610270002_seed_demo.sql`
3. `supabase/migrations/202610270003_admin_controls.sql`

The seed is deterministic and idempotent. It creates 20 synthetic institutions, 80 synthetic source cases split across RB and PGRC, a documented referral progression, candidate overlaps, unresolved identities, stale observations, missing action history, and review examples. It creates no real user accounts or personal complaint data.

## 3. Configure Google OAuth

1. In Supabase, open **Authentication → Providers → Google** and enable Google.
2. Create a Google OAuth client in Google Cloud Console. Add the Supabase callback URL shown in the Google provider setup as an authorized redirect URI.
3. Paste the Google client ID and client secret into the Supabase Google provider settings. Keep the Google client secret in Supabase only.
4. In Supabase **Authentication → URL Configuration**, set the site URL to the app's published URL and add its auth callback route (`/auth/callback`) to the redirect URL allow list. For local/Replit development, add the exact Replit preview URL plus `/auth/callback`.
5. Save both provider configurations. Replit's browser app calls Supabase OAuth and never handles the Google client secret.

Supabase OAuth is not operational until those steps are completed. No Google OAuth credentials are included in this repository.

## 4. Bootstrap the first administrator

New accounts are created as `read_only_viewer` with `approval_status = 'pending'`. They receive no application-data access until approved. No user can grant themselves an administrator role.

After the first user signs in and the `profiles` row is created, copy that user's UUID from **Authentication → Users**. In the Supabase SQL Editor, run this one-time statement as the project owner, replacing the UUID:

```sql
update public.profiles
set role = 'administrator',
    approval_status = 'approved',
    updated_at = now()
where id = 'REPLACE_WITH_FIRST_USER_UUID';
```

The SQL Editor operation is an explicit bootstrap step and should be limited to the first administrator. Administrators can then approve users and set their roles, region/bureau scope, and source mappings from the Administration page. Those changes are validated and audited by database functions. Normal users cannot update their own role or approval status.

## 5. Security and limitations

- Row Level Security is enabled for all application tables. Pending and suspended accounts cannot read complaint data.
- Restricted source cases are visible only to administrators, bureau officers, and regional officers whose profile region matches the institution.
- Review decisions use the `submit_coordination_review` database function, which locks the item, checks the review timestamp, validates reviewer permissions, requires a rationale, and writes the review and audit entry in one transaction.
- A human-confirmed relationship is stored as a non-authoritative NEXUS relationship. It does not rewrite bureau source records or mark any official action as a duplicate.
- Source observations and source actions are read-only through the application; no fake source connector or live sync is implemented.
- The demo seed's source connections are labeled `simulated`. Live bureau integration, production readiness, data retention policy, legal basis, and operational access governance are not provided by this prototype.
