---
phase: 03-deployment-pipeline
plan: 03
subsystem: ui, deployment, secrets
tags: [split-view, stepper, artifact-viewer, deploy-button, rollback, secrets-manager, encrypted-credentials]

# Dependency graph
requires:
  - phase: 03-deployment-pipeline
    plan: 01
    provides: "Runtime config generators, AES-256-GCM encryption, integration adapters"
  - phase: 03-deployment-pipeline
    plan: 02
    provides: "Deployment state machine, triggerDeployment/retry/rollback services, Server Actions, config snapshot"
  - phase: 01-foundation-and-tenant-provisioning
    provides: "businesses, agents, departments tables with RLS, sidebar nav, business overview"
provides:
  - "Deployment center page at /businesses/[id]/deployments with split-view layout"
  - "7 UI components: deployment-list, deployment-detail, deployment-stepper, artifact-viewer, deploy-button, rollback-dialog, deployment-center"
  - "Secrets management page at /businesses/[id]/settings/secrets with categorized encrypted credential storage"
  - "Secrets CRUD service in packages/core/secrets with encrypt/decrypt integration"
  - "Secrets Server Actions for save/delete with audit logging"
  - "Enabled Deployments link in sidebar nav and business overview quick links"
affects: [04-agent-execution, 05-observability]

# Tech tracking
tech-stack:
  added: ["@radix-ui/react-scroll-area (via shadcn scroll-area)", "@base-ui/collapsible (via shadcn collapsible)"]
  patterns: ["split-view layout with client state management for selected item", "per-stage error timeline inspired by GitHub Actions", "smart deploy button (one-click first deploy, confirm dialog for redeploy)", "server-only secrets service with encrypted-at-rest pattern"]

key-files:
  created:
    - apps/web/app/(dashboard)/businesses/[id]/deployments/page.tsx
    - apps/web/_components/deployment-list.tsx
    - apps/web/_components/deployment-detail.tsx
    - apps/web/_components/deployment-stepper.tsx
    - apps/web/_components/artifact-viewer.tsx
    - apps/web/_components/deploy-button.tsx
    - apps/web/_components/rollback-dialog.tsx
    - apps/web/_components/deployment-center.tsx
    - apps/web/app/(dashboard)/businesses/[id]/settings/secrets/page.tsx
    - apps/web/_components/secrets-manager.tsx
    - apps/web/_actions/secrets-actions.ts
    - packages/core/secrets/service.ts
    - apps/web/components/ui/collapsible.tsx
    - apps/web/components/ui/scroll-area.tsx
  modified:
    - apps/web/_components/sidebar-nav.tsx
    - apps/web/_components/business-overview.tsx
    - packages/core/server.ts
    - apps/web/package.json

key-decisions:
  - "Used CollapsibleTrigger directly instead of asChild pattern -- base-ui Collapsible does not support asChild prop"
  - "Select onValueChange wrapped with null guard for base-ui compatibility (value can be string | null)"
  - "Secrets never decrypted client-side -- reveal button shows 'Value stored securely' confirmation only"
  - "Deployment center uses client wrapper component to manage selected deployment state across list and detail panels"

patterns-established:
  - "Split-view layout pattern: Server Component fetches data, client wrapper manages selection state, left panel list and right panel detail"
  - "Smart confirm pattern: one-click for initial action, confirmation dialog for repeated/destructive actions"
  - "Per-stage error timeline: derive stage statuses from deployment record, expand failed stage with error and retry"
  - "Secrets encrypted at rest, masked in UI, decrypted only server-side during deployment artifact generation"

requirements-completed: [DEPL-01, DASH-08]

# Metrics
duration: 7min
completed: 2026-03-25
---

# Phase 3 Plan 3: Deployment Center UI Summary

**Split-view deployment center with status stepper, artifact viewer, deploy/retry/rollback controls, and secrets management page with encrypted credential storage**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-25T22:44:40Z
- **Completed:** 2026-03-25T22:52:03Z
- **Tasks:** 2
- **Files modified:** 18

## Accomplishments
- Built deployment center page with split-view layout (1/3 list, 2/3 detail) at /businesses/[id]/deployments
- Created 8 UI components: deployment stepper (4-step progress), artifact viewer (code blocks with download), deploy button (smart confirm), rollback dialog, deployment list (with config diff), deployment detail (with per-stage error timeline), deployment center (client wrapper)
- Added secrets management page at /businesses/[id]/settings/secrets with categorized display, add form, masked values, and delete confirmation
- Created secrets CRUD service with encrypt/decrypt integration and audit logging
- Enabled Deployments link in sidebar nav and business overview quick links

