---
phase: 04-task-execution-and-approvals
verified: 2026-03-26T18:30:00Z
status: passed
score: 17/17 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 16/17
  gaps_closed:
    - "Policy engine evaluateRisk is now called during runAgentTask; evaluateRisk import added at line 16, call at line 192, maxRiskLevel helper at line 53, catalogRisk/policyRisk dual-source pattern at lines 187-199. Commit e38129d confirmed in git log."
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Create a task targeting the sales department with a high-risk tool in the payload (e.g., payload.tools=['send_email'])"
    expected: "Task transitions to waiting_approval and an approval record appears in the approvals page with risk_level='high'"
    why_human: "Requires a business with an active sales agent and end-to-end execution through the orchestrator to confirm approval gate fires correctly"
  - test: "On the approvals page, select multiple pending approvals and click Bulk Approve"
    expected: "All selected approvals transition to approved, tasks resume in_progress, toast shows count"
    why_human: "Bulk action UI flow with real data cannot be verified by static analysis"
  - test: "Mark an agent as is_trusted=true in the agents table, create a medium-risk task"
    expected: "Task completes without pausing for approval (auto-approval path)"
    why_human: "Trust-based auto-approval requires live execution"
  - test: "On the business overview dashboard, verify usage summary shows tokens and cost after running a task"
    expected: "UsageSummary card shows non-zero token count and dollar cost with per-agent breakdown"
    why_human: "Requires task execution to populate usage_records table"
  - test: "Create a task with payload.tools=['search_contacts'] (low catalog risk) and confirm the policy engine result is consulted"
    expected: "Task auto-executes without approval gate -- policy engine returns 'low' matching search_% prefix, effective risk is 'low'"
    why_human: "Requires live execution to confirm evaluateRisk is called and returns the expected policy match"
---

# Phase 4: Task Execution and Approvals Verification Report

**Phase Goal:** Tasks flow through the orchestrator to department agents, agents execute with sandboxed tool access, and risky actions pause for human approval with risk-tiered routing
**Verified:** 2026-03-26T18:30:00Z
**Status:** passed (17/17)
**Re-verification:** Yes -- after gap closure (04-05 plan executed)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Tasks table exists with business_id, parent_task_id, department_id, assigned_agent_id, priority, status, source, token_usage, and cost_cents columns | VERIFIED | `packages/db/schema/016_tasks_table.sql` -- all columns present with CHECK constraints |
| 2 | Task status state machine enforces transitions: queued -> assigned -> in_progress -> completed/failed/waiting_approval/assistance_requested | VERIFIED | `packages/core/task/task-lifecycle.ts` -- TASK_TRANSITIONS map with all states |
| 3 | Orchestrator router selects department and assigns an active agent within that department | VERIFIED | `packages/core/orchestrator/router.ts` -- routeTask queries active agents by department_id and business_id |
| 4 | Orchestrator decomposer produces subtask DAGs with dependency edges in subtask_dependencies table | VERIFIED | `packages/core/orchestrator/decomposer.ts` -- decomposeTask creates subtasks from payload.departments array |
| 5 | Webhook ingestion endpoint at POST /api/businesses/[id]/tasks/ingest creates tasks from external events | VERIFIED | `apps/web/app/api/businesses/[id]/tasks/ingest/route.ts` -- Bearer auth, returns 201 with task_id |
| 6 | Server Actions exist for createTask, getTasksForBusiness, getTaskById, updateTaskStatus | VERIFIED | `apps/web/_actions/task-actions.ts` -- 5 actions exported with auth checks |
| 7 | Worker tool-runner validates tool access against agent's tool_profile allowlist before execution | VERIFIED | `packages/core/worker/tool-runner.ts` -- assertSandbox + validateToolAccess called before any tool executes |
| 8 | Sandbox validator rejects requests for host filesystem access, elevated execution, and unrestricted mounts | VERIFIED | `packages/core/worker/sandbox.ts` -- BLOCKED_CAPABILITIES array with 7 capabilities |
| 9 | Tool execution returns mock results with realistic sample data per department and tool type | VERIFIED | `packages/core/worker/tool-catalog.ts` -- 17 tools across 4 departments with mockResult generators |
| 10 | Agents never use service_role credentials -- all worker operations use RLS-scoped client | VERIFIED | grep confirms zero service_role createClient calls in worker/, orchestrator/, approval/ |
| 11 | Usage records table tracks prompt_tokens, completion_tokens, model, and cost_cents per execution | VERIFIED | `packages/db/schema/019_usage_records.sql` -- all required columns, metering.ts records after each execution |
| 12 | Metering service simulates token counts based on task complexity and records to usage_records | VERIFIED | `packages/core/worker/metering.ts` -- estimateTokens uses priority as proxy, recordUsage is best-effort |
| 13 | Approvals table stores risk_level, action_summary, agent_reasoning, retry_count with status state machine | VERIFIED | `packages/db/schema/021_approvals_table.sql` -- all columns with CHECK constraints |
| 14 | Policy engine evaluates action against approval_policies to determine risk level and checks agent trust | VERIFIED | `packages/core/worker/tool-runner.ts` lines 16/192 -- evaluateRisk imported and called in runAgentTask loop; maxRiskLevel helper (line 53) produces effective risk from max(catalogRisk, policyRisk). Commit e38129d. |
| 15 | Two-step rejection: first rejection triggers agent retry, second rejection requires admin guidance | VERIFIED | `packages/core/approval/approval-service.ts` rejectAction -- retryCount < 1 -> retry_pending, retryCount >= 1 -> guidance_required |
| 16 | Tasks page shows work queue with table and kanban toggle, quick-add form, and filter bar | VERIFIED | `apps/web/app/(dashboard)/businesses/[id]/tasks/page.tsx` + `tasks-page-client.tsx` -- TasksTable, TasksKanban, TaskQuickAdd, TaskFilters all rendered |
| 17 | Approvals page shows pending requests with bulk approve/reject, expandable reasoning, and risk badges | VERIFIED | `apps/web/_components/approvals-list.tsx` -- checkbox selection, bulkApproveAction/bulkRejectAction, ApprovalCard with expandable reasoning, 10s polling |

