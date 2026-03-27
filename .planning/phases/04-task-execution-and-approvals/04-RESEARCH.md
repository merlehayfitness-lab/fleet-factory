# Phase 4: Task Execution and Approvals — Research

**Researched:** 2026-03-26
**Phase Goal:** Tasks flow through the orchestrator to department agents, agents execute with sandboxed tool access, and risky actions pause for human approval with risk-tiered routing

## 1. Existing Schema & Infrastructure

### Database Tables Already Exist
- `businesses` — tenant root with status (provisioning|active|suspended|disabled)
- `departments` — 4 default types per business (owner, sales, support, operations)
- `agents` — per-business, per-department with status (provisioning|active|paused|frozen|error|retired), system_prompt, tool_profile (jsonb), model_profile (jsonb)
- `agent_templates` — global blueprints for agent creation
- `deployments` — versioned with config_snapshot, status tracking, rollback support
- `integrations` — per-agent integration config (crm, email, helpdesk, calendar, messaging)
- `secrets` — AES-256-GCM encrypted per-business credential storage
- `audit_logs` — business_id scoped with actor_id, action, entity_type, entity_id, metadata (jsonb)
- `business_users` — role-based membership (owner, admin, manager, member)

### Missing Schema Elements (Must Create)
- **`tasks` table** — referenced in PROJECT.md as: id, business_id, assigned_agent_id, title, payload_json, priority, status. Needs expansion for orchestrator routing: department_id, parent_task_id (for subtasks), created_by, description, result (jsonb), token_usage (jsonb), cost_cents (int), started_at, completed_at
- **`subtask_dependencies` table** — DAG support for parallel/sequential subtask execution per CONTEXT decisions
- **`approvals` table** — referenced in PROJECT.md as: id, business_id, task_id, requested_by_agent_id, action_type, status. Needs expansion for risk tiers: risk_level, action_summary, agent_reasoning (text), policy_rule_id, decided_by, decided_at, decision_note, retry_count
- **`approval_policies` table** — global default risk policies (action_pattern, risk_level, description, is_active)
- **`assistance_requests` table** — when agent can't complete, it creates a help request for admin (per CONTEXT decisions: agent does NOT auto-fail, it asks for help)
- **`usage_records` table** — per-task token metering: task_id, agent_id, business_id, prompt_tokens, completion_tokens, model, cost_cents, created_at

### Missing Code Packages
- **No `apps/worker` or `packages/worker`** — CLAUDE.md mentions this slot. Phase 4 needs an orchestrator service and a worker execution layer
- **No API routes** — all mutations currently use Server Actions (thin action in `apps/web/_actions/`, delegates to `packages/core/`). Phase 4 needs a webhook/event ingestion endpoint (TASK-06)
- **No task/approval types or services** in `packages/core/`

### Existing Code Patterns to Follow
- **Server Actions pattern**: thin wrapper in `apps/web/_actions/`, auth check via `supabase.auth.getUser()`, delegation to service in `packages/core/`, `revalidatePath` after mutations
- **Lifecycle state machines**: `packages/core/agent/lifecycle.ts` and `packages/core/deployment/lifecycle.ts` — both use `VALID_TRANSITIONS` record + `canTransition` + `assertTransition` pattern
- **Service pattern**: functions in `packages/core/` accept `SupabaseClient` as first arg, fetch/validate/mutate/audit in sequence, best-effort audit logging (errors logged not thrown)
- **Types exported from**: `packages/core/types/index.ts` — all status/role enums
- **Client/server split in core**: `packages/core/index.ts` (client-safe exports) vs `packages/core/server.ts` (Node.js-dependent exports)
- **Page pattern**: Server Component fetches data via Supabase, passes to Client Component for interactivity
- **Status badges**: `StatusBadge` component maps string status to color variants
- **Sidebar nav**: currently has Tasks and Approvals disabled (`enabled: false`) — needs enabling

