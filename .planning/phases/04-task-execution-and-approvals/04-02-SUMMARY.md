---
phase: 04-task-execution-and-approvals
plan: 02
subsystem: api
tags: [worker, sandbox, metering, tool-catalog, tool-runner, security, rls]

# Dependency graph
requires:
  - phase: 04-task-execution-and-approvals
    provides: "Task schema, orchestrator executor, task lifecycle state machine"
provides:
  - "Worker tool runner with sandboxed execution and allowlist validation"
  - "Per-department tool catalog with mock results (owner/sales/support/operations)"
  - "Sandbox validator blocking host filesystem, elevated execution, and service_role access"
  - "Token metering with cost calculation at Claude Sonnet pricing"
  - "Usage records table with business-scoped RLS"
  - "is_trusted column on agents for approval bypass"
affects: [04-03, 04-04]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Sandbox validation with BLOCKED_CAPABILITIES const array", "Risk-level approval gates (low=auto, medium=trusted-or-approve, high=always-approve)", "Token estimation by task priority proxy with per-tool increment", "Best-effort metering (errors logged, not thrown)"]

key-files:
  created:
    - "packages/db/schema/019_usage_records.sql"
    - "packages/db/schema/020_agents_trusted_column.sql"
    - "packages/core/worker/tool-catalog.ts"
    - "packages/core/worker/sandbox.ts"
    - "packages/core/worker/metering.ts"
    - "packages/core/worker/tool-runner.ts"
  modified:
    - "packages/db/schema/_combined_schema.sql"
    - "packages/core/orchestrator/executor.ts"
    - "packages/core/index.ts"
    - "packages/core/server.ts"

key-decisions:
  - "Risk-level gates: high=always approval, medium=approval unless agent is_trusted, low=auto-approve"
  - "Failed tool execution creates assistance request instead of auto-failing task (per CONTEXT decisions)"
  - "Unknown tools default to high risk level for fail-safe behavior"
  - "Token estimation uses task priority as complexity proxy with per-tool increments"

patterns-established:
  - "Worker sandbox: assertSandbox() checks tool_profile against BLOCKED_CAPABILITIES before any execution"
  - "Tool access: validateToolAccess() checks both department catalog AND agent tool_profile allowlist"
  - "Metering: best-effort recording -- errors logged but never thrown to avoid failing task execution"
  - "Risk-level gates: executor checks risk before tool execution, delegates approval to 04-03"

requirements-completed: [TASK-03, SECR-03, SECR-04, SECR-05]

# Metrics
duration: 4min
completed: 2026-03-26
---

# Phase 4 Plan 2: Worker Execution Engine Summary

**Sandboxed worker with per-department tool catalog, allowlist validation, risk-level approval gates, and token metering at Claude Sonnet pricing**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-26T14:50:37Z
- **Completed:** 2026-03-26T14:55:01Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Usage records table with prompt_tokens, completion_tokens, cost_cents columns and business-scoped RLS
- Per-department tool catalog: 17 tools across owner (3), sales (5), support (5), operations (4) with realistic mock results
- Sandbox validator blocks 7 capabilities: host filesystem R/W, elevated execution, unrestricted network, service_role, container escape, host volume mounts
- Tool access validated against both department catalog and agent tool_profile allowlist before execution
- Token metering estimates by task complexity and records to usage_records with Claude Sonnet pricing
- Executor wired to call runAgentTask: handles needsApproval -> waiting_approval, failed -> assistance_requested, success -> completed

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migrations for usage_records and agents.is_trusted** - `1eb97d7` (feat)
2. **Task 2: Worker service with tool-runner, sandbox, metering, and tool catalog** - `92a0409` (feat)

**Plan metadata:** (pending)

## Files Created/Modified
- `packages/db/schema/019_usage_records.sql` - Usage records table with 4 indexes and 2 RLS policies
- `packages/db/schema/020_agents_trusted_column.sql` - is_trusted boolean on agents for approval bypass
- `packages/db/schema/_combined_schema.sql` - Appended 019 and 020 migrations
- `packages/core/worker/tool-catalog.ts` - 17 tools across 4 departments with mock result generators
- `packages/core/worker/sandbox.ts` - BLOCKED_CAPABILITIES, validateSandbox, validateToolAccess, assertSandbox
- `packages/core/worker/metering.ts` - estimateTokens, calculateCost, recordUsage, getUsageSummary
- `packages/core/worker/tool-runner.ts` - runTool (single), runAgentTask (full flow with risk gates)
- `packages/core/orchestrator/executor.ts` - Wired worker into execution pipeline with approval/failure handling
- `packages/core/index.ts` - Added client-safe worker exports (BLOCKED_CAPABILITIES, TOOL_CATALOG, getToolsForDepartment)
- `packages/core/server.ts` - Added server-only worker exports (runTool, runAgentTask, metering, sandbox validation)

## Decisions Made
- **Risk-level approval gates:** High risk always requires approval. Medium risk requires approval unless agent is_trusted. Low risk auto-approves. This gives operators control over dangerous tools while allowing trusted agents to operate autonomously on moderate tasks.
- **Failed execution -> assistance request:** When runAgentTask fails, executor creates an assistance request instead of immediately failing the task. This follows the CONTEXT decision to prefer human-in-the-loop recovery over silent failures.
- **Unknown tools = high risk:** getToolRiskLevel returns "high" for any tool not in the catalog, ensuring fail-safe behavior for unrecognized tool names.
- **Token estimation by priority:** Task priority is used as a complexity proxy (low=300 tokens, medium=800, high=1600) with +230 per additional tool. Small random variance (10%) added for realistic simulation.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
**Database migration required.** Run the new SQL migrations (019, 020) or re-run `_combined_schema.sql` in the Supabase SQL editor to create the usage_records table and add the is_trusted column to agents.

## Next Phase Readiness
- Worker execution engine ready for 04-03 (approval system creates approvals when needsApproval returned)
- Metering data ready for 04-04 (UI can show token usage and cost per task)
- Tool catalog available as client-safe export for UI tool selection components
- Sandbox validation ready for security audit and testing

## Self-Check: PASSED

- All 10 files verified present on disk
- Commit 1eb97d7 (Task 1) verified in git log
- Commit 92a0409 (Task 2) verified in git log
- `pnpm turbo typecheck` passes with 0 errors
- No service_role client creation in worker files (verified via grep)

---
*Phase: 04-task-execution-and-approvals*
*Completed: 2026-03-26*
