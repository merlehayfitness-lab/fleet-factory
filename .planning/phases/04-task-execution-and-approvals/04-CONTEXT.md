# Phase 4: Task Execution and Approvals - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Tasks flow through the orchestrator to department agents, agents execute with sandboxed tool access, and risky actions pause for human approval with risk-tiered routing. This phase delivers task creation, orchestrator routing, agent execution, approval gates, and usage metering. Chat interface and observability dashboards are Phase 5.

</domain>

<decisions>
## Implementation Decisions

### Task Creation & Entry Points
- Two entry points: quick-add inline form on tasks page + full creation page at /tasks/new
- Quick-add for simple tasks (title, description, department, priority), full page for complex ones with structured fields
- Admin selects department (required), orchestrator auto-suggests department based on content, admin confirms
- Department-level assignment only — orchestrator picks the agent within the department
- 3 priority levels: Low, Medium, High

### Orchestrator Routing & Decomposition
- Orchestrator auto-decomposes complex tasks into subtasks assigned to different agents
- Decomposition approval depends on priority: Low/Medium auto-execute the breakdown, High priority shows the plan for admin confirmation first
- Cross-department coordination supported with full DAG: some subtasks run in parallel, others have sequential dependencies
- Parent task tracks overall progress; subtasks are individually tracked

### Task Failure & Recovery
- When an agent can't complete a task, it pauses and creates an assistance request for the admin with context about what's blocking it
- Agent does NOT auto-fail — it asks for help

### Rejection Flow (Two-Step Escalation)
- First rejection: agent retries with a different approach automatically
- Second rejection: admin provides written guidance explaining what to do instead, agent uses this to retry

### Approval Notifications & Context
- Real-time toast/banner notifications when approval requests arrive, plus approvals page for full list
- Approval requests show action summary by default (what agent wants to do, which task, risk level)
- Expandable section reveals full agent reasoning/execution trace for deeper context
- Bulk approve/reject via checkbox selection on approvals list

### Task & Approval Pages
- Separate pages: /tasks and /approvals (matches existing route structure)
- Tasks page has togglable view: table (default for power users) and kanban board (columns by status)
- Task detail: slide-over panel for quick view, with "View full details" link to dedicated /tasks/[id] page
- Full filter bar: status, department, priority, assigned agent

### Risk Tier Behavior
- **Low risk (auto-run):** Read-only actions + safe writes (drafts, notes, internal status updates)
- **Medium risk (async review):** Agent continues working on other subtasks while the gated action waits for approval
- **High risk (synchronous blocking):** External-facing actions (emails to clients, social posts, payments, live integrations) + destructive actions (deleting records, modifying agent configs, changing permissions, revoking access)
- Risk displayed as color-coded badges (green/yellow/red) plus short explanation of WHY it's that risk level (e.g., "Sends external email")
- No timeout on approval requests — agent stays paused indefinitely until admin acts

### Risk Policy & Trust
- Global default risk policies for MVP (same for all businesses)
- Per-business risk overrides deferred to future phase
- Per-agent trust lever: admins can mark specific agents as "trusted" to auto-approve medium-risk actions

### Audit Trail
- All actions logged (auto-approved, async reviewed, and blocking) — full audit trail for compliance
- Every action type captured regardless of risk level

### Claude's Discretion
- Orchestrator implementation architecture and task queue design
- Sandbox/container isolation approach
- Token metering and cost tracking implementation
- Database schema for tasks, subtasks, and approval records
- Assistance request UI design details
- Loading and error states for task/approval pages

</decisions>

<specifics>
## Specific Ideas

- Quick-add should feel lightweight — don't overload it with fields, save complexity for the full creation page
- Kanban view should have drag-and-drop feel even if not functional for status changes (visual workflow reference)
- Approval toasts should be visually distinct from regular notifications — admin needs to know immediately when something needs their attention
- The two-step rejection flow (agent retries -> admin guides) keeps the agent productive without forcing admin micro-management

</specifics>

<deferred>
## Deferred Ideas

- Per-business risk policy overrides — future phase after MVP
- Approval timeout/escalation to other admins — not needed for MVP (no timeout, stays paused)
- Email/external notifications for approvals — in-app only for now

</deferred>

---

*Phase: 04-task-execution-and-approvals*
*Context gathered: 2026-03-26*