### Existing UI Conventions
- Pages use `createServerClient()`, check auth, fetch data, render Server Components
- Client components use `"use client"` directive, receive data via props
- Forms use react-hook-form with Zod validation
- Toast notifications via sonner
- Lucide icons throughout
- Cards, tables, badges from shadcn/ui (base-ui variant, NOT Radix — no `asChild`)
- Disabled nav links rendered as `span` with `cursor-not-allowed`

## 2. Architecture Decisions

### Orchestrator Service (Paperclip)
The orchestrator runs **server-side within the Next.js app** for MVP, not as a separate microservice. This matches the existing deployment service pattern where the "pipeline" runs synchronously in a Server Action.

**Responsibilities:**
1. Accept task from admin panel or API webhook
2. Determine target department (admin selects, orchestrator validates/suggests)
3. For complex tasks: decompose into subtask DAG (parallel + sequential dependencies)
4. For high-priority decompositions: pause and show plan for admin confirmation
5. Assign agents within departments
6. Track parent task progress from subtask completions
7. Handle failure → create assistance request instead of auto-failing

**Implementation approach:**
- `packages/core/orchestrator/` — routing logic, decomposition, assignment
- Task decomposition is a **mock/stub** for MVP (predefined decomposition rules per department type, not Claude-powered). Claude-powered decomposition is Phase 6 (Builder service)
- Routing rules: match task department to available active agents in that department. If only one agent per department (MVP default), assignment is trivial

### Worker Service (OpenClaw)
The worker executes agent tasks by calling tools from the agent's `tool_profile`. For MVP, this is a **simulated execution layer** — the worker processes are represented in the database, and tool execution returns mock results.

**Key constraints from requirements:**
- SECR-03: Sandboxed execution — no host filesystem access, restricted mounts
- SECR-04: Tool access validated against tenant-scoped allowlists
- SECR-05: Agents never run with service_role credentials

**MVP implementation:**
- `packages/core/worker/` — task executor, tool runner, sandbox validator
- Tool execution is **mock** — validates tool against allowlist, returns simulated result. Matches how integration adapters work (mock adapters returning realistic data)
- Sandbox validation is a **policy check** function: given agent's tool_profile, validate that requested tool is in the allowlist. No actual Docker sandboxing for MVP
- Agent execution uses the **user's Supabase client** (RLS-scoped), never service_role — this satisfies SECR-05 inherently

### Risk-Tiered Approval Gates
Per CONTEXT decisions, three tiers:

| Tier | Behavior | Examples |
|------|----------|---------|
| Low | Auto-run, logged | Read-only, drafts, notes, internal status updates |
| Medium | Async review — agent continues other work | Non-trivial writes, internal escalations |
| High | Synchronous block — agent pauses | External emails, payments, deletions, config changes |

**Policy rules implementation:**
- Global default policy table with action patterns and assigned risk levels
- Seed initial policies covering common action categories
- Per-agent trust override: agents marked "trusted" auto-approve medium-risk (from CONTEXT decisions)
- Policy evaluation: given (action_type, agent_id, business_id) → determine risk level → create approval if needed
- No timeout on approvals — agent stays paused indefinitely (CONTEXT decision)

### Task State Machine
```
queued → assigned → in_progress → completed
                  → in_progress → failed
                  → in_progress → waiting_approval (gated action)
                  → waiting_approval → in_progress (approved)
                  → waiting_approval → in_progress (rejected → retry)
queued → assigned → assistance_requested
```

### Approval State Machine
```
pending → approved
pending → rejected → retry_pending (first rejection — agent auto-retries)
retry_pending → pending (agent submits revised approach)
pending → rejected → guidance_required (second rejection — admin writes guidance)
guidance_required → pending (admin provides guidance, agent retries with it)
```

### Rejection Flow (Two-Step Escalation)
Per CONTEXT decisions:
1. **First rejection**: approval status → rejected, agent automatically retries with a different approach. New approval created if still risky
2. **Second rejection**: admin provides written guidance. Agent uses guidance to retry. This prevents micro-management while keeping the admin in control

