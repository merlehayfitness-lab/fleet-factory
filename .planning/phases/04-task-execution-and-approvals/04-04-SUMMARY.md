---
phase: 04-task-execution-and-approvals
plan: 04
subsystem: ui
tags: [usage-metering, security-audit, token-display, dashboard, rls, sandbox, error-handling]

# Dependency graph
requires:
  - phase: 04-task-execution-and-approvals
    provides: "Task schema, orchestrator, worker execution engine, approval gates, tasks/approvals pages"
provides:
  - "Usage summary component on business overview with per-agent token/cost breakdown"
  - "Token usage and cost display on task detail pages"
  - "Active task count and usage stats on business overview"
  - "Security audit: no service_role leaks, RLS on all tables, sandbox enforcement verified"
  - "Error handling hardened with assistance requests on routing failure"
  - "UI polish: loading states, empty states, responsive tables, bulk reject confirmation"
affects: [05-observability]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Usage summary aggregation from usage_records with per-agent grouping", "Bulk reject confirmation pattern (two-click with cancel)", "Assistance request as fallback for routing/execution failures"]

key-files:
  created:
    - "apps/web/_components/usage-summary.tsx"
  modified:
    - "apps/web/_components/business-overview.tsx"
    - "apps/web/app/(dashboard)/businesses/[id]/page.tsx"
    - "apps/web/_components/task-detail-panel.tsx"
    - "apps/web/app/(dashboard)/businesses/[id]/tasks/[taskId]/page.tsx"
    - "packages/core/orchestrator/executor.ts"
    - "packages/core/worker/tool-runner.ts"
    - "apps/web/_components/approvals-list.tsx"
    - "apps/web/_components/tasks-table.tsx"

key-decisions:
  - "Usage data aggregated server-side from usage_records table rather than calling getUsageSummary service (avoids server import in page)"
  - "Executor creates assistance_request on routing failure instead of throwing error (graceful degradation)"
  - "Bulk reject uses two-click confirmation pattern instead of modal dialog (lighter weight)"
  - "Token usage displayed from both task-level fields and usage_records for completeness"

patterns-established:
  - "Usage summary pattern: aggregate usage_records by agent, join agent names for display"
  - "Graceful routing failure: create assistance_request when no agent available"
  - "Two-click confirmation: first click changes button to destructive variant, second confirms"

requirements-completed: [TOPS-04, DASH-09, SECR-03, SECR-04, SECR-05]

# Metrics
duration: 6min
completed: 2026-03-26
---

# Phase 4 Plan 4: Usage Metering Dashboard and Security Hardening Summary

**Usage metering dashboard with per-agent token/cost breakdown, task detail token display, security audit confirming no service_role leaks and full RLS coverage, and error handling hardened across orchestrator**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-26T15:12:05Z
- **Completed:** 2026-03-26T15:18:14Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Usage summary component displays total tokens (prompt + completion) and cost with per-agent breakdown table on business overview
- Task detail panel and task detail page show token_usage and estimated cost for completed tasks
- Business overview fetches live active task count, pending approval count, and aggregated usage data
- Security audit confirmed: zero service_role usage in worker/orchestrator/approval code, all 6 Phase 4 tables have RLS, sandbox checks before every tool execution, all 9 audit log action types present
- Executor creates assistance_request on routing failure (no department, no active agents, missing agent) instead of throwing
- Tool runner wraps execution in try/catch returning error result instead of propagating exceptions
- Approvals list gains loading indicator, bulk reject confirmation dialog, and cancel button
- Tasks table wrapped in responsive overflow container

## Task Commits

Each task was committed atomically:

1. **Task 1: Usage summary UI, metering wiring, and task detail token display** - `a12cf67` (feat)
2. **Task 2: Security audit, error handling, and UI polish** - `0d7e25f` (fix)

**Plan metadata:** (pending)

## Files Created/Modified
- `apps/web/_components/usage-summary.tsx` - UsageSummary client component with per-agent token/cost table
- `apps/web/_components/business-overview.tsx` - Added UsageSummary, active task count stat, updated grid to 5 columns
- `apps/web/app/(dashboard)/businesses/[id]/page.tsx` - Fetches usage_records, active tasks, agent names for usage display
- `apps/web/_components/task-detail-panel.tsx` - Added token_usage/cost_cents to Task interface, renders Usage section
- `apps/web/app/(dashboard)/businesses/[id]/tasks/[taskId]/page.tsx` - Fetches usage_records, shows token breakdown card
- `packages/core/orchestrator/executor.ts` - Creates assistance_request on routing failure instead of throwing
- `packages/core/worker/tool-runner.ts` - Wrapped runTool in try/catch with error result return
- `apps/web/_components/approvals-list.tsx` - Added loading indicator, bulk reject confirmation, cancel button
- `apps/web/_components/tasks-table.tsx` - Responsive table container with overflow-x-auto

## Decisions Made
- **Usage aggregation approach:** Fetched raw usage_records and aggregated in the Server Component rather than calling getUsageSummary from core/server. This keeps the page.tsx self-contained and avoids an extra function call through the server barrel.
- **Token display sources:** Task detail shows data from both task-level token_usage field (set by worker) and usage_records table (metering service). Prefers usage_records when available for accuracy.
- **Routing failure handling:** Executor now creates assistance_request for three failure modes: no department_id, no active agents in department, and agent record missing after routing. Follows CONTEXT decision for human-in-the-loop recovery.
- **Bulk reject confirmation:** Used a two-click pattern (button changes to destructive "Confirm Reject?" with Cancel button) rather than a modal AlertDialog, keeping the interaction lightweight and visible in the action bar.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. Database tables were created in earlier plans (04-01, 04-02, 04-03).

## Next Phase Readiness
- Phase 4 (Task Execution & Approvals) fully complete
- All task execution, approval, metering, and security requirements delivered
- Ready for Phase 5 (Observability & Monitoring)
- Usage metering data available for Phase 5 observability dashboards

## Self-Check: PASSED

- All 9 files verified present on disk
- Commit a12cf67 (Task 1) verified in git log
- Commit 0d7e25f (Task 2) verified in git log
- `pnpm turbo typecheck` passes with 0 errors
- `pnpm turbo build` passes with 0 errors
- No service_role usage in worker/orchestrator/approval code (verified via grep)

---
*Phase: 04-task-execution-and-approvals*
*Completed: 2026-03-26*
