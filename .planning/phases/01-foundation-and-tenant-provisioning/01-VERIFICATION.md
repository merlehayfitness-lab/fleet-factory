---
phase: 01-foundation-and-tenant-provisioning
verified: 2026-03-25T17:30:00Z
status: passed
score: 20/20 must-haves verified
re_verification: false
human_verification:
  - test: "Sign in flow — sign in with email and password in browser"
    expected: "Redirect to /businesses with session persisted; revisiting /sign-in redirects to /businesses"
    why_human: "Session cookie behavior and redirect flow require browser interaction to fully verify"
  - test: "Create business wizard — submit a new business via the 3-step form"
    expected: "Redirect to /businesses/{id} with business, 4 departments, agents, and a queued deployment visible"
    why_human: "Requires a live Supabase project with schema applied; RPC atomicity and idempotency can only be confirmed against a real database"
  - test: "Tenant isolation — sign in as User B and attempt to access User A's /businesses/{id}"
    expected: "404 Not Found (RLS returns no rows; layout calls notFound())"
    why_human: "RLS enforcement requires two real user accounts in Supabase; cannot verify cross-tenant isolation from code alone"
  - test: "Tenant kill switch — set a business status to 'disabled' in Supabase and reload the dashboard"
    expected: "Business and all its data disappear from the dashboard (RLS helper returns false)"
    why_human: "Requires a live database and a row-level status mutation to exercise the is_business_member() disabled-branch"
---

# Phase 1: Foundation and Tenant Provisioning — Verification Report

**Phase Goal:** Admin can sign in, create a business tenant in one atomic flow, and see the provisioned workspace with departments — all scoped by RLS so tenants never see each other's data

