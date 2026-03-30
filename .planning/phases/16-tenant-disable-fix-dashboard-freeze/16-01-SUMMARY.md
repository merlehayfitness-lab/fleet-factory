---
phase: 16-tenant-disable-fix-dashboard-freeze
plan: 01
subsystem: vps, emergency, ui
tags: [vps-lifecycle, tenant-disable, mutation-guard, react-context, suspended-banner]

# Dependency graph
requires:
  - phase: 05-health-emergency-chat
    provides: "Emergency service with disableTenant/restoreTenant and emergency-actions Server Actions"
  - phase: 06-vps-runtime-integration
    provides: "VPS client (vpsPost, vpsGet) and vps-config (isVpsConfigured)"
provides:
  - "pauseTenantContainers and resumeTenantContainers VPS lifecycle functions"
  - "requireActiveBusiness Server Action guard for blocking mutations on disabled tenants"
  - "BusinessStatusProvider React Context with useBusinessStatus hook"
  - "SuspendedBanner component with inline restore confirm flow"
  - "Extended disableTenant/restoreTenant with VPS container lifecycle calls"
affects: [16-02-PLAN, 16-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: ["best-effort VPS lifecycle (never throw, graceful no-op)", "Server Action mutation guard pattern", "React Context for business status propagation"]

key-files:
  created:
    - packages/core/vps/vps-lifecycle.ts
    - apps/web/_lib/require-active-business.ts
    - apps/web/_components/business-status-provider.tsx
    - apps/web/_components/suspended-banner.tsx
  modified:
    - packages/core/emergency/emergency-service.ts
    - packages/core/server.ts

key-decisions:
  - "VPS lifecycle uses catch-all error handling returning result objects instead of throwing"
  - "SuspendedBanner uses inline confirm/cancel buttons instead of window.confirm for better UX"

patterns-established:
  - "requireActiveBusiness guard: call at top of every mutation Server Action before writes"
  - "BusinessStatusProvider: wrap business layout children, consume via useBusinessStatus hook"
  - "VPS lifecycle best-effort: never throw, return { success, error } objects"

requirements-completed: [TFIX-01, TFIX-02, TFIX-03, TFIX-04]

# Metrics
duration: 2min
completed: 2026-03-30
---

# Phase 16 Plan 01: Tenant Disable Fix - Backend Enforcement & UI Foundations Summary

**VPS container pause/resume lifecycle, requireActiveBusiness mutation guard, and BusinessStatusProvider context with SuspendedBanner for disabled tenant dashboard**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-30T12:19:03Z
- **Completed:** 2026-03-30T12:21:03Z
- **Tasks:** 1
- **Files modified:** 6

## Accomplishments
- VPS lifecycle module with pauseTenantContainers/resumeTenantContainers that gracefully handle missing VPS config and unreachable servers
- Extended disableTenant to stop VPS containers (step 5) and restoreTenant to resume VPS containers (step 3), both best-effort non-blocking
- requireActiveBusiness guard function ready for all mutation Server Actions (checks disabled/suspended status)
- BusinessStatusProvider React Context with useBusinessStatus hook for client-side status propagation
- SuspendedBanner sticky component with restore button, inline confirm dialog, and loading/error states

## Task Commits

Each task was committed atomically:

1. **Task 1: VPS lifecycle module, extended emergency service, guard function, and context/banner components** - `fc4399e` (feat)

**Plan metadata:** `2abb60c` (docs: complete plan)

## Files Created/Modified
- `packages/core/vps/vps-lifecycle.ts` - VPS container pause/resume functions (best-effort, never throw)
- `packages/core/emergency/emergency-service.ts` - Extended disableTenant/restoreTenant with VPS lifecycle calls
- `packages/core/server.ts` - Re-exports pauseTenantContainers/resumeTenantContainers
- `apps/web/_lib/require-active-business.ts` - Server Action guard blocking mutations on disabled/suspended businesses
- `apps/web/_components/business-status-provider.tsx` - React Context for business status with useBusinessStatus hook
- `apps/web/_components/suspended-banner.tsx` - Sticky banner with restore button and inline confirm flow

## Decisions Made
- VPS lifecycle uses catch-all error handling returning result objects instead of throwing -- consistent with best-effort pattern from CONTEXT.md
- SuspendedBanner uses inline confirm/cancel buttons instead of window.confirm for better UX and dark mode compatibility

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- requireActiveBusiness guard ready for Plan 02 to wire into all mutation Server Actions
- BusinessStatusProvider and SuspendedBanner ready for Plan 03 to integrate into the business layout
- VPS lifecycle functions integrated into emergency service and re-exported via core/server.ts

---
*Phase: 16-tenant-disable-fix-dashboard-freeze*
*Completed: 2026-03-30*