### Task Decomposition & DAG
Per CONTEXT decisions, complex tasks decompose into subtasks with a DAG structure:
- `parent_task_id` on tasks table enables parent-child relationship
- `subtask_dependencies` junction table enables DAG edges (prerequisite relationships)
- Orchestrator evaluates which subtasks can run in parallel vs sequentially
- Parent task aggregates status from children

### Webhook Ingestion (TASK-06)
New API route: `POST /api/businesses/:id/tasks/ingest`
- Accepts external events (JSON payload) to create tasks
- Validates API key or signed webhook signature per business
- Creates task with source="webhook" and routes through orchestrator

## 3. Schema Design

### tasks table
```sql
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  parent_task_id uuid REFERENCES public.tasks,
  department_id uuid REFERENCES public.departments,
  assigned_agent_id uuid REFERENCES public.agents,
  created_by uuid REFERENCES auth.users,
  title text NOT NULL,
  description text,
  payload jsonb DEFAULT '{}',
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high')),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'assigned', 'in_progress', 'waiting_approval', 'assistance_requested', 'completed', 'failed')),
  source text NOT NULL DEFAULT 'admin'
    CHECK (source IN ('admin', 'api', 'webhook', 'orchestrator')),
  result jsonb,
  error_message text,
  token_usage jsonb DEFAULT '{"prompt_tokens": 0, "completion_tokens": 0}',
  cost_cents integer DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
```

### subtask_dependencies table
```sql
CREATE TABLE IF NOT EXISTS public.subtask_dependencies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.tasks ON DELETE CASCADE,
  depends_on_task_id uuid NOT NULL REFERENCES public.tasks ON DELETE CASCADE,
  UNIQUE (task_id, depends_on_task_id)
);
```

### approvals table
```sql
CREATE TABLE IF NOT EXISTS public.approvals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents,
  action_type text NOT NULL,
  action_summary text NOT NULL,
  agent_reasoning text,
  risk_level text NOT NULL
    CHECK (risk_level IN ('low', 'medium', 'high')),
  risk_explanation text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'auto_approved', 'approved', 'rejected', 'retry_pending', 'guidance_required')),
  decided_by uuid REFERENCES auth.users,
  decided_at timestamptz,
  decision_note text,
  retry_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
```

### approval_policies table
```sql
CREATE TABLE IF NOT EXISTS public.approval_policies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  action_pattern text NOT NULL,
  risk_level text NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  description text,
  category text NOT NULL DEFAULT 'general'
    CHECK (category IN ('data_read', 'data_write', 'external_comm', 'config_change', 'destructive', 'financial', 'general')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL
);
```

### assistance_requests table
```sql
CREATE TABLE IF NOT EXISTS public.assistance_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents,
  context text NOT NULL,
  blocking_reason text NOT NULL,
  admin_response text,
  responded_by uuid REFERENCES auth.users,
  responded_at timestamptz,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'responded', 'resolved')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
```

### usage_records table
```sql
CREATE TABLE IF NOT EXISTS public.usage_records (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks,
  agent_id uuid NOT NULL REFERENCES public.agents,
  model text NOT NULL DEFAULT 'claude-sonnet',
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  cost_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);
```

### Agent table modification
Add `is_trusted` boolean column to agents table:
```sql
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS is_trusted boolean DEFAULT false;
```

## 4. RLS Policies

All new tables follow the existing pattern:
- SELECT: `is_business_member(business_id)` for tenant-scoped reads
- INSERT/UPDATE/DELETE: `has_role_on_business(business_id, 'owner') OR has_role_on_business(business_id, 'admin')`
- `approval_policies` is a global table (like `agent_templates`) — authenticated SELECT for all, admin-only write
- `usage_records`: member SELECT, system INSERT (via service or Server Action)

