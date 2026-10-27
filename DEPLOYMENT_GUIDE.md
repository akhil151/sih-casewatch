# NEXUS — Production Deployment Guide (Vercel & Supabase)
**AICTE Problem Statement 26264: Evidence-First Institution Complaint Coordination Platform**
*Production Release & Cloud Deployment Runbook*

---

## 1. Architecture & Monorepo Overview

NEXUS is built as a modular PNPM workspace monorepo. The production application lives inside the `artifacts/nexus` workspace and depends on workspace libraries (such as `@workspace/api-client-react`).

```
D:\NEXUS-Complaint-Intelligence\
├── artifacts/
│   └── nexus/                     # Primary Vite + React application
│       ├── dist/public/           # Production build output directory
│       ├── src/                   # Client application source
│       ├── package.json           # @workspace/nexus package manifest
│       └── vite.config.ts         # Vite build configuration (with production defaults)
├── lib/
│   └── api-client-react/          # Workspace dependency (@workspace/api-client-react)
├── pnpm-workspace.yaml            # Monorepo workspace definition
├── package.json                   # Root package manifest
└── vercel.json                    # Minimal Vercel deployment configuration
```

### Key Deployment Considerations
1. **Monorepo Dependency Resolution**: Because `artifacts/nexus` relies on `workspace:*` package links, Vercel must build with the repository root as context so PNPM can resolve internal workspace dependencies.
2. **Deterministic SPA Routing**: The app utilizes client-side routing (`wouter`) with deep URLs (`/complaints/:id`, `/institutions/:id`, `/coordination`, `/auth/callback`). All non-asset routes must be rewritten to `/index.html` on Vercel to prevent HTTP 404 errors on direct navigation or page refresh.
3. **Zero Secrets in Frontend**: The frontend only communicates with Supabase via its public anonymous client. No privileged credentials (`service_role` key, database connection strings, or Google OAuth client secret) are bundled into or exposed by the client application.

---

## 2. Minimal Deployment Configuration (`vercel.json`)

The repository root includes a minimal `vercel.json` file that automatically configures Vercel:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "pnpm --filter @workspace/nexus run build",
  "outputDirectory": "artifacts/nexus/dist/public",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

This configuration ensures:
- **Targeted Build**: Vercel runs `pnpm --filter @workspace/nexus run build` directly.
- **Correct Artifact Directory**: Vercel serves the compiled SPA from `artifacts/nexus/dist/public`.
- **SPA Rewrite Fallback**: Any client-side route is rewritten to `/index.html` while physical static assets (`.js`, `.css`, images) are served directly with standard edge caching.

---

## 3. Vercel Project Setup (Step-by-Step)