## Task Commits

Each task was committed atomically:

1. **Task 1: Deployment center page with split-view, stepper, and artifact viewer** - `3de8453` (feat)
2. **Task 2: Secrets management page and service** - `20c1e8c` (feat)

## Files Created/Modified
- `apps/web/app/(dashboard)/businesses/[id]/deployments/page.tsx` - Server Component fetching business, deployments, agent count
- `apps/web/_components/deployment-center.tsx` - Client wrapper managing selected deployment state
- `apps/web/_components/deployment-list.tsx` - Left panel with scrollable deployment history, version, status, config diff
- `apps/web/_components/deployment-detail.tsx` - Right panel with stepper, stage timeline, artifacts, config snapshot
- `apps/web/_components/deployment-stepper.tsx` - Horizontal 4-step progress (Queued->Building->Deploying->Live)
- `apps/web/_components/artifact-viewer.tsx` - Code block viewer with download button
- `apps/web/_components/deploy-button.tsx` - Smart deploy/redeploy with one-click or confirmation dialog
- `apps/web/_components/rollback-dialog.tsx` - Rollback selection dialog with version list
- `apps/web/app/(dashboard)/businesses/[id]/settings/secrets/page.tsx` - Server Component for secrets page
- `apps/web/_components/secrets-manager.tsx` - Categorized secret management with add form and masked display
- `apps/web/_actions/secrets-actions.ts` - Server Actions for save/delete secrets
- `packages/core/secrets/service.ts` - Secrets CRUD service with encrypt/decrypt
- `packages/core/server.ts` - Added secrets service exports
- `apps/web/_components/sidebar-nav.tsx` - Enabled Deployments link
- `apps/web/_components/business-overview.tsx` - Enabled Deployments quick link
- `apps/web/components/ui/collapsible.tsx` - shadcn/ui Collapsible component
- `apps/web/components/ui/scroll-area.tsx` - shadcn/ui ScrollArea component
- `apps/web/package.json` - Updated dependencies for new shadcn components

## Decisions Made
- Used CollapsibleTrigger directly with className styling instead of asChild pattern -- base-ui Collapsible does not support the asChild prop (consistent with existing project pattern for base-ui)
- Wrapped Select onValueChange with null guard (`(v) => v && setter(v)`) for base-ui compatibility where value can be `string | null`
- Secrets are never decrypted client-side -- the reveal button shows "Value stored securely" confirmation text, not the actual value. Decryption only happens server-side during deployment artifact generation
- Deployment center uses a client wrapper component (`DeploymentCenter`) to manage selected deployment state, while the page Server Component handles all data fetching

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed asChild from CollapsibleTrigger**
- **Found during:** Task 1 (deployment detail component)
- **Issue:** `asChild` prop does not exist on base-ui CollapsibleTrigger, causing TS2322 type error
- **Fix:** Replaced `CollapsibleTrigger asChild` wrapping a `Button` with direct `CollapsibleTrigger` with Tailwind classes
- **Files modified:** apps/web/_components/deployment-detail.tsx
- **Verification:** `pnpm turbo typecheck` passes cleanly
- **Committed in:** 3de8453 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed Select onValueChange type mismatch**
- **Found during:** Task 2 (secrets manager component)
- **Issue:** base-ui Select's onValueChange passes `string | null` but `useState<string>` setter expects `string`, causing TS2322 type error
- **Fix:** Wrapped onValueChange callbacks with null guards: `(v) => v && setNewCategory(v)` and `(v) => setNewIntegrationType(v ?? "")`
- **Files modified:** apps/web/_components/secrets-manager.tsx
- **Verification:** `pnpm turbo typecheck` passes cleanly
- **Committed in:** 20c1e8c (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both auto-fixes necessary for TypeScript compilation with base-ui components. No scope creep.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no new external service configuration required. Database migrations and ENCRYPTION_KEY were documented in 03-01-SUMMARY.md.

## Next Phase Readiness
- Deployment center UI complete and integrated into sidebar navigation
- All deployment operations (deploy, retry, rollback) functional via Server Actions
- Secrets management page ready for credential storage
- Ready for 03-04 (final phase integration/testing if applicable)
- Ready for Phase 4 (agent execution) and Phase 5 (observability)

## Self-Check: PASSED

- All 14 created files verified present on disk
- Commit 3de8453 (Task 1) verified in git log
- Commit 20c1e8c (Task 2) verified in git log
- `pnpm turbo typecheck` passes across all 4 packages
- `pnpm turbo build` passes with all routes compiling successfully

---
*Phase: 03-deployment-pipeline*
*Completed: 2026-03-25*
