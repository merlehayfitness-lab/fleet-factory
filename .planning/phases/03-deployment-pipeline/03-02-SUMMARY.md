---
phase: 03-deployment-pipeline
plan: 02
subsystem: deployment, crypto, runtime
tags: [state-machine, config-snapshot, deploy-pipeline, server-actions, barrel-split]

# Dependency graph
requires:
  - phase: 03-deployment-pipeline
    plan: 01
    provides: "Runtime config generators, AES-256-GCM encryption, integration adapters"
  - phase: 02-agent-management
    provides: "Agent lifecycle, CRUD, templates"
  - phase: 01-foundation-and-tenant-provisioning
    provides: "businesses, agents, departments tables with RLS, provisioning RPC"
provides:
  - "Deployment state machine with validated transitions (queued->building->deploying->live|failed)"
  - "triggerDeployment service orchestrating full pipeline with auto-version increment"
  - "retryDeployment and rollbackDeployment for failure recovery"
  - "Config snapshot versioning capturing full agent/dept/integration state plus generated artifacts"
  - "Four thin Server Actions for deploy, retry, rollback, history"
  - "getEncryptionKey env helper with graceful development fallback"
  - "Split barrel exports: @fleet-factory/core/server for Node.js-dependent modules"
affects: [03-deployment-pipeline, 04-agent-execution, 05-observability]

# Tech tracking
tech-stack:
  added: ["@fleet-factory/runtime as core dependency"]
  patterns: ["server barrel split for node: protocol isolation", "deployment state machine with assertDeploymentTransition pattern", "config snapshot versioning for deployment rollback"]

key-files:
  created:
    - packages/core/deployment/lifecycle.ts
    - packages/core/deployment/service.ts
    - packages/core/deployment/snapshot.ts
    - packages/core/server.ts
    - apps/web/_actions/deployment-actions.ts
  modified:
    - packages/core/index.ts
    - packages/core/package.json
    - packages/runtime/package.json
    - apps/web/_lib/env.ts
    - pnpm-lock.yaml

key-decisions:
  - "Split @fleet-factory/core barrel into index.ts (client-safe) and server.ts (Node.js-dependent) to prevent node:crypto from being bundled in client components"
  - "Removed unused @fleet-factory/core dependency from @fleet-factory/runtime to eliminate circular workspace dependency"
  - "Deployment service returns full deployment record on both success and failure paths"
  - "Secrets decryption errors handled gracefully in triggerDeployment (empty secrets array with warning) for development without ENCRYPTION_KEY"

patterns-established:
  - "Server barrel split: import Node.js-dependent modules from @fleet-factory/core/server, client-safe modules from @fleet-factory/core"
  - "Deployment state machine: assertDeploymentTransition validates all status changes"
  - "Config snapshot versioning: full tenant state captured at deploy time with generated artifacts"

requirements-completed: [DEPL-02, DEPL-07, DEPL-08, DEPL-09, DEPL-10]

# Metrics
duration: 8min
completed: 2026-03-25
---

# Phase 3 Plan 2: Deployment Job Queue Summary

**Deployment state machine with validated transitions, deploy/retry/rollback service functions, config snapshot versioning, and thin Server Actions with barrel split for client-safe imports**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-25T22:33:12Z
- **Completed:** 2026-03-25T22:41:10Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Built deployment lifecycle state machine validating queued->building->deploying->live|failed transitions
- Created triggerDeployment service orchestrating full pipeline: fetch data, generate artifacts via @fleet-factory/runtime, store versioned config snapshot, transition through states to live
- Implemented retryDeployment (creates fresh deployment from current state) and rollbackDeployment (restores from previous snapshot)
- Added four thin Server Actions (deployAction, retryDeploymentAction, rollbackDeploymentAction, getDeploymentsAction)
- Fixed pre-existing build failure by splitting core barrel exports into client-safe and server-only entry points

## Task Commits

Each task was committed atomically:

1. **Task 1: Deployment state machine, snapshot service, and deployment service** - `4862ab7` (feat)
2. **Task 2: Deployment Server Actions and env helper** - `f6ea52d` (feat)

