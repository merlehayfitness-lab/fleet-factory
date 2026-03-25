---
phase: 01-foundation-and-tenant-provisioning
plan: 03
subsystem: database, provisioning, ui
tags: [postgres-rpc, atomic-transactions, zod-v4, react-hook-form, shadcn-ui, server-actions, multi-step-wizard, tenant-provisioning]

# Dependency graph
requires:
  - phase: 01-foundation-and-tenant-provisioning (plan 01)
    provides: Postgres schema with 8 tables, RLS helpers, agent template seeds
  - phase: 01-foundation-and-tenant-provisioning (plan 02)
    provides: Supabase Auth, createServerClient(), middleware route protection, shadcn/ui
provides:
  - provision_business_tenant() Postgres RPC for atomic tenant provisioning
  - Zod validation schema (createBusinessSchema) for business input
  - provisionBusinessTenant() thin wrapper for Server Action use
  - Domain types (BusinessStatus, UserRole, DepartmentType, AgentStatus, DeploymentStatus)
  - createBusiness Server Action with auth + validation + RPC call
  - Multi-step create business wizard at /businesses/new
  - shadcn/ui Select, Badge, and Textarea components
affects: [01-04-PLAN, phase-02, phase-03]

# Tech tracking
tech-stack:
  added: [zod@4, react-hook-form@7, @hookform/resolvers]
  patterns: [atomic-rpc-provisioning, thin-server-action, multi-step-wizard, slug-auto-generation, zod-form-validation]

key-files:
  created:
    - packages/db/schema/010_provision_rpc.sql
    - packages/core/types/index.ts
    - packages/core/tenant/schema.ts
    - packages/core/tenant/provision.ts
    - apps/web/_actions/business-actions.ts
    - apps/web/_components/create-business-wizard.tsx
    - apps/web/app/(dashboard)/businesses/new/page.tsx
    - apps/web/components/ui/select.tsx
    - apps/web/components/ui/badge.tsx
    - apps/web/components/ui/textarea.tsx
  modified:
    - packages/core/index.ts
    - packages/core/package.json
    - apps/web/package.json
    - pnpm-lock.yaml

key-decisions:
  - "Removed .default('general') from Zod schema to avoid input/output type mismatch with react-hook-form resolver; default handled via form defaultValues instead"
  - "Thin Server Action pattern: createBusiness is under 20 lines, delegates all logic to core package + RPC"
  - "Multi-step wizard implemented with local state (useState) for step navigation rather than URL-based routing"
  - "Slug auto-generation from business name with manual override via slugManuallyEdited flag"

patterns-established:
  - "Server Actions in _actions/ validate via Zod, check auth, delegate to packages/core"
  - "App-specific components in _components/ directory (separate from shadcn components/ui/)"
  - "Form validation: react-hook-form + zodResolver + schemas from @agency-factory/core"
  - "Atomic provisioning: all multi-table operations via Postgres RPC, never sequential inserts"

requirements-completed: [PROV-01, PROV-02, PROV-03, PROV-04, PROV-05, PROV-06, DASH-03]

# Metrics
duration: 8min
completed: 2026-03-25
---

# Phase 1 Plan 03: Atomic Provisioning RPC + Create Business Wizard Summary

**Postgres provision_business_tenant() RPC with idempotent atomic transaction, Zod v4 validation schemas in @agency-factory/core, and a 3-step create business wizard using react-hook-form at /businesses/new**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-25T16:25:04Z
- **Completed:** 2026-03-25T16:33:46Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Created provision_business_tenant() SECURITY DEFINER RPC that atomically creates business, owner membership, 4 departments, agents from templates, and a queued deployment in a single Postgres transaction
- Built idempotency check into the RPC -- re-running with the same slug returns the existing business ID (PROV-06)
- Established @agency-factory/core as the shared domain package with Zod schemas, domain types, and provisioning logic
- Built a 3-step create business wizard (Business Details, Departments preview, Review & Deploy) with auto-slug generation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create provision_business_tenant() RPC and core validation schemas** - `af23e48` (feat)
2. **Task 2: Create business creation Server Action and wizard UI** - `46d870a` (feat)