## 5. UI Architecture

### New Routes
- `/businesses/[id]/tasks` — Task work queue (table + kanban toggle)
- `/businesses/[id]/tasks/new` — Full task creation page
- `/businesses/[id]/tasks/[taskId]` — Full task detail page
- `/businesses/[id]/approvals` — Approval request list with bulk actions

### Tasks Page (CONTEXT Decisions)
- **Two views**: table (default) and kanban board (columns by status)
- **Quick-add** inline form at top: title, description, department, priority
- **Full filter bar**: status, department, priority, assigned agent
- **Task detail slide-over**: quick view panel, "View full details" link to `/tasks/[taskId]`
- **Parent/subtask visualization**: parent tasks show subtask progress inline

### Approvals Page (CONTEXT Decisions)
- **List view** with checkbox selection for bulk approve/reject
- **Columns**: action summary, risk level (color-coded badge), agent, task, department, created at
- **Expandable rows**: full agent reasoning/execution trace
- **Real-time toast** notifications when new approvals arrive
- **Risk badges**: green (low), yellow (medium), red (high) with explanation text

### Task Creation Flow
1. Quick-add on tasks page OR navigate to `/tasks/new`
2. Admin selects department (required) + priority
3. Orchestrator auto-suggests department based on content (display only, admin confirms)
4. For high priority: show decomposition plan before executing
5. Task enters queue → orchestrator routes to agent

### Sidebar Nav Updates
- Enable "Tasks" link (currently disabled)
- Enable "Approvals" link (currently disabled)

### Business Overview Updates
- Wire up `pendingApprovalCount` (currently hardcoded to 0)
- Enable "Tasks" quick link card (currently disabled, says "Coming in Phase 4")

## 6. Services Architecture

### packages/core/task/ (New)
- `task-schema.ts` — Zod schemas for task creation/update
- `task-lifecycle.ts` — Task status state machine (like agent/deployment lifecycle)
- `task-service.ts` — CRUD operations: createTask, getTasksForBusiness, getTaskById, updateTaskStatus, getSubtasks
- `task-types.ts` — TaskStatus, TaskPriority, TaskSource types

### packages/core/orchestrator/ (New)
- `router.ts` — Route task to department, select agent within department
- `decomposer.ts` — Decompose complex tasks into subtask DAG (mock rules for MVP)
- `executor.ts` — Orchestrate task execution: assign → execute → check approval → complete/fail

### packages/core/worker/ (New)
- `tool-runner.ts` — Execute tool from agent's tool_profile (mock execution)
- `sandbox.ts` — Validate tool access against allowlist (SECR-03, SECR-04)
- `metering.ts` — Track token usage and cost per execution (TOPS-04)

### packages/core/approval/ (New)
- `approval-schema.ts` — Zod schemas for approval decisions
- `approval-lifecycle.ts` — Approval status state machine
- `approval-service.ts` — CRUD: createApproval, getApprovalsForBusiness, approveAction, rejectAction, bulkApprove, bulkReject
- `policy-engine.ts` — Evaluate action against policies, determine risk level, check agent trust

### Server Actions (apps/web/_actions/)
- `task-actions.ts` — createTask, updateTask, quick-add task, get tasks
- `approval-actions.ts` — approve, reject, bulkApprove, bulkReject, getApprovals
- `assistance-actions.ts` — respond to assistance request

### API Routes (apps/web/app/api/)
- `POST /api/businesses/[id]/tasks/ingest` — Webhook/event ingestion (TASK-06)

## 7. Mock Execution Strategy