**Verified:** 2026-03-25T17:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Monorepo builds with turbo (apps/web, packages/db, packages/core) | VERIFIED | `turbo.json` defines `tasks` pipeline (Turborepo 2.x format); `pnpm-workspace.yaml` declares `apps/*` and `packages/*`; all three packages exist with valid `package.json` and `tsconfig.json` |
| 2  | All operational tables have RLS enabled | VERIFIED | All 8 SQL files (`001`–`008`) include `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` immediately after `CREATE TABLE`; confirmed individually |
| 3  | RLS policies use `is_business_member()` for SELECT, `has_role_on_business()` for mutations | VERIFIED | `010_rls_policies.sql` references helper functions 38 times across all 8 tables; every SELECT policy uses `is_business_member`, every write policy uses `has_role_on_business` |
| 4  | `is_business_member()` implements tenant kill switch via `b.status != 'disabled'` | VERIFIED | `009_rls_helpers.sql` line 19: `AND b.status != 'disabled'`; same check in `has_role_on_business()` at line 42 |
| 5  | Agent templates are globally readable, writable only via service_role | VERIFIED | `010_rls_policies.sql`: `USING (true)` SELECT policy for authenticated; no INSERT/UPDATE/DELETE policies — mutations require service_role |
| 6  | User can sign in with email/password and is redirected to `/businesses` | VERIFIED | `sign-in/page.tsx` calls `supabase.auth.signInWithPassword()` (not deprecated `signIn`); on success calls `router.push('/businesses')` + `router.refresh()` |
| 7  | Unauthenticated users accessing dashboard routes are redirected to `/sign-in` | VERIFIED | `middleware.ts` calls `updateSession()` which redirects non-public paths to `/sign-in`; `(dashboard)/layout.tsx` adds defense-in-depth `getUser()` check with `redirect('/sign-in')` |
| 8  | User can sign out | VERIFIED | `auth-actions.ts` exports `signOut()` calling `supabase.auth.signOut()` then `redirect('/sign-in')`; sidebar calls it via async wrapper |
| 9  | Business creation is atomic — single Postgres RPC wraps all provisioning steps | VERIFIED | `010_provision_rpc.sql`: `provision_business_tenant()` is `SECURITY DEFINER` `LANGUAGE plpgsql` with steps: auth check → idempotency check → business insert → owner membership → 4 departments (FOREACH loop) → agents from templates (FOR loop) → deployment insert → status update to 'active' |
| 10 | If provisioning fails, entire transaction rolls back | VERIFIED | Postgres `plpgsql` function runs in an implicit transaction; any `RAISE EXCEPTION` or statement error rolls back all prior inserts atomically |
| 11 | Re-running provisioning for the same business slug returns the existing business (idempotent) | VERIFIED | `010_provision_rpc.sql` lines 38–47: `SELECT b.id INTO v_existing_id` where `b.slug = p_slug AND bu.user_id = v_user_id AND bu.role = 'owner'`; returns early if found |
| 12 | RPC seeds 4 departments (Owner, Sales, Support, Operations) | VERIFIED | `010_provision_rpc.sql` line 27: `v_dept_types text[] := ARRAY['owner', 'sales', 'support', 'operations']`; FOREACH loop creates all 4 |
| 13 | RPC creates starter agents from templates per department | VERIFIED | Inner FOR loop in RPC queries `agent_templates WHERE department_type = v_dept_type AND is_active = true` and inserts one agent per matching template |
| 14 | RPC queues a deployment job with status 'queued' | VERIFIED | `010_provision_rpc.sql` line 82: `INSERT INTO public.deployments (business_id, version, status) VALUES (v_business_id, 1, 'queued')` |
| 15 | Create business wizard collects name, slug, industry with auto-generated slug | VERIFIED | `create-business-wizard.tsx`: 3-step form (Business Details → Departments preview → Review & Deploy); `slugify()` function auto-populates slug from name; `slugManuallyEdited` flag stops overwrite when user edits directly |
| 16 | After creation, user is redirected to the new business page | VERIFIED | `business-actions.ts`: on RPC success calls `redirect(\`/businesses/${businessId}\`)` |
| 17 | Admin can see a list of all businesses with status badges | VERIFIED | `businesses/page.tsx` queries `businesses` with `business_users!inner(role)` RLS-scoped; passes to `BusinessList` which renders shadcn `Table` with `StatusBadge` per row |
| 18 | Business overview dashboard shows name, deployment status, agent count, department count, quick links | VERIFIED | `businesses/[id]/page.tsx` fetches business, agentCount, departmentCount, latestDeployment via parallel Supabase queries; `BusinessOverview` component renders 4 stats cards + Quick Links grid + Recent Activity |
| 19 | Departments page shows the 4 seeded departments for a business | VERIFIED | `businesses/[id]/departments/page.tsx` queries `departments` by `business_id` and passes to `DepartmentsList` which renders responsive card grid with type-specific Lucide icons (Crown, TrendingUp, Headphones, Settings) |
| 20 | All data queries are scoped by RLS — no manual tenant filtering in application code | VERIFIED | `businesses/page.tsx` comment confirms intent; no hardcoded `.eq('user_id', ...)` security filters in query chain; `.eq('business_id', id)` is scope selection within user's allowed data, not a security boundary |

**Score:** 20/20 truths verified

---

## Required Artifacts

