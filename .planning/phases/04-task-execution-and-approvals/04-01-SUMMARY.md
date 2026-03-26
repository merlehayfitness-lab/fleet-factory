---
phase: 04-task-execution-and-approvals
plan: 01
subsystem: api
tags: [tasks, orchestrator, state-machine, webhook, supabase, rls, zod]

# Dependency graph
requires:
  - phase: 03-deployment-pipeline
    provides: "Deployment infrastructure, secrets table, agent management"
provides:
  - "Tasks table with RLS policies and status state machine"
  - "Subtask dependencies DAG table"
  - "Assistance requests table for agent help"
  - "Task CRUD service with audit logging"
  - "Orchestrator: router, decomposer, executor"
  - "Server Actions for task operations"
  - "Webhook ingestion endpoint for external task creation"
affects: [04-02, 04-03, 04-04]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Task status state machine (queued->assigned->in_progress->completed/failed)", "Orchestrator pipeline (route->decompose->execute)", "Webhook auth via shared secret in secrets table", "Subtask DAG with subtask_dependencies junction table"]

key-files:
  created:
    - "packages/db/schema/016_tasks_table.sql"
    - "packages/db/schema/017_subtask_dependencies.sql"
    - "packages/db/schema/018_assistance_requests.sql"
    - "packages/core/task/task-schema.ts"
    - "packages/core/task/task-lifecycle.ts"
    - "packages/core/task/task-service.ts"
    - "packages/core/orchestrator/router.ts"
    - "packages/core/orchestrator/decomposer.ts"
    - "packages/core/orchestrator/executor.ts"
    - "apps/web/_actions/task-actions.ts"
    - "apps/web/app/api/businesses/[id]/tasks/ingest/route.ts"
  modified:
    - "packages/db/schema/_combined_schema.sql"
    - "packages/core/types/index.ts"
    - "packages/core/index.ts"
    - "packages/core/server.ts"

key-decisions:
  - "Removed Zod .default() and used z.nullable() standalone form for Zod v4 compatibility"
  - "Zod v4 z.record() requires explicit key schema: z.record(z.string(), z.unknown())"
  - "Webhook endpoint uses service_role client (SECR-05 exception for external system auth)"
  - "High priority tasks return decomposition preview without executing (admin must confirm)"
  - "Task manager role (owner/admin/manager) can create and update tasks; only owner/admin can delete"

patterns-established:
  - "Task state machine: follows deployment/lifecycle.ts pattern with TASK_TRANSITIONS map"
  - "Orchestrator pipeline: router selects agent -> decomposer creates subtask DAG -> executor coordinates"
  - "Webhook auth: Bearer token compared against business secrets table entry"
  - "Subtask DAG: subtask_dependencies junction table for dependency ordering"

requirements-completed: [TASK-01, TASK-02, TASK-04, TASK-06]

# Metrics
duration: 7min
completed: 2026-03-26
---

# Phase 4 Plan 1: Task Schema and Orchestrator Summary

**Task schema with 7-state lifecycle machine, orchestrator routing/decomposition pipeline, and webhook ingestion endpoint**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-26T14:39:57Z
- **Completed:** 2026-03-26T14:47:21Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- Tasks table with priority/status/source CHECK constraints, 4 indexes, and 4 RLS policies
- Task status state machine: queued -> assigned -> in_progress -> completed/failed with approval and assistance branches
- Orchestrator routes tasks to active department agents and decomposes multi-department tasks into subtask DAGs
- Webhook ingestion endpoint accepts external events with API key authentication
- Server Actions wrap all task operations with auth checks and path revalidation

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migrations for tasks, subtask_dependencies, and assistance_requests** - `f5a7671` (feat)
2. **Task 2: Task lifecycle, CRUD service, orchestrator, Server Actions, and webhook endpoint** - `73a7677` (feat)

**Plan metadata:** (pending)

## Files Created/Modified
- `packages/db/schema/016_tasks_table.sql` - Tasks table with all columns, indexes, and RLS policies
- `packages/db/schema/017_subtask_dependencies.sql` - DAG junction table with UNIQUE constraint
- `packages/db/schema/018_assistance_requests.sql` - Agent help request table with status tracking
- `packages/db/schema/_combined_schema.sql` - Appended all three new migrations
- `packages/core/types/index.ts` - Added TaskPriority, TaskStatus, TaskSource, AssistanceRequestStatus types
- `packages/core/task/task-schema.ts` - Zod schemas for task create/update
- `packages/core/task/task-lifecycle.ts` - Task status state machine with transition validation
- `packages/core/task/task-service.ts` - Task CRUD: create, read, update, subtasks, assistance requests
- `packages/core/orchestrator/router.ts` - Department agent selection and task routing
- `packages/core/orchestrator/decomposer.ts` - Mock subtask DAG creation for multi-department tasks
- `packages/core/orchestrator/executor.ts` - Orchestration pipeline coordinator
- `packages/core/index.ts` - Re-exports for task types, lifecycle, and schemas (client-safe)
- `packages/core/server.ts` - Re-exports for task service and orchestrator (server-only)
- `apps/web/_actions/task-actions.ts` - Server Actions for task CRUD and assistance responses
- `apps/web/app/api/businesses/[id]/tasks/ingest/route.ts` - Webhook endpoint for external task creation

## Decisions Made
- **Zod v4 compatibility:** Removed `.default()` from schema (defaults via form defaultValues per 01-03 decision). Used `z.nullable()` standalone form and `z.record(z.string(), z.unknown())` for 2-arg signature.
- **Webhook auth:** Uses service_role client as the one exception for external system auth (documented per SECR-05). Compares Bearer token against business secrets table.
- **High priority decomposition:** Returns preview plan without executing -- admin must confirm before subtasks are created.
- **Task RLS:** Manager role included in INSERT/UPDATE policies since managers create and manage tasks. DELETE restricted to owner/admin only.
- **Default department fallback:** Webhook endpoint falls back to "operations" department when no department_id provided.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Zod v4 API changes for .default(), .nullable(), and .record()**
- **Found during:** Task 2 (task-schema.ts)
- **Issue:** Zod v4 changed `.default()` to standalone, `.nullable()` to standalone, and `.record()` to require 2 args
- **Fix:** Removed `.default("medium")`, used `z.nullable(schema)` form, used `z.record(z.string(), z.unknown())`
- **Files modified:** packages/core/task/task-schema.ts
- **Verification:** `pnpm turbo typecheck` passes with 0 errors
- **Committed in:** 73a7677 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Auto-fix necessary for Zod v4 compatibility. No scope creep.

## Issues Encountered
None beyond the Zod v4 API change (handled as deviation above).

## User Setup Required
**Database migration required.** Run the new SQL migrations (016, 017, 018) or re-run `_combined_schema.sql` in the Supabase SQL editor to create the tasks, subtask_dependencies, and assistance_requests tables.

## Next Phase Readiness
- Task schema and orchestrator ready for 04-02 (worker execution engine)
- Task CRUD service ready for 04-03 (UI pages)
- Approval gate hooks in task lifecycle ready for 04-03 (approval system)
- Webhook endpoint ready for external integration testing

## Self-Check: PASSED

- All 15 files verified present on disk
- Commit f5a7671 (Task 1) verified in git log
- Commit 73a7677 (Task 2) verified in git log
- `pnpm turbo typecheck` passes with 0 errors

---
*Phase: 04-task-execution-and-approvals*
*Completed: 2026-03-26*