For MVP, the full Claude-powered agent execution is not yet built (that's Phase 6 Builder service). The execution layer needs to be **realistic enough to demonstrate the flow** without actual LLM calls.

**Mock execution approach:**
1. Task is created → orchestrator routes to agent
2. Worker "executes" by: validating tool access → generating mock result based on tool type and department → simulating token usage
3. For risky actions: worker creates approval request before "executing" the action
4. Mock results include realistic sample data (similar to how mock integration adapters work)

**What is mock vs real:**
| Component | MVP Status | What It Does |
|-----------|-----------|-------------|
| Task CRUD | Real | Full database operations, RLS, audit logging |
| Orchestrator routing | Real | Department matching, agent selection, DAG management |
| Task decomposition | Mock | Predefined rules, not Claude-powered |
| Tool execution | Mock | Validates allowlist, returns sample data |
| Approval gates | Real | Full approval workflow with policy engine |
| Token metering | Mock | Simulated token counts, realistic cost estimates |
| Webhook ingestion | Real | API endpoint that creates tasks from external events |
| Sandbox validation | Real | Policy check function (no Docker, but validates allowlists) |

## 8. Plan Breakdown Strategy

### Plan 04-01: Orchestrator Service (Paperclip) with Task Routing and Decomposition
**Schema:** tasks, subtask_dependencies, assistance_requests tables + RLS policies
**Types:** TaskStatus, TaskPriority, TaskSource, task Zod schemas
**Lifecycle:** Task state machine (queued → assigned → in_progress → completed/failed)
**Services:** task-service (CRUD), router (department + agent assignment), decomposer (mock DAG)
**Server Actions:** createTask, getTasksForBusiness, updateTaskStatus
**API Route:** POST webhook ingestion endpoint for TASK-06
**Files ~15-20**

### Plan 04-02: Worker Service (OpenClaw) with Sandboxed Tool Execution
**Schema:** usage_records table + is_trusted column on agents
**Services:** tool-runner (mock execution), sandbox validator (allowlist check), metering (token tracking)
**Integration:** Wire worker into orchestrator flow — task assigned → worker executes → result stored
**Mock tools:** Per-department tool catalog with realistic mock results
**Security:** Validate all tool access against tool_profile allowlist, ensure no service_role usage
**Files ~10-15**

### Plan 04-03: Approval Gates, Policy Rules, Escalation, and Tasks/Approvals Pages
**Schema:** approvals, approval_policies tables + RLS policies + seed default policies
**Lifecycle:** Approval state machine with two-step rejection flow
**Services:** approval-service (CRUD + bulk), policy-engine (risk evaluation + trust check)
**Server Actions:** approve, reject, bulkApprove, bulkReject, getApprovals, assistance response
**UI Pages:**
- `/tasks` page with table/kanban toggle, quick-add form, filter bar, slide-over detail
- `/tasks/new` full creation page
- `/tasks/[taskId]` full detail page with subtask visualization
- `/approvals` page with bulk actions, expandable reasoning, risk badges
**UI Updates:** Enable sidebar nav, wire business overview approval count, approval toast notifications
**Files ~25-30**

### Plan 04-04: Usage Metering and Security Hardening
**Metering:** Wire usage_records into worker execution, aggregate per-tenant per-agent stats
**Dashboard:** Add usage summary to business overview (DASH-09 completion), token/cost display on task detail
**Security audit:** Verify no service_role leaks, validate all RLS policies on new tables, test sandbox validator
**Hardening:** Error handling, edge cases, loading/empty states, audit log coverage
**Files ~8-12**

## 9. Requirement Coverage

| Requirement | Covered By | Notes |
|-------------|-----------|-------|
| TASK-01 | Plan 04-01 | Tasks via admin panel (quick-add + full page) + Plan 04-01 API webhook |
| TASK-02 | Plan 04-01 | Orchestrator routes by department + priority |
| TASK-03 | Plan 04-02 | Worker executes with tool_profile tools (mock for MVP) |
| TASK-04 | Plan 04-01 | Status: queued, assigned, in_progress, completed, failed |
| TASK-05 | Plan 04-03 | Tasks page with table/kanban, filters, all departments |
| TASK-06 | Plan 04-01 | Webhook/event ingestion API endpoint |
| APRV-01 | Plan 04-03 | Risky actions create approval requests that pause execution |
| APRV-02 | Plan 04-03 | Admin approve/reject from approvals page |
| APRV-03 | Plan 04-03 | Risk-tiered routing: low auto, medium async, high sync |
| APRV-04 | Plan 04-03 | Policy rules gate irreversible actions |
| APRV-05 | Plan 04-03 | Agent confidence → escalation (modeled as risk threshold) |
| APRV-06 | Plan 04-03 | Escalation: agent → manager → admin → owner (via approval routing) |
| APRV-07 | Plan 04-03 | All decisions logged in audit_logs with full context |
| DASH-09 | Plan 04-03 + 04-04 | Tasks and approvals pages per business |
| SECR-03 | Plan 04-02 | Sandbox validation — no host filesystem, restricted mounts |
| SECR-04 | Plan 04-02 | Tool access validated against tenant-scoped allowlists |
| SECR-05 | Plan 04-02 | Agents use RLS-scoped client, never service_role |
| TOPS-04 | Plan 04-04 | Token consumption + cost metered per tenant per agent |

All 18 requirements covered across 4 plans.

## 10. Technical Considerations

### No Real LLM Calls in Phase 4
The mock execution strategy means Phase 4 does NOT require Anthropic API keys or Claude API integration. The worker simulates agent execution with deterministic mock results. Real LLM integration comes in Phase 5 (Command Center Chat) and Phase 6 (Builder Service).

### Supabase Realtime for Approval Notifications
CONTEXT decisions call for "real-time toast/banner notifications when approval requests arrive." Options:
- **Option A: Polling** — Tasks page polls for pending approvals every 5-10 seconds. Simplest, matches project constraint ("polling or server actions sufficient for admin operations")
- **Option B: Supabase Realtime** — Subscribe to approvals table changes. More responsive but adds complexity
- **Recommended: Option A (polling)** — matches out-of-scope decision on WebSockets. Use `setInterval` + Server Action fetch in client component

### DAG Execution Order
Subtask DAG evaluation:
1. Fetch all subtasks for parent task
2. Fetch all dependencies from subtask_dependencies
3. A subtask is "ready" when all its dependencies are completed
4. Execute all ready subtasks in parallel (concurrent Server Action calls)
5. Re-evaluate after each completion
6. Parent task completes when all subtasks complete; fails if any critical subtask fails

### Token Metering Strategy
Since agent execution is mock for MVP, token counts are simulated:
- Small task: ~200 prompt + ~100 completion tokens
- Medium task: ~500 prompt + ~300 completion tokens
- Large/complex task: ~1000 prompt + ~600 completion tokens
- Cost calculated at $3/million input, $15/million output tokens (Claude Sonnet pricing)
- Stored per usage_record for aggregation queries

### SQL Migration Numbering
Existing migrations go up to 015. New Phase 4 migrations:
- `016_tasks_table.sql`
- `017_subtask_dependencies.sql`
- `018_approvals_table.sql`
- `019_approval_policies.sql`
- `020_assistance_requests.sql`
- `021_usage_records.sql`
- `022_agents_trusted_column.sql`
- `023_phase4_rls_policies.sql`

### Kanban View Implementation
CONTEXT specifies kanban board with columns by status. For MVP:
- Columns: Queued, Assigned, In Progress, Waiting Approval, Completed, Failed
- Cards show: title, priority badge, department, assigned agent
- Drag-and-drop is visual only (CONTEXT says "feel" not functional for status changes)
- Use CSS grid for column layout, no external drag-and-drop library

### Status Badge Additions
The existing `StatusBadge` component needs new status mappings:
- Task statuses: queued, assigned, in_progress, waiting_approval, assistance_requested, completed, failed
- Approval statuses: pending, auto_approved, approved, rejected, retry_pending, guidance_required
- Risk levels: low (green), medium (yellow/amber), high (red)

## RESEARCH COMPLETE