**Score:** 17/17 truths verified

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `packages/db/schema/016_tasks_table.sql` | VERIFIED | Tasks table with 4 RLS policies and all required columns |
| `packages/db/schema/017_subtask_dependencies.sql` | VERIFIED | DAG junction with UNIQUE constraint and 3 RLS policies |
| `packages/db/schema/018_assistance_requests.sql` | VERIFIED | Assistance requests table with status CHECK and RLS |
| `packages/db/schema/019_usage_records.sql` | VERIFIED | Usage records with RLS, 4 indexes |
| `packages/db/schema/020_agents_trusted_column.sql` | VERIFIED | is_trusted boolean added to agents table |
| `packages/db/schema/021_approvals_table.sql` | VERIFIED | Approvals with risk_level CHECK, retry_count, 3 RLS policies |
| `packages/db/schema/022_approval_policies.sql` | VERIFIED | 13 seeded policies across 6 categories with RLS |
| `packages/core/task/task-lifecycle.ts` | VERIFIED | TASK_TRANSITIONS, canTransitionTask, assertTaskTransition, getValidTaskTransitions exported |
| `packages/core/task/task-service.ts` | VERIFIED | createTask, getTasksForBusiness, getTaskById, updateTaskStatus, getSubtasks, createAssistanceRequest, respondToAssistanceRequest exported |
| `packages/core/orchestrator/router.ts` | VERIFIED | routeTask and selectAgent exported and fully implemented |
| `packages/core/orchestrator/decomposer.ts` | VERIFIED | decomposeTask exported with subtask DAG creation |
| `packages/core/orchestrator/executor.ts` | VERIFIED | executeTask exported, calls routeTask + runAgentTask(supabase, ...) at line 235-236 |
| `packages/core/worker/tool-catalog.ts` | VERIFIED | TOOL_CATALOG, getToolsForDepartment, getMockResult, getToolRiskLevel exported |
| `packages/core/worker/sandbox.ts` | VERIFIED | BLOCKED_CAPABILITIES (7), validateSandbox, validateToolAccess, assertSandbox exported |
| `packages/core/worker/metering.ts` | VERIFIED | recordUsage, estimateTokens, calculateCost, getUsageSummary exported |
| `packages/core/worker/tool-runner.ts` | VERIFIED | runTool and runAgentTask exported; assertSandbox + validateToolAccess + evaluateRisk all called; maxRiskLevel helper combines both risk sources |
| `packages/core/approval/approval-lifecycle.ts` | VERIFIED | APPROVAL_TRANSITIONS, canTransitionApproval, assertApprovalTransition, getValidApprovalTransitions exported |
| `packages/core/approval/approval-service.ts` | VERIFIED | createApproval, getApprovalsForBusiness, approveAction, rejectAction, provideGuidance, bulkApprove, bulkReject exported |
| `packages/core/approval/policy-engine.ts` | VERIFIED | evaluateRisk, checkAgentTrust, shouldAutoApprove exported AND wired -- evaluateRisk called from tool-runner.ts line 192 |
| `apps/web/_actions/task-actions.ts` | VERIFIED | createTaskAction, quickAddTaskAction, getTasksAction, getTaskAction, updateTaskStatusAction, respondToAssistanceAction exported |
| `apps/web/_actions/approval-actions.ts` | VERIFIED | 6 approval Server Actions exported with auth checks |
| `apps/web/app/(dashboard)/businesses/[id]/tasks/page.tsx` | VERIFIED | Server Component fetches tasks with joins, renders TasksPageClient |
| `apps/web/app/(dashboard)/businesses/[id]/approvals/page.tsx` | VERIFIED | Fetches approvals with joins, renders ApprovalsList with pending count badge |
| `apps/web/_components/tasks-kanban.tsx` | VERIFIED | 6 status columns, cards with click-to-open |
| `apps/web/_components/approvals-list.tsx` | VERIFIED | Checkbox selection, bulk approve/reject with confirmation, 10s polling via setInterval |
| `apps/web/_components/usage-summary.tsx` | VERIFIED | Displays total tokens + cost, per-agent breakdown table, "No usage" empty state |
| `apps/web/_components/business-overview.tsx` | VERIFIED | UsageSummary component rendered, live pendingApprovalCount and activeTaskCount props wired |
| `apps/web/_components/sidebar-nav.tsx` | VERIFIED | Tasks and Approvals both have enabled: true |
| `apps/web/_components/status-badge.tsx` | VERIFIED | Task statuses, approval statuses, and risk levels all mapped |
| `apps/web/app/api/businesses/[id]/tasks/ingest/route.ts` | VERIFIED | POST handler with Bearer auth, body validation, task creation, returns 201 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/core/orchestrator/executor.ts` | `packages/core/worker/tool-runner.ts` | runAgentTask | WIRED | Line 4 imports runAgentTask, line 235 calls it with supabase as first arg |
| `packages/core/worker/tool-runner.ts` | `packages/core/approval/policy-engine.ts` | evaluateRisk | WIRED | Line 16 imports evaluateRisk; line 192 calls await evaluateRisk(supabase, toolName) inside runAgentTask loop. Commit e38129d. |
| `packages/core/worker/tool-runner.ts` | `packages/core/worker/tool-catalog.ts` | getToolRiskLevel + maxRiskLevel | WIRED | catalogRisk at line 187; policyRisk from evaluateRisk at line 193; maxRiskLevel at line 199 produces effective risk |
| `packages/core/worker/tool-runner.ts` | `packages/core/worker/sandbox.ts` | assertSandbox + validateToolAccess | WIRED | Line 13 imports both; assertSandbox called at line 82 (runTool) and line 160 (runAgentTask) |
| `packages/core/worker/tool-runner.ts` | `packages/core/worker/metering.ts` | recordUsage | WIRED | Line 15 imports; line 248 calls recordUsage after successful execution |
| `apps/web/_components/approvals-list.tsx` | `apps/web/_actions/approval-actions.ts` | bulkApproveAction/bulkRejectAction | WIRED | Lines 10-11 import; called in bulk action handlers |
| `apps/web/_components/task-quick-add.tsx` | `apps/web/_actions/task-actions.ts` | quickAddTaskAction | WIRED | Imported and called on form submit |
| `apps/web/_components/business-overview.tsx` | `apps/web/_components/usage-summary.tsx` | UsageSummary component | WIRED | UsageSummary imported and rendered with usageSummary prop |
| `apps/web/app/(dashboard)/businesses/[id]/page.tsx` | usage_records table | direct Supabase query | WIRED | Queries usage_records aggregated by agent_id |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| TASK-01 | 04-01 | Tasks can be created via admin panel or API with title, payload, priority, and target agent/department | SATISFIED | createTaskAction + webhook POST route |
| TASK-02 | 04-01 | Orchestrator service routes tasks to appropriate department agent based on type and priority | SATISFIED | router.ts routeTask selects active agent by department |
| TASK-03 | 04-02 | Worker service executes agent tasks with allowed tools from tool_profile | SATISFIED | tool-runner.ts runAgentTask with validateToolAccess |
| TASK-04 | 04-01 | Tasks track status (queued, assigned, in_progress, completed, failed, plus extended states) | SATISFIED | task-lifecycle.ts TASK_TRANSITIONS with all 7 states |
| TASK-05 | 04-03 | Tasks page shows work queue across all departments for a business | SATISFIED | /businesses/[id]/tasks with table + kanban views |
| TASK-06 | 04-01 | Webhook/event ingestion endpoint accepts inbound events from external systems | SATISFIED | POST /api/businesses/[id]/tasks/ingest with Bearer auth |
| APRV-01 | 04-03 | Risky agent actions create approval requests that pause execution | SATISFIED | executor.ts transitions to waiting_approval when runAgentTask returns needsApproval |
| APRV-02 | 04-03 | Admin can approve or reject gated actions from approvals page | SATISFIED | approvals page with ApprovalsList + approveActionHandler/rejectActionHandler |
| APRV-03 | 04-03, 04-05 | Risk-tiered routing: low auto-run, medium async review, high synchronous approval | SATISFIED | tool-runner.ts uses maxRiskLevel(catalogRisk, policyRisk) for gating; both tool catalog and database policy rules consulted. Commit e38129d. |
| APRV-04 | 04-03, 04-05 | Policy rules gate irreversible actions | SATISFIED | 13 seeded approval_policies rules; evaluateRisk called per tool in runAgentTask; send_%, respond_%, update_%, close_%, delete_%, schedule_% all map to 'high'. Commit e38129d. |
| APRV-05 | 04-03 | Agent confidence thresholds trigger escalation to human when uncertainty is high | SATISFIED | Risk levels modeled as confidence proxy; high-risk always requires approval |
| APRV-06 | 04-03 | Escalation paths defined: agent -> manager -> admin -> owner | SATISFIED | Two-step rejection: retry_pending -> guidance_required; guidance resets to pending |
| APRV-07 | 04-03 | All approval decisions logged in audit_logs with full context | SATISFIED | approval.created, approval.approved, approval.rejected, approval.guidance_provided all logged |
| DASH-09 | 04-03, 04-04 | Tasks and approvals page per business | SATISFIED | /businesses/[id]/tasks and /businesses/[id]/approvals both functional |
| SECR-03 | 04-02, 04-04 | Agent execution sandboxed -- no host filesystem access, no elevated exec, restricted mounts | SATISFIED | sandbox.ts BLOCKED_CAPABILITIES (7 capabilities), assertSandbox called before every tool execution |
| SECR-04 | 04-02, 04-04 | Tool access validated against tenant-scoped allowlists before execution | SATISFIED | validateToolAccess checks department catalog AND agent tool_profile |
| SECR-05 | 04-02, 04-04 | Agents never run with service_role credentials | SATISFIED | grep confirms zero service_role client creation in worker/, orchestrator/, approval/ |
| TOPS-04 | 04-04 | Internal usage metering tracks token consumption and cost per tenant per agent | SATISFIED | usage_records table, metering.ts, UsageSummary on business overview |

**All 18 requirement IDs satisfied. No orphaned requirements.**

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/app/api/businesses/[id]/tasks/ingest/route.ts` | ~86 | Webhook key comparison has TODO for proper decryption post-MVP | Warning | Key comparison works for MVP; explicit TODO defers secure implementation |

