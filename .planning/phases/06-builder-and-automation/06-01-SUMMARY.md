---
phase: 06-builder-and-automation
plan: 01
subsystem: runtime, database, infra
tags: [openclaw, vps, workspace-generator, deployment, docker, websocket]

# Dependency graph
requires:
  - phase: 03-deployment-pipeline
    provides: deployment service, config snapshot, runtime generators
  - phase: 05-observability-and-command-center
    provides: health service patterns, agent status tracking
provides:
  - VPS status and agent_vps_status database tables for deployment health tracking
  - VPS HTTP client module with API key auth for VPS communication
  - Seven OpenClaw workspace generators producing AGENTS.md, SOUL.md, IDENTITY.md, TOOLS.md, USER.md, openclaw.json
  - Workspace orchestrator that assembles complete deployment packages per business
  - deriveVpsAgentId naming convention as single source of truth
  - DeploymentStatus extended with "verifying" state
affects: [06-02-deployment-runner, 06-03-vps-api, 06-04-realtime-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [OpenClaw workspace file generation, VPS HTTP client with graceful degradation, namespaced agent ID convention]

key-files:
  created:
    - packages/db/schema/027_vps_status_table.sql
    - packages/db/schema/028_agent_vps_status_table.sql
    - packages/db/schema/029_deployments_vps_columns.sql
    - packages/core/vps/vps-types.ts
    - packages/core/vps/vps-naming.ts
    - packages/core/vps/vps-config.ts
    - packages/core/vps/vps-client.ts
    - packages/core/vps/vps-health.ts
    - packages/runtime/generators/openclaw-agents-md.ts
    - packages/runtime/generators/openclaw-soul-md.ts
    - packages/runtime/generators/openclaw-identity-md.ts
    - packages/runtime/generators/openclaw-tools-md.ts
    - packages/runtime/generators/openclaw-user-md.ts
    - packages/runtime/generators/openclaw-config.ts
    - packages/runtime/generators/openclaw-workspace.ts
  modified:
    - packages/db/schema/_combined_schema.sql
    - packages/core/types/index.ts
    - packages/core/deployment/lifecycle.ts
    - packages/core/index.ts
    - packages/core/server.ts
    - packages/runtime/index.ts

key-decisions:
  - "Duplicated deriveVpsAgentId in runtime generators to avoid circular dependency (core -> runtime -> core)"
  - "VPS client uses native fetch with AbortController timeout instead of external HTTP library"
  - "isVpsConfigured() enables graceful degradation when VPS env vars are missing"
  - "OpenClaw generators are pure functions with no Supabase dependency for testability"
  - "Each generator enforces character budget (AGENTS.md 8000, SOUL.md 4000, TOOLS.md 4000, USER.md 3000, IDENTITY.md 500)"

patterns-established:
  - "VPS naming convention: {businessSlug}-{departmentType}-{agentIdPrefix} via deriveVpsAgentId()"
  - "Workspace file structure: workspace-{vpsAgentId}/AGENTS.md|SOUL.md|IDENTITY.md|TOOLS.md|USER.md"
  - "VPS client error pattern: return { success: false, error: message } instead of throwing"
  - "Department-specific persona profiles for SOUL.md generation"

requirements-completed: [DEPL-VPS-01, DEPL-VPS-02, DEPL-VPS-10]

# Metrics
duration: 9min
completed: 2026-03-27
---

# Phase 6 Plan 01: VPS Foundations Summary

**OpenClaw workspace generators producing per-agent AGENTS.md/SOUL.md/IDENTITY.md/TOOLS.md/USER.md/openclaw.json with VPS HTTP client module and status tracking schema**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-27T10:52:28Z
- **Completed:** 2026-03-27T11:01:52Z
- **Tasks:** 3
- **Files modified:** 22

## Accomplishments
- Three SQL migrations add VPS health tracking: singleton vps_status, per-agent agent_vps_status, and deployment VPS columns
- VPS client module provides typed HTTP/WebSocket communication with API key auth and graceful error handling
- Seven OpenClaw workspace generators convert agent/business data into deployment-ready workspace files with enforced character budgets
- Workspace orchestrator assembles complete deployment packages, skipping frozen and retired agents

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migrations for VPS status tables and deployment columns** - `5c59561` (feat)
2. **Task 2a: VPS client module** - `038f6b5` (feat)
3. **Task 2b: OpenClaw workspace generators and runtime exports** - `79a8636` (feat)

## Files Created/Modified
- `packages/db/schema/027_vps_status_table.sql` - VPS health status singleton table
- `packages/db/schema/028_agent_vps_status_table.sql` - Per-agent VPS runtime status with RLS
- `packages/db/schema/029_deployments_vps_columns.sql` - Adds optimization_report, deploy_target, vps_deploy_id to deployments
- `packages/db/schema/_combined_schema.sql` - Appended 027, 028, 029 sections
- `packages/core/types/index.ts` - Added VpsStatus, VpsContainerStatus, DeployTarget types; extended DeploymentStatus with "verifying"
- `packages/core/deployment/lifecycle.ts` - Added verifying transitions to DEPLOYMENT_TRANSITIONS map
- `packages/core/vps/vps-types.ts` - VPS deploy payload/result, health, chat, task request/response interfaces
- `packages/core/vps/vps-naming.ts` - deriveVpsAgentId single source of truth for agent ID naming
- `packages/core/vps/vps-config.ts` - getVpsConfig and isVpsConfigured for env-based VPS config
- `packages/core/vps/vps-client.ts` - vpsPost, vpsGet, createVpsWebSocket using native fetch
- `packages/core/vps/vps-health.ts` - Health check, agent health, DB status update functions
- `packages/core/index.ts` - Added VPS type exports and deriveVpsAgentId
- `packages/core/server.ts` - Added VPS client function exports
- `packages/runtime/generators/openclaw-agents-md.ts` - AGENTS.md generator (8000 char budget)
- `packages/runtime/generators/openclaw-soul-md.ts` - SOUL.md generator (4000 char budget)
- `packages/runtime/generators/openclaw-identity-md.ts` - IDENTITY.md generator (500 char budget)
- `packages/runtime/generators/openclaw-tools-md.ts` - TOOLS.md generator (4000 char budget)
- `packages/runtime/generators/openclaw-user-md.ts` - USER.md generator (3000 char budget)
- `packages/runtime/generators/openclaw-config.ts` - openclaw.json multi-agent config generator
- `packages/runtime/generators/openclaw-workspace.ts` - Workspace orchestrator assembling all generators
- `packages/runtime/index.ts` - Added 7 OpenClaw generator exports

## Decisions Made
- Duplicated deriveVpsAgentId in runtime package to avoid circular dependency (core depends on runtime; adding runtime -> core would be circular). Both copies reference packages/core/vps/vps-naming.ts as canonical source of truth.
- VPS client uses native fetch (Node 18+) with AbortController timeout instead of adding an HTTP library dependency.
- isVpsConfigured() returns false when VPS env vars are missing, enabling graceful degradation throughout the app.
- All OpenClaw generators are pure functions with no Supabase dependency, maximizing testability and portability.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed circular dependency for deriveVpsAgentId import**
- **Found during:** Task 2b (OpenClaw workspace generators)
- **Issue:** Plan specified importing deriveVpsAgentId from @fleet-factory/core, but core depends on runtime (circular). Direct relative path import also failed due to TypeScript rootDir constraint.
- **Fix:** Duplicated the 3-line deriveVpsAgentId function locally in both openclaw-config.ts and openclaw-workspace.ts with comments pointing to the canonical implementation in packages/core/vps/vps-naming.ts.
- **Files modified:** packages/runtime/generators/openclaw-config.ts, packages/runtime/generators/openclaw-workspace.ts
- **Verification:** `pnpm turbo typecheck` passes with no errors
- **Committed in:** 79a8636 (Task 2b commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to resolve circular package dependency. Function is trivial (3 lines) and both copies reference the canonical source. No scope creep.

## Issues Encountered
None beyond the circular dependency addressed above.

## User Setup Required
None - no external service configuration required. VPS env vars (VPS_API_URL, VPS_API_KEY) are optional and the system degrades gracefully without them.

## Next Phase Readiness
- VPS client module ready for 06-02 (deployment runner) to send workspace packages to VPS
- OpenClaw workspace generators ready for 06-02 to call during deployment flow
- Schema migrations ready to be applied to Supabase (027, 028, 029)
- VPS health check infrastructure ready for 06-04 (real-time dashboard)

## Self-Check: PASSED

All 15 created files verified present. All 3 task commits verified in git log.

---
*Phase: 06-builder-and-automation*
*Completed: 2026-03-27*