When importing the project into the [Vercel Dashboard](https://vercel.com/):

### Step 3.1: Import Git Repository
1. Log in to Vercel and click **Add New...** → **Project**.
2. Select your Git repository (`NEXUS-Complaint-Intelligence`).

### Step 3.2: Configure Project Settings
In the **Configure Project** screen:

| Setting | Value | Notes |
| :--- | :--- | :--- |
| **Framework Preset** | `Vite` (or `Other`) | Vercel will detect Vite automatically. |
| **Root Directory** | `./` (leave default) | Must remain the repository root so PNPM workspace dependencies resolve. |
| **Build Command** | `pnpm --filter @workspace/nexus run build` | Defined in `vercel.json`; override if required. |
| **Output Directory** | `artifacts/nexus/dist/public` | Defined in `vercel.json`; override if required. |
| **Install Command** | `pnpm install` | Vercel uses PNPM natively based on `pnpm-lock.yaml`. |

---

## 4. Environment Variables Configuration

Set the following environment variables in **Vercel Dashboard → Project Settings → Environment Variables**:

| Variable Name | Environment | Description | Expose to Browser? |
| :--- | :--- | :--- | :---: |
| `VITE_SUPABASE_URL` | Production, Preview, Development | Public URL of your Supabase project (e.g. `https://<ref>.supabase.co`) | Yes (public) |
| `VITE_SUPABASE_ANON_KEY` | Production, Preview, Development | Public anonymous API key (or `VITE_SUPABASE_PUBLISHABLE_KEY`) | Yes (public) |

> [!WARNING]
> **Strict Security Rule**: NEVER provide `SUPABASE_SERVICE_ROLE_KEY`, database passwords, or Google OAuth client secrets in Vercel environment variables or client code. All administrative operations are secured at the database layer via PostgreSQL Row Level Security (RLS) policies and security-definer RPC functions.

> [!NOTE]
> Local development credentials in `artifacts/nexus/.env.local` are explicitly excluded from Git by `.gitignore` (line 59) and will never be committed or pushed to remote repositories.

---

## 5. Supabase Authentication & URL Configuration

Once your Vercel deployment URL is generated (e.g., `https://nexus-aicte.vercel.app`):

### Step 5.1: Update Supabase URL Configuration
1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to **Authentication** → **URL Configuration**.
3. Set **Site URL** to your production Vercel URL:
   ```
   https://<your-project>.vercel.app
   ```
4. In **Redirect URLs (Allow list)**, add the following patterns:
   - `https://<your-project>.vercel.app/**`
   - `https://<your-project>.vercel.app/auth/callback`
   - `https://*-<your-team>.vercel.app/**` *(Optional: enables preview branch deployments)*
   - `http://localhost:5173/**` *(Keep for local development)*
   - `http://localhost:5173/auth/callback` *(Keep for local development)*
5. Click **Save**.

---

## 6. Google Cloud Console OAuth Configuration

If Google Sign-In is enabled for your Supabase project:

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Navigate to **APIs & Services** → **Credentials**.
3. Select your **OAuth 2.0 Client ID** (used for Supabase Auth).
4. Under **Authorized JavaScript origins**, add:
   - `https://<your-project>.vercel.app`
   - `http://localhost:5173` *(Keep for local development)*
   - `https://<your-supabase-ref>.supabase.co`
5. Under **Authorized redirect URIs**, confirm:
   - `https://<your-supabase-ref>.supabase.co/auth/v1/callback`
   *(Do NOT change this to the Vercel domain; Google must redirect back to Supabase's auth handler, which then redirects to NEXUS).*
6. Click **Save**.

---

## 7. Git & Deployment Command Reference

### Local Verification Commands (Pre-Deployment)
Before pushing or releasing, verify the local build:

```powershell
# 1. Run all 15 automated verification tests
corepack pnpm test

# 2. Run TypeScript strict typecheck
corepack pnpm --filter @workspace/nexus run typecheck

# 3. Verify clean production build
corepack pnpm --filter @workspace/nexus run build
```

### Git Commit & Push (Only When Approved)
```bash
# Verify status (ensure no untracked secret files)
git status

# Stage deployment configuration files
git add vercel.json artifacts/nexus/vite.config.ts DEPLOYMENT_GUIDE.md

# Commit deployment preparation
git commit -m "build(deploy): prepare vercel deployment configuration and documentation"

# Push to repository (upon user authorization)
git push origin main
```

---

## 8. Post-Deployment Verification Checklist (Smoke Test)

After Vercel completes the initial deployment:

- [ ] **1. Clean Access Gate Landing**:
  - Visit `https://<your-project>.vercel.app/`.
  - Confirm the page renders the Access Gate with the Quiet Intelligence styling (`#F7F5EF` background, warm ivory card, official seal).
  - Verify no console errors or missing asset 404s.

- [ ] **2. Google OAuth Authentication**:
  - Click **Sign in with Google**.
  - Complete the Google OAuth consent flow.
  - Confirm redirection through `/auth/callback` into the main application.

- [ ] **3. Profile & Role Authorization**:
  - Check user profile in top-right header: should display user name, email, and assigned role (`administrator` or `officer`).
  - Verify that approved administrators can see the **Administration** navigation link.

- [ ] **4. SPA Deep Linking & Page Refresh**:
  - Direct navigate to `https://<your-project>.vercel.app/complaints`.
  - Refresh the browser (F5).
  - Confirm the page reloads cleanly without an HTTP 404 error.
  - Deep-link to a specific case: `https://<your-project>.vercel.app/complaints/c-01`.
  - Confirm case details and evidence tabs render correctly.

- [ ] **5. Coordination Review Workflow**:
  - Navigate to `/coordination`.
  - Select candidate coordination item (`Riverbend College of Technology`).
  - Submit a test review decision with rationale (`Valid reason exceeding twelve characters`).
  - Confirm review is written atomically, audit event is recorded, and banner indicates successful review.

- [ ] **6. In-App Notification Center**:
  - Check the notification bell in the top navigation bar.
  - Click the bell to open the notification feed.
  - Mark an unread notification as read; verify unread badge updates immediately.

- [ ] **7. Simulated Demo Mode Isolation**:
  - Sign out or open an Incognito window.
  - Click **Enter Offline Demo Mode** on the Access Gate.
  - Confirm system displays the prominent **Simulated Demonstration Mode** amber banner.
  - Perform actions; confirm no mutations occur against the live Supabase database.