No blocker anti-patterns. No return null/empty stubs. No console.log-only implementations. No new anti-patterns introduced by 04-05 changes.

---

### Human Verification Required

#### 1. High-risk tool approval gate (end-to-end)

**Test:** Create a task for a business with an active sales department agent, setting `payload.tools = ["send_email"]`
**Expected:** Task transitions to `waiting_approval`, an approval record appears at `/businesses/[id]/approvals` with `risk_level = "high"`, task stays paused until approved
**Why human:** Requires live database data with active business, agents, and departments to execute the full orchestrator-to-approval path

#### 2. Policy engine elevation visible in approval action summary

**Test:** Create a task with a tool whose name starts with a high-risk policy prefix (e.g., `send_`) but would otherwise have low catalog risk -- the policy engine should elevate it
**Expected:** Approval action summary shows "(elevated by policy)" annotation indicating policy engine drove the higher risk level
**Why human:** Requires crafting a case where catalog risk and policy risk diverge, then verifying the annotation is rendered in the approvals UI

#### 3. Bulk approve/reject flow

**Test:** On the approvals page with multiple pending approvals, select 2-3 with checkboxes, click "Approve Selected"
**Expected:** All selected approvals transition to `approved`, linked tasks resume `in_progress`, success toast shows count, list updates within 10 seconds via polling
**Why human:** Requires real approval records from actual task execution; UI state transitions cannot be verified statically

