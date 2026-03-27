---
phase: 06-builder-and-automation
plan: 02
subsystem: deployment, vps, ui
tags: [vps, deployment, websocket, health-check, openclaw, rollback, streaming]

# Dependency graph
requires:
  - phase: 06-builder-and-automation
    provides: VPS client module, OpenClaw workspace generators, VPS status tables, deployment lifecycle with verifying state
  - phase: 03-deployment-pipeline
    provides: deployment service, config snapshot, runtime generators
  - phase: 05-observability-and-command-center
    provides: health service, health dashboard component
provides:
  - VPS deploy service with push, per-agent deploy, rollback, and post-deploy health checks
  - Deployment pipeline evolution with OpenClaw workspace generation and VPS push
  - Serial deployment queuing guard preventing concurrent VPS deployments
  - VPS status indicator component for dashboard
  - Real-time deployment progress stream via WebSocket
  - Claude Code optimization diff viewer
  - Per-agent deployment via deployAgentAction server action
  - VPS health and status server actions
affects: [06-03-vps-api, 06-04-realtime-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [VPS deployment push with partial failure handling, WebSocket-based deployment progress streaming, serial deployment queuing guard]

key-files:
  created:
    - packages/core/vps/vps-deploy.ts
    - apps/web/_actions/vps-actions.ts
    - apps/web/_components/vps-status-indicator.tsx
    - apps/web/_components/deployment-progress-stream.tsx
    - apps/web/_components/deployment-diff-viewer.tsx
  modified:
    - packages/core/deployment/service.ts
    - packages/core/deployment/snapshot.ts
    - packages/core/health/health-service.ts
    - packages/core/server.ts
    - apps/web/_actions/deployment-actions.ts
    - apps/web/_components/health-dashboard.tsx
    - apps/web/_components/deployment-center.tsx
    - apps/web/_components/deployment-detail.tsx
    - apps/web/app/(dashboard)/businesses/[id]/deployments/page.tsx
    - apps/web/app/(dashboard)/businesses/[id]/page.tsx

key-decisions:
  - "Re-exported generateOpenClawWorkspace through core/server.ts to avoid direct runtime import from web app"
  - "Serial deployment guard checks for active deployments with status building/deploying/verifying and excludes self"
  - "VPS push integrated into existing deployment pipeline with graceful local-only fallback"
  - "WebSocket URL generated server-side and passed through component chain as a string prop"

patterns-established:
  - "VPS deploy flow: deploying -> verifying (health check) -> live with partial failure tolerance"
  - "Serial queuing: check for active VPS deployments before starting new one"
  - "Rollback uses skipOptimization=true for deterministic restore without Claude Code review"

requirements-completed: [DEPL-VPS-02, DEPL-VPS-03, DEPL-VPS-04, DEPL-VPS-05, DEPL-VPS-06, DEPL-VPS-07, DEPL-VPS-08, DEPL-VPS-09, DEPL-VPS-10]

# Metrics
duration: 10min
completed: 2026-03-27
---

# Phase 6 Plan 02: Deployment Pipeline VPS Integration Summary

**VPS deploy service pushing OpenClaw workspaces to VPS with health checks, real-time WebSocket progress streaming, optimization diff viewer, and serial deployment queuing**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-27T11:07:17Z
- **Completed:** 2026-03-27T11:17:50Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- VPS deploy service handles full-tenant, per-agent, and rollback deployments with partial failure tolerance
- Deployment pipeline generates OpenClaw workspace artifacts and pushes to VPS when configured, falls back to local-only when not
- Real-time deployment progress stream via WebSocket with CI/CD-style vertical stepper and expandable detail
- Dashboard VPS status indicator with color-coded badge, warning banners for offline/degraded states
- Claude Code optimization diff viewer displays per-file changes from deployment review
- Serial deployment queuing prevents concurrent VPS deployments per business

## Task Commits

Each task was committed atomically:

1. **Task 1: VPS deploy service, pipeline evolution, rollback, and health checks** - `037298e` (feat)
2. **Task 2: VPS status indicator, deployment progress stream, diff viewer, and UI wiring** - `50397d7` (feat)

## Files Created/Modified
- `packages/core/vps/vps-deploy.ts` - VPS deployment push service with pushDeploymentToVps, pushAgentToVps, pushRollbackToVps, runPostDeployHealthCheck
- `packages/core/deployment/service.ts` - Extended with OpenClaw workspace generation, VPS push, serial deployment guard, rollback VPS support
- `packages/core/deployment/snapshot.ts` - ConfigSnapshot extended with openclaw_workspace field
- `packages/core/health/health-service.ts` - SystemHealth extended with vpsStatus, getSystemHealth fetches VPS status from database
- `packages/core/server.ts` - Added VPS deploy exports and generateOpenClawWorkspace re-export
- `apps/web/_actions/deployment-actions.ts` - Added deployAgentAction for per-agent VPS deployment
- `apps/web/_actions/vps-actions.ts` - Server actions for VPS health check and status polling
- `apps/web/_components/vps-status-indicator.tsx` - Color-coded VPS health badge with manual refresh
- `apps/web/_components/deployment-progress-stream.tsx` - WebSocket-based real-time deployment progress with phase stepper
- `apps/web/_components/deployment-diff-viewer.tsx` - Claude Code optimization report display with collapsible file changes
- `apps/web/_components/health-dashboard.tsx` - Added VPS status indicator and offline/degraded warning banners
- `apps/web/_components/deployment-center.tsx` - Extended to thread VPS props through to DeploymentDetail
- `apps/web/_components/deployment-detail.tsx` - Renders DeploymentProgressStream and DeploymentDiffViewer
- `apps/web/app/(dashboard)/businesses/[id]/deployments/page.tsx` - Generates VPS WebSocket URL for active deployments
- `apps/web/app/(dashboard)/businesses/[id]/page.tsx` - Passes vpsStatus to HealthDashboard

## Decisions Made
- Re-exported generateOpenClawWorkspace through core/server.ts because the web app does not (and should not) depend on @agency-factory/runtime directly. This follows the existing pattern where core re-exports runtime functions for server-only use.
- Serial deployment guard explicitly excludes the current deployment ID to prevent self-blocking on initial creation.
- VPS push is integrated as a conditional branch within the existing deployment pipeline rather than a separate function, preserving the local-only fallback path.
- WebSocket URL is generated server-side by createVpsWebSocket and passed as a string through the component chain, so the client component can connect directly without needing access to VPS credentials.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Re-exported generateOpenClawWorkspace through core/server.ts**
- **Found during:** Task 1 (deployment-actions.ts import)
- **Issue:** deployment-actions.ts imported generateOpenClawWorkspace from @agency-factory/runtime, but the web app package.json does not include runtime as a dependency. TypeScript could not resolve the module.
- **Fix:** Added `export { generateOpenClawWorkspace } from "@agency-factory/runtime"` to packages/core/server.ts and updated the import in deployment-actions.ts to use @agency-factory/core/server.
- **Files modified:** packages/core/server.ts, apps/web/_actions/deployment-actions.ts
- **Verification:** `pnpm turbo typecheck` passes with no errors
- **Committed in:** 037298e (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to resolve module resolution for web app. Follows existing re-export pattern. No scope creep.

## Issues Encountered
None beyond the import path issue addressed above.

## User Setup Required
None - VPS env vars (VPS_API_URL, VPS_API_KEY) remain optional. System degrades gracefully without them, using local-only deployment path.

## Next Phase Readiness
- VPS deploy service ready for 06-03 (VPS API endpoints) to call from the VPS side
- WebSocket progress stream ready to consume events from VPS deployment runner
- Health check infrastructure ready for 06-04 (real-time dashboard) to poll and display
- Diff viewer ready to display optimization reports returned from VPS

## Self-Check: PASSED

All 5 created files verified present. All 2 task commits verified in git log.

---
*Phase: 06-builder-and-automation*
*Completed: 2026-03-27*