## Files Created/Modified
- `packages/core/deployment/lifecycle.ts` - Deployment state machine with DEPLOYMENT_TRANSITIONS, canTransitionDeployment, assertDeploymentTransition
- `packages/core/deployment/service.ts` - triggerDeployment, retryDeployment, rollbackDeployment, getDeploymentHistory
- `packages/core/deployment/snapshot.ts` - ConfigSnapshot type, createConfigSnapshot, restoreFromSnapshot
- `packages/core/server.ts` - Server-only barrel exports (crypto, deployment service) using node:crypto
- `packages/core/index.ts` - Removed crypto and deployment service exports (moved to server.ts), added deployment lifecycle and snapshot exports
- `packages/core/package.json` - Added @fleet-factory/runtime workspace dependency
- `packages/runtime/package.json` - Removed unused @fleet-factory/core dependency (broke circular dep)
- `apps/web/_actions/deployment-actions.ts` - Four thin Server Actions for deployment operations
- `apps/web/_lib/env.ts` - Added getEncryptionKey helper with graceful development fallback
- `pnpm-lock.yaml` - Updated workspace dependency graph

## Decisions Made
- Split `@fleet-factory/core` barrel into `index.ts` (client-safe exports) and `server.ts` (Node.js-dependent exports like crypto and deployment service) to prevent `node:crypto` from being bundled in client components via webpack
- Removed unused `@fleet-factory/core` dependency from `@fleet-factory/runtime` to eliminate circular workspace dependency warning
- Deployment service returns the full deployment record on both success and failure paths for consistent API
- Secrets decryption errors handled gracefully in triggerDeployment -- continues with empty secrets array and logs a warning for development without ENCRYPTION_KEY

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added @fleet-factory/runtime as dependency to packages/core**
- **Found during:** Task 1 (deployment service imports runtime generators)
- **Issue:** `@fleet-factory/runtime` not in packages/core dependencies, causing TS2307 module not found error
- **Fix:** Added `"@fleet-factory/runtime": "workspace:*"` to packages/core/package.json
- **Files modified:** packages/core/package.json, pnpm-lock.yaml
- **Verification:** `pnpm turbo typecheck` passes cleanly
- **Committed in:** 4862ab7 (Task 1 commit)

**2. [Rule 3 - Blocking] Removed circular dependency between core and runtime**
- **Found during:** Task 1 (pnpm install warning about cyclic workspace dependencies)
- **Issue:** core depends on runtime (for generators), runtime depends on core (unused) -- circular dependency
- **Fix:** Removed unused `@fleet-factory/core` dependency from packages/runtime/package.json (runtime generators are pure functions with local interfaces, no actual imports from core)
- **Files modified:** packages/runtime/package.json
- **Verification:** `pnpm install` runs without circular dependency warning
- **Committed in:** 4862ab7 (Task 1 commit)

**3. [Rule 1 - Bug] Split core barrel exports to fix node:crypto build failure**
- **Found during:** Task 2 (pnpm turbo build fails with UnhandledSchemeError for node:crypto)
- **Issue:** Pre-existing issue from 03-01: `packages/core/index.ts` barrel exports `encrypt/decrypt` which import `node:crypto`. Client components importing from `@fleet-factory/core` pull in node:crypto transitively, causing webpack build failure.
- **Fix:** Created `packages/core/server.ts` as server-only entry point for Node.js-dependent modules (crypto, deployment service). Removed those exports from main barrel. Updated deployment-actions.ts to import from `@fleet-factory/core/server`.
- **Files modified:** packages/core/index.ts, packages/core/server.ts, apps/web/_actions/deployment-actions.ts
- **Verification:** `pnpm turbo build` compiles successfully across all routes
- **Committed in:** f6ea52d (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug)
**Impact on plan:** All auto-fixes necessary for correct compilation and build. No scope creep. The barrel split is an important architectural pattern for future development.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no new external service configuration required. ENCRYPTION_KEY setup was documented in 03-01-SUMMARY.md.

## Next Phase Readiness
- Deployment service ready for UI integration in 03-03 (deployment dashboard)
- Server Actions ready to be called from React components
- State machine and snapshot versioning ready for deployment history views
- All runtime generators integrated into the deploy pipeline
- `@fleet-factory/core/server` pattern established for future server-only modules

## Self-Check: PASSED

- All 5 created files verified present on disk
- Commit 4862ab7 (Task 1) verified in git log
- Commit f6ea52d (Task 2) verified in git log
- `pnpm turbo typecheck` passes across all 4 packages (core, db, runtime, web)
- `pnpm turbo build` passes with all routes compiling successfully

---
*Phase: 03-deployment-pipeline*
*Completed: 2026-03-25*