| Artifact | Plan | Status | Notes |
|----------|------|--------|-------|
| `packages/db/schema/009_rls_helpers.sql` | 01-01 | VERIFIED | Contains `is_business_member()` and `has_role_on_business()` SECURITY DEFINER functions; both check `b.status != 'disabled'` |
| `packages/db/schema/010_rls_policies.sql` | 01-01 | VERIFIED | 23 `CREATE POLICY` statements covering all 8 tables |
| `packages/db/schema/001_businesses.sql` | 01-01 | VERIFIED | `status` field with CHECK constraint on 4 values including 'disabled'; RLS enabled |
| `turbo.json` | 01-01 | VERIFIED | Uses Turborepo 2.x `tasks` key (not `pipeline` — plan artifact check expected `pipeline` but `tasks` is the correct Turborepo 2.x format; not a defect) |
| `pnpm-workspace.yaml` | 01-01 | VERIFIED | `packages: ["apps/*", "packages/*"]` |
| `packages/db/schema/005_agent_templates.sql` | 01-01 | VERIFIED | 4 seed INSERT rows for owner/sales/support/operations with `ON CONFLICT DO NOTHING` |
| `apps/web/_lib/supabase/server.ts` | 01-02 | VERIFIED | Exports `createServerClient()` using `@supabase/ssr`; full cookie getAll/setAll handling |
| `apps/web/_lib/supabase/client.ts` | 01-02 | VERIFIED | Exports `createBrowserClient()` using `@supabase/ssr` |
| `apps/web/_lib/supabase/middleware.ts` | 01-02 | VERIFIED | Exports `updateSession()`; uses `getUser()` not `getSession()`; redirects auth users from auth pages |
| `apps/web/middleware.ts` | 01-02 | VERIFIED | Imports `updateSession`; has correct `matcher` config excluding static assets |
| `apps/web/app/(auth)/sign-in/page.tsx` | 01-02 | VERIFIED | 111 lines; uses `signInWithPassword`, error display, loading state, shadcn UI components |
| `apps/web/app/(dashboard)/layout.tsx` | 01-02 | VERIFIED | Contains `getUser()` defense-in-depth check; renders `SidebarNav` + main content |
| `packages/db/schema/010_provision_rpc.sql` | 01-03 | VERIFIED | `provision_business_tenant()` SECURITY DEFINER with all 5 provisioning steps + idempotency check |
| `packages/core/tenant/schema.ts` | 01-03 | VERIFIED | Exports `createBusinessSchema` (Zod) and `CreateBusinessInput` type |
| `apps/web/_actions/business-actions.ts` | 01-03 | VERIFIED | Exports `createBusiness`; uses 'use server'; validates via `createBusinessSchema`; calls `provisionBusinessTenant` |
| `apps/web/_components/create-business-wizard.tsx` | 01-03 | VERIFIED | 364 lines; 3-step form; react-hook-form + zodResolver; slug auto-generation; calls `createBusiness` action |
| `apps/web/app/(dashboard)/businesses/new/page.tsx` | 01-03 | VERIFIED | Renders `CreateBusinessWizard`; back link present |
| `apps/web/app/(dashboard)/businesses/page.tsx` | 01-04 | VERIFIED | RLS-scoped query; renders `BusinessList` or empty state |
| `apps/web/app/(dashboard)/businesses/[id]/page.tsx` | 01-04 | VERIFIED | Fetches business, agentCount, departmentCount, latestDeployment; renders `BusinessOverview` |
| `apps/web/app/(dashboard)/businesses/[id]/departments/page.tsx` | 01-04 | VERIFIED | Fetches departments by business_id; renders `DepartmentsList` |
| `apps/web/_components/sidebar-nav.tsx` | 01-04 | VERIFIED | 225 lines; uses `usePathname()`; dynamic business sub-nav extracted from URL; user dropdown with sign-out |
| `apps/web/_components/status-badge.tsx` | 01-04 | VERIFIED | Exports `StatusBadge`; maps active/live/provisioning/queued/error/failed/paused/suspended/disabled/retired/rolled_back |

---

## Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `010_rls_policies.sql` | `009_rls_helpers.sql` | RLS policies reference helper functions | WIRED | 38 references to `public.is_business_member` and `public.has_role_on_business` |
| `006_agents.sql` | `005_agent_templates.sql` | `REFERENCES agent_templates` FK | WIRED | `template_id uuid REFERENCES agent_templates` in 006 |
| `middleware.ts` | `_lib/supabase/middleware.ts` | imports `updateSession` | WIRED | Line 1: `import { updateSession } from "./_lib/supabase/middleware"` |
| `(dashboard)/layout.tsx` | `_lib/supabase/server.ts` | `getUser()` auth check | WIRED | `createServerClient()` + `supabase.auth.getUser()` present |
| `sign-in/page.tsx` | `@supabase/ssr` (via client.ts) | `signInWithPassword` | WIRED | `createBrowserClient()` called; `supabase.auth.signInWithPassword({email, password})` executed |
| `business-actions.ts` | `010_provision_rpc.sql` | `supabase.rpc('provision_business_tenant')` | WIRED | `provision.ts` calls `supabase.rpc("provision_business_tenant", {...})` |
| `business-actions.ts` | `packages/core/tenant/schema.ts` | imports `createBusinessSchema` | WIRED | Line 6: `import { createBusinessSchema, provisionBusinessTenant } from "@agency-factory/core"` |
| `create-business-wizard.tsx` | `business-actions.ts` | calls `createBusiness` on submit | WIRED | Line 10: `import { createBusiness } from "@/_actions/business-actions"`; line 131: `await createBusiness(formData)` |
| `businesses/page.tsx` | `_lib/supabase/server.ts` | Server Component fetches via RLS-scoped query | WIRED | `supabase.from("businesses").select("*, business_users!inner(role)")` |
| `businesses/[id]/page.tsx` | `_lib/supabase/server.ts` | Fetches business details, agent/department counts, latest deployment | WIRED | 4 separate Supabase queries covering `businesses`, `agents`, `departments`, `deployments` |
| `businesses/[id]/departments/page.tsx` | `_lib/supabase/server.ts` | Fetches departments via RLS | WIRED | `supabase.from("departments").select("*").eq("business_id", id)` |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AUTH-01 | 01-02 | User can sign in with email and password via Supabase Auth | SATISFIED | `sign-in/page.tsx` uses `signInWithPassword`; redirects to `/businesses` on success |
| AUTH-02 | 01-02 | User session persists across browser refresh | SATISFIED | `updateSession()` in middleware refreshes cookies on every request; cookie-based sessions survive refresh |
| AUTH-03 | 01-02 | User can sign out and session is invalidated | SATISFIED | `auth-actions.ts`: `signOut()` calls `supabase.auth.signOut()` then redirects to `/sign-in` |
| AUTH-04 | 01-02 | Unauthenticated users are redirected to sign-in page | SATISFIED | `middleware.ts` + `(dashboard)/layout.tsx` both redirect to `/sign-in` when no user |
| ISOL-01 | 01-01 | RLS enabled on all operational tables with `is_business_member()` helper | SATISFIED | All 8 tables have `ENABLE ROW LEVEL SECURITY`; `is_business_member()` used across 8 SELECT policies |
| ISOL-02 | 01-01 | Users can only read/write rows for their businesses via business_users membership | SATISFIED | Every table's SELECT policy gates on `is_business_member(business_id)` which joins through `business_users` |
| ISOL-03 | 01-01 | Write operations gated by role on sensitive tables | SATISFIED | INSERT/UPDATE/DELETE policies use `has_role_on_business(business_id, 'owner')` or owner/admin check |
| ISOL-04 | 01-01 | Agent templates globally readable, admin-only writable | SATISFIED | `agent_templates_select_authenticated` policy: `USING (true)`; no INSERT/UPDATE/DELETE policies (service_role only) |
| ISOL-05 | 01-01 | Tenant kill switch disables business without affecting others | SATISFIED | Both RLS helper functions check `b.status != 'disabled'`; setting status to 'disabled' blocks all RLS checks for that tenant only |
| PROV-01 | 01-03 | Admin can create business via wizard (name, slug, industry, departments) | SATISFIED | 3-step wizard at `/businesses/new` collects name/slug/industry; departments shown in step 2 as read-only preview |
| PROV-02 | 01-03 | Business creation uses atomic Postgres RPC | SATISFIED | `provision_business_tenant()` is a single `plpgsql` function; implicit transaction ensures atomicity |
| PROV-03 | 01-03 | 4 default departments seeded per business | SATISFIED | RPC FOREACH loops over `ARRAY['owner', 'sales', 'support', 'operations']` creating all 4 |
| PROV-04 | 01-03 | Starter agents created from matching `agent_templates` per department | SATISFIED | Inner FOR loop queries `agent_templates WHERE department_type = v_dept_type AND is_active = true` and inserts agents |
| PROV-05 | 01-03 | Deployment job created with status 'queued' upon provisioning | SATISFIED | RPC inserts into `deployments` with `status='queued'` before returning |
| PROV-06 | 01-03 | Provisioning is idempotent-safe | SATISFIED | RPC checks for existing business by slug + user_id + role='owner'; returns existing ID if found |
| DASH-01 | 01-02 | Sign-in page exists | SATISFIED | `app/(auth)/sign-in/page.tsx` renders full email/password form |
| DASH-02 | 01-04 | Businesses list page with status badges | SATISFIED | `businesses/page.tsx` renders shadcn Table via `BusinessList` with `StatusBadge` per row |
| DASH-03 | 01-03 | Create business wizard (multi-step) | SATISFIED | `create-business-wizard.tsx`: 3 steps (Business Details, Departments, Review & Deploy); step navigation with validation |
| DASH-04 | 01-04 | Business overview dashboard (health, agents, approvals, activity, deployment status, quick links) | SATISFIED | `business-overview.tsx`: 4 stats cards + Quick Links grid + Recent Activity placeholder |
| DASH-05 | 01-04 | Departments setup page per business | SATISFIED | `businesses/[id]/departments/page.tsx` + `departments-list.tsx`: responsive grid with type icons |