## Files Created/Modified
- `packages/db/schema/010_provision_rpc.sql` - Atomic tenant provisioning RPC with auth check, idempotency, department seeding, agent creation, deployment queuing
- `packages/core/types/index.ts` - Domain type definitions (BusinessStatus, UserRole, DepartmentType, AgentStatus, DeploymentStatus)
- `packages/core/tenant/schema.ts` - Zod v4 createBusinessSchema with name, slug, industry validation
- `packages/core/tenant/provision.ts` - Thin provisionBusinessTenant() wrapper calling supabase.rpc()
- `packages/core/index.ts` - Re-exports from types, tenant/schema, and tenant/provision
- `apps/web/_actions/business-actions.ts` - createBusiness Server Action with auth check, Zod validation, RPC delegation
- `apps/web/_components/create-business-wizard.tsx` - Multi-step form with react-hook-form, slug auto-generation, department preview, review step
- `apps/web/app/(dashboard)/businesses/new/page.tsx` - New business wizard page with heading and back link
- `apps/web/components/ui/select.tsx` - shadcn/ui Select component (base-ui)
- `apps/web/components/ui/badge.tsx` - shadcn/ui Badge component
- `apps/web/components/ui/textarea.tsx` - shadcn/ui Textarea component

## Decisions Made
- Removed `.default('general')` from Zod schema to resolve input/output type mismatch between Zod v4 and react-hook-form zodResolver -- the default is handled via form `defaultValues` instead
- Server Action returns `{ error: string }` on failure rather than throwing -- lets the form component display errors inline
- Wizard uses local state for step navigation rather than URL-based routing (simpler for MVP, step state preserved during navigation)
- Slug auto-generation uses a slugManuallyEdited flag to stop overwriting if the user edits the slug directly

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Zod schema type mismatch with react-hook-form**
- **Found during:** Task 2 (wizard UI implementation)
- **Issue:** Zod `.default()` creates different input and output types. zodResolver infers the input type (industry optional), but useForm generic expected the output type (industry required), causing TS2322 type incompatibility.
- **Fix:** Removed `.default('general')` from the Zod schema; default is now provided by form `defaultValues` which keeps input and output types identical.
- **Files modified:** packages/core/tenant/schema.ts
- **Verification:** `pnpm turbo typecheck` passes, `pnpm turbo build` passes
- **Committed in:** `46d870a` (Task 2 commit)

**2. [Rule 1 - Bug] Fixed base-ui Select onValueChange null type**
- **Found during:** Task 2 (wizard UI implementation)
- **Issue:** base-ui Select's `onValueChange` callback passes `string | null`, but `setValue("industry", val)` expects `string`. TypeScript error TS2345.
- **Fix:** Added null guard: `if (val) setValue("industry", val)` to ignore null deselection events.
- **Files modified:** apps/web/_components/create-business-wizard.tsx
- **Verification:** `pnpm turbo typecheck` passes
- **Committed in:** `46d870a` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes were necessary for type safety. No scope creep.

## Issues Encountered

None beyond the type issues documented in deviations above.

## User Setup Required

None - no external service configuration required. The RPC function will need to be applied to the Supabase database (alongside all other schema SQL files), but that is handled during database setup.

## Next Phase Readiness
- Provisioning pipeline is complete end-to-end: wizard form -> Server Action -> Postgres RPC -> atomic tenant creation
- Ready for Plan 04 (Business listing + overview dashboard) which will query the provisioned data
- @agency-factory/core package is established with domain types and validation schemas for reuse
- All shadcn/ui components needed for forms are installed (Button, Card, Input, Label, Select, Badge)

## Self-Check: PASSED

All 10 key files verified present. Both task commits (af23e48, 46d870a) verified in git history. Build and typecheck pass.

---
*Phase: 01-foundation-and-tenant-provisioning*
*Completed: 2026-03-25*