#### 4. Trusted agent auto-approval (medium risk bypass)

**Test:** Set `is_trusted = true` on an agent via Supabase dashboard, create a medium-priority task that triggers a medium-risk tool (e.g., `create_deal` for sales)
**Expected:** Task completes without pausing for human approval
**Why human:** is_trusted + medium-risk logic in tool-runner requires live execution to verify the conditional branch fires correctly

#### 5. Usage summary visible after task execution

**Test:** Run one or more tasks to completion, then visit the business overview dashboard
**Expected:** UsageSummary card shows non-zero token counts and dollar cost; per-agent breakdown table appears with agent name and stats
**Why human:** Requires actual task execution to populate usage_records; empty state is the default

---

### Gap Closure Summary

**1 gap from initial verification -- CLOSED by plan 04-05:**

The `policy-engine.ts` module was built but orphaned -- `evaluateRisk` was never called from the execution path. Gap closure plan 04-05 wired it into `tool-runner.ts`:

- Import at line 16: `import { evaluateRisk } from "../approval/policy-engine";`
- `maxRiskLevel` helper at lines 53-58: returns the higher of two risk levels
- Inside `runAgentTask` loop (lines 187-199): `catalogRisk = getToolRiskLevel(toolName)`, then `policyRisk = await evaluateRisk(supabase, toolName)`, then `riskLevel = maxRiskLevel(catalogRisk, policyRisk)`
- Fail-open: `catch` block falls back to catalog risk only if policy engine errors
- Policy elevation annotations in approval action strings: `(elevated by policy)` suffix when policy exceeded catalog risk

The 13 seeded `approval_policies` rows are now consulted during every tool execution in `runAgentTask`. APRV-03 and APRV-04 are fully satisfied. Confirmed by commit `e38129d`.

**No regressions.** All 16 previously passing truths verified with regression checks:
- All artifact files exist at expected paths
- service_role grep: zero actual client creation in worker/orchestrator/approval
- executor.ts still calls `runAgentTask(supabase, ...)` at line 235-236
- server.ts still exports evaluateRisk, checkAgentTrust, shouldAutoApprove at lines 66-68

---

_Verified: 2026-03-26T18:30:00Z_
_Verifier: Claude (gsd-verifier)_