All 20 requirement IDs declared across the 4 plans are accounted for. No orphaned requirements found.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/_lib/supabase/client.ts` | 9–10 | Uses `!` (non-null assertion) on env vars directly instead of `getSupabaseUrl()`/`getSupabaseAnonKey()` helpers | INFO | Minor inconsistency with CLAUDE.md rule "Put environment variable access behind helper functions". The `!` assertion silences TS but would produce a runtime error from Supabase SDK rather than a clear descriptive error message. Does not affect correctness. |
| `apps/web/_components/business-overview.tsx` | 151 | "No recent activity" placeholder for Recent Activity section | INFO | Intentional deferred feature (audit_logs populated in later phases). Clearly labeled in component and plan. Not a stub — the section is designed to remain empty in Phase 1. |
| `apps/web/_components/sidebar-nav.tsx` | 72–94 | Deployments/Approvals/Tasks/Logs sub-nav items are disabled (`enabled: false`) | INFO | Intentional deferred feature (Phases 3–5). Rendered as `<span>` with `cursor-not-allowed`. Not blocking Phase 1 goals. |

No blockers or stubs that prevent Phase 1 goal achievement.

---

## Human Verification Required

### 1. Sign-in flow

**Test:** Open the app, navigate to `/sign-in`, enter valid credentials, submit the form.
**Expected:** Redirect to `/businesses`; session survives a hard browser refresh; revisiting `/sign-in` redirects back to `/businesses`.
**Why human:** Cookie persistence and redirect chain require actual browser execution.

### 2. Business creation end-to-end

**Test:** With a live Supabase project (schema applied), complete the 3-step wizard at `/businesses/new`.
**Expected:** Redirect to `/businesses/{id}`; business overview shows 4 departments, correct agent count (4), deployment status 'queued'.
**Why human:** Requires a live Supabase database with the SQL migrations applied; RPC atomicity cannot be verified from static code inspection alone.

### 3. Tenant isolation

**Test:** Create two user accounts (User A, User B). User A creates a business. Log in as User B and attempt to access User A's `/businesses/{id}`.
**Expected:** 404 Not Found — the `[id]/layout.tsx` calls `notFound()` when `supabase.from('businesses').select('id').eq('id', id).single()` returns null (RLS blocks it).
**Why human:** Requires two real Supabase user accounts to exercise cross-tenant boundary.

### 4. Tenant kill switch

**Test:** In Supabase dashboard, update a business row to `status = 'disabled'`. Reload the admin's dashboard.
**Expected:** The business disappears from the `/businesses` list; accessing `/businesses/{id}` returns 404 (RLS helper returns false for disabled businesses).
**Why human:** Requires a live database mutation and real RLS evaluation by Postgres.

---

## Notable Observations

1. **Turborepo 2.x format:** `turbo.json` correctly uses `tasks` (not `pipeline`). Plan 01-01's artifact check pattern looked for `"pipeline"` but the actual key `"tasks"` is the correct Turborepo 2.x format. This is not a defect — the plan's check pattern was outdated.

2. **Middleware redirects authenticated users away from auth pages:** `updateSession()` includes a forward-redirect (authenticated users visiting `/sign-in` or `/sign-up` are redirected to `/businesses`). This was listed as a key decision in 01-02 and is implemented correctly.

3. **`client.ts` bypasses env helpers:** Minor inconsistency — uses `process.env.NEXT_PUBLIC_SUPABASE_URL!` directly rather than calling `getSupabaseUrl()`. The `!` assertion means a missing env var produces a cryptic Supabase initialization error rather than the descriptive throw from the helper. Low severity, does not affect Phase 1 goal.

4. **All 8 task commits verified in git history:** Commits `0a0608d`, `f1180fb`, `7ea790c`, `359f619`, `af23e48`, `46d870a`, `48b3a95`, `a5c69d0` all present in the repository's commit log.

---

_Verified: 2026-03-25T17:30:00Z_
_Verifier: Claude (gsd-verifier)_
