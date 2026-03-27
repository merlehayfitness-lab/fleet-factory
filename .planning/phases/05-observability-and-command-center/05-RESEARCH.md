# Phase 5: Observability and Command Center — Research

**Researched:** 2026-03-26
**Phase Goal:** Admin has full operational visibility into tenant health, agent activity, and conversation history, and can interact with agents through a unified chat interface with emergency controls

## 1. Existing Schema & Infrastructure

### Database Tables Already Exist
- `businesses` — tenant root with status (provisioning|active|suspended|disabled)
- `departments` — 4 default types per business (owner, sales, support, operations)
- `agents` — per-business, per-department with status (provisioning|active|paused|frozen|error|retired), system_prompt, tool_profile (jsonb), model_profile (jsonb), is_trusted (boolean)
- `audit_logs` — business_id scoped with actor_id, action (text), entity_type, entity_id, metadata (jsonb), created_at. Indexes on (business_id, created_at DESC) and (business_id, action). RLS: member SELECT, member INSERT (gated by is_business_member)
- `tasks` — business_id scoped with department_id, assigned_agent_id, title, description, payload, priority, status (7 states), source, result (jsonb), token_usage (jsonb), cost_cents, started_at, completed_at
- `approvals` — business_id scoped with task_id, agent_id, action_type, risk_level, status (6 states), decided_by, decision_note, retry_count
- `usage_records` — business_id scoped with task_id, agent_id, model, prompt_tokens, completion_tokens, cost_cents
- `deployments` — business_id scoped with version, status (6 states), config_snapshot (jsonb)
- `assistance_requests` — business_id scoped with task_id, agent_id, context, blocking_reason, status

### Missing Schema Elements (Must Create)
- **`conversations` table** — referenced in PROJECT.md as: id, business_id, agent_id, channel, transcript_ref, started_at. Needs expansion for Phase 5: department_id, user_id (who initiated), title, status (active|archived), last_message_at, message_count
- **`messages` table** — individual messages within a conversation: id, conversation_id, business_id, role (user|agent|system), agent_id (nullable, for agent messages), content (text), tool_calls (jsonb — tool name, inputs, outputs for inline trace display), metadata (jsonb), created_at
- **No `conversations` or `messages` table exists** — the `agent-conversations.tsx` component is a placeholder that says "The command center chat will be available in Phase 5"

### Missing Code Packages
- **No chat/conversation service** in `packages/core/`
- **No emergency control service** — agent freeze exists in `packages/core/agent/service.ts` via `transitionAgentStatus()` but there is no tenant-wide kill switch service, no tool revocation service, and no reason-logging emergency action flow
- **No health metrics aggregation** — the business overview page fetches raw counts (agents, tasks, approvals, usage) but there is no health dashboard service that computes error rates, task throughput, or agent uptime

### Existing Code Patterns to Follow
- **Server Actions pattern**: thin wrapper in `apps/web/_actions/`, auth check via `supabase.auth.getUser()`, delegation to service in `packages/core/`, `revalidatePath` after mutations
- **Lifecycle state machines**: `packages/core/agent/lifecycle.ts` and `packages/core/task/task-lifecycle.ts` — both use `VALID_TRANSITIONS` record + `canTransition` + `assertTransition` pattern
- **Service pattern**: functions in `packages/core/` accept `SupabaseClient` as first arg, fetch/validate/mutate/audit in sequence, best-effort audit logging
- **Client/server split in core**: `packages/core/index.ts` (client-safe exports) vs `packages/core/server.ts` (Node.js-dependent exports)
- **Page pattern**: Server Component fetches data via Supabase, passes to Client Component for interactivity
- **Status badges**: `StatusBadge` component maps string status to color variants — already has task, approval, risk, and agent status mappings
- **Sidebar nav**: Logs link exists but is `enabled: false` — needs enabling. Chat link does not exist yet — needs adding
- **Freeze dialog**: `freeze-dialog.tsx` uses AlertDialog with confirm button — Phase 5 upgrades this to type-to-confirm pattern
- **Polling pattern**: approvals page uses 10s `setInterval` with Server Action fetch — reuse for dashboard auto-refresh and live tail

### Existing UI Conventions
- shadcn/ui components available: AlertDialog, Avatar, Badge, Button, Card, Collapsible, Dialog, DropdownMenu, Input, Label, ScrollArea, Select, Separator, Table, Tabs, Textarea
- Missing but needed: **Tooltip** (for metric sparklines), **Popover** (for filter dropdowns), **Sheet** (not available — use fixed positioned div pattern from Phase 4)
- Lucide icons throughout
- Toast notifications via sonner
- Forms use react-hook-form with Zod validation

## 2. Architecture Decisions

### Health Dashboard (TOPS-01, TOPS-02, DASH-04 enhancement)
The health dashboard enhances the existing business detail page (`/businesses/[id]`) rather than creating a separate route (per CONTEXT decisions). The current page shows basic counts; Phase 5 replaces/augments this with a mixed-panel layout.

**Data sources for health metrics (all from existing tables):**
- Agent status: query `agents` table grouped by status — count active, idle (paused), error, frozen, deploying (provisioning)
- Error rates: query `tasks` where status='failed' grouped by time window, plus `assistance_requests` count
- Task throughput: query `tasks` grouped by status and time window (completed/hour, queued backlog)
- Deployment state: query latest `deployments` row for status + version
- Pending approvals: query `approvals` where status='pending' (already done on current page)
- Usage metrics: aggregate from `usage_records` (already done on current page)

**No new tables needed for health metrics** — all data comes from existing tables via aggregation queries. A server-side health service in `packages/core/` will compute the aggregated metrics.

**Agent grid**: agents grouped by department. Each agent card shows: name, status badge, department, last task time, error count. Clicking expands inline (Collapsible component) to show recent errors and task history.

**5-state status mapping for dashboard** (per CONTEXT): Active / Idle / Error / Frozen / Deploying. Maps to existing AgentStatus: active→Active, paused→Idle, error→Error, frozen→Frozen, provisioning→Deploying.

**Auto-refresh**: 30-60 second polling via `setInterval` in client component, calling a Server Action that returns the full health payload. Matches the existing polling pattern from Phase 4 approvals.

### Audit Log Viewer (TOPS-03)
Route: `/businesses/[id]/logs` with tabs (per CONTEXT: "Tabbed route with tabs for Audit Log and Conversations").

**Audit log tab** reads from existing `audit_logs` table. No schema changes needed — the table already has business_id, actor_id, action, entity_type, entity_id, metadata (jsonb), created_at.

**Features (per CONTEXT decisions):**
- Hybrid view: activity timeline (default) + toggle to sortable data table
- Advanced filters: actor (user/agent), event type (action field), date range, target entity (entity_type + entity_id), severity level (derived from action pattern), department (join through entity), free-text search (metadata jsonb search)
- Medium card density: 2-3 lines of context plus metadata per entry
- Live tail mode: polling for new entries (append to top of list)
- Export: CSV and JSON download via client-side generation from loaded data

**Indexes already exist**: `idx_audit_logs_business_created` and `idx_audit_logs_business_action`. May need additional index for full-text search if performance requires it.

### Command Center Chat (COMM-01, COMM-02, COMM-03, DASH-10, DASH-11)
Full page route at `/businesses/[id]/chat` (per CONTEXT decisions).

**Schema needed:**
- `conversations` table: id, business_id, department_id, user_id, title, status (active|archived), last_message_at, message_count, created_at, updated_at
- `messages` table: id, conversation_id, business_id, role (user|agent|system), agent_id, content, tool_calls (jsonb), metadata (jsonb), created_at

**Chat UI (per CONTEXT — Slack-like department channels):**
- Left sidebar: department list with unread count badges
- Right area: chat messages with avatars, agent name labels
- Each department is a "channel" — selecting a department shows that department's conversation thread
- Persistent threads: messages stored in DB, scroll back to see history

**Message routing (per CONTEXT — hybrid MVP):**
- Admin sends message → Server Action creates message record (role=user)
- Orchestrator analyzes content and picks the right agent in the department
- Agent response is **simulated with realistic stubs** (per CONTEXT: "agent responses are simulated with realistic stubs — wire up real agents later")
- Response labeled with agent name
- Inline tool call trace summary (e.g., "Queried database — 3 results") stored in tool_calls jsonb

**Stub response strategy**: similar to how tool-runner returns mock results, create a `packages/core/chat/` service with a `generateStubResponse()` function that returns department-appropriate simulated responses. Each department type gets a set of canned response patterns:
- Sales: "I've checked the CRM and found 3 matching leads..."
- Support: "I've searched the knowledge base and found a relevant article..."
- Operations: "I've reviewed the task queue and here's the current status..."
- Owner: "Here's your business summary for today..."

**Typing indicator**: show "Agent is thinking..." for 1-2 seconds before displaying the stub response (simulates real agent latency). Use `setTimeout` in the client component.

**File upload support** (per CONTEXT): text + file upload. For MVP, accept the file and store a reference in message metadata, but the stub agent does not actually process the file content. This keeps the upload UI real while deferring file processing to when real agents are wired up.

**Unread count badges**: track per-department last-read timestamp in client state (localStorage or a simple query of last user message vs last agent message timestamp).

### Conversation Log Viewer (DASH-11, COMM-03)
Lives as the second tab on `/businesses/[id]/logs` (per CONTEXT: "Tabbed route with tabs for Audit Log and Conversations").

**Features (per CONTEXT decisions):**
- Two view modes per transcript: chat replay (rendered as it looked) and structured log view (metadata per message)
- Filters: agent, department, date range
- Full-text search within message bodies and tool call outputs
- Uses same data from `conversations` + `messages` tables

### Emergency Controls (SECR-06, TOPS-05)
Per CONTEXT: controls live on agent cards on the dashboard. This section covers the full emergency action suite.

**Action suite:**
1. **Freeze agent** — transitions agent to `frozen` status. Already supported by `transitionAgentStatus()` in `packages/core/agent/service.ts`. Phase 5 adds: type-to-confirm dialog, mandatory reason field, reason stored in audit_logs metadata
2. **Revoke tool access** — sets agent's `tool_profile` to empty `{}`. Uses existing `updateAgentConfig()` service. Phase 5 adds: type-to-confirm, reason logging
3. **Disable agent** — transitions to `retired` status (terminal state). Already supported by lifecycle
4. **Restore agent** — transitions frozen→active or creates new agent from template for retired. Frozen→active is already supported by lifecycle
5. **Tenant-wide kill switch** — sets `businesses.status` to `disabled`. The `is_business_member()` RLS helper already checks `b.status != 'disabled'`, so disabling a business immediately blocks all data access for that tenant. Phase 5 needs a new service function + Server Action for this

**Type-to-confirm pattern (per CONTEXT):** user must type the agent name or "FREEZE" to enable the confirm button. Prevents accidental clicks. Replaces the current simple AlertDialog confirmation.

**Visual indicators (per CONTEXT):** red overlay + "FROZEN" or "DISABLED" banner on agent cards. Frozen agents in chat show "Agent is frozen" message and input is disabled.

**Every emergency action logged**: audit_logs entry with actor, timestamp, reason, and action details.

## 3. Schema Design

### conversations table
```sql
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users,
  title text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  last_message_at timestamptz DEFAULT now(),
  message_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
```

### messages table
```sql
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.conversations ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'agent', 'system')),
  agent_id uuid REFERENCES public.agents,
  content text NOT NULL,
  tool_calls jsonb DEFAULT '[]',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL
);
```

### No other new tables needed
- Health metrics: computed from existing tables (agents, tasks, approvals, usage_records, deployments)
- Audit logs: existing `audit_logs` table is sufficient
- Emergency controls: use existing agent status transitions + business status update

## 4. RLS Policies

All new tables follow the existing pattern:
- `conversations`: member SELECT via `is_business_member(business_id)`, owner/admin/manager INSERT and UPDATE
- `messages`: member SELECT via `is_business_member(business_id)`, owner/admin/manager INSERT (no UPDATE/DELETE — messages are immutable like audit_logs)

## 5. UI Architecture

### New Routes
- `/businesses/[id]/chat` — Command center chat (full page, Slack-like layout)
- `/businesses/[id]/logs` — Audit log viewer + conversation log viewer (tabbed)

### Modified Routes
- `/businesses/[id]` (page.tsx) — Enhanced with health dashboard panels (agent grid, error rates, task throughput)

### Sidebar Nav Updates
- Enable "Logs" link (currently `enabled: false`)
- Add "Chat" link with MessageSquare icon (new entry between Tasks and Logs)

### Business Overview Updates
- Enable "Logs" quick link card (currently disabled, says "Coming in Phase 5")
- Add "Chat" quick link card
- Add health panels: agent status grid by department, error rate indicator, task throughput
- Wire "Recent Activity" section to actual audit_logs data (currently shows "No recent activity" placeholder)

## 6. Services Architecture

### packages/core/health/ (New)
- `health-service.ts` — Aggregation queries: getAgentHealthSummary (status counts by department), getErrorRate (failed tasks / total in time window), getTaskThroughput (completed tasks per time period), getSystemHealth (combined health score)

### packages/core/chat/ (New)
- `chat-service.ts` — CRUD: createConversation, getConversationsForDepartment, getOrCreateDepartmentConversation, sendMessage, getMessages, archiveConversation
- `chat-stub.ts` — Stub response generator: generateStubResponse(departmentType, messageContent) returns realistic simulated agent response with mock tool_calls
- `chat-types.ts` — ConversationStatus, MessageRole types

### packages/core/emergency/ (New)
- `emergency-service.ts` — Emergency actions: freezeAgentWithReason, revokeToolAccess, disableAgent, restoreAgent, disableTenant, restoreTenant. Each action: validates permissions, executes change, creates audit log with reason

### Server Actions (apps/web/_actions/)
- `chat-actions.ts` — sendMessage, getMessages, getConversations, archiveConversation
- `health-actions.ts` — getHealthDashboard (aggregated health data for polling)
- `emergency-actions.ts` — freezeAgentEmergency, revokeTools, disableAgent, restoreAgent, disableTenant
- `log-actions.ts` — getAuditLogs (with filter params), exportAuditLogs

## 7. Plan Breakdown Strategy

### Plan 05-01: Per-Tenant Health Dashboard and Observability Infrastructure
**Schema:** conversations + messages tables with RLS policies and indexes
**Types:** ConversationStatus, MessageRole, health metric types
**Services:** health-service (aggregation queries for agent status, error rates, task throughput)
**Server Actions:** getHealthDashboard
**UI Changes:**
- Enhanced business overview page with health panels (agent grid by department, error rates, task throughput metrics)
- Agent cards with status indicators, click-to-expand inline detail
- Auto-refresh polling (30-60s interval)
- Wire "Recent Activity" section to real audit_logs data
- Enable "Logs" and "Chat" nav links + quick link cards
**Files ~15-20**

**Requirements covered:** TOPS-01, TOPS-02 (partial — tagging/filtering infrastructure)

### Plan 05-02: Audit Log Viewer, Conversation Log Viewer, and Tenant Kill Switch
**Services:** emergency-service (freeze with reason, revoke tools, disable agent, disable tenant, restore)
**Server Actions:** getAuditLogs, exportAuditLogs, emergency actions (freezeAgentEmergency, revokeTools, disableAgent, disableTenant, restoreAgent, restoreTenant)
**UI Pages:**
- `/businesses/[id]/logs` with two tabs: Audit Log and Conversations
- Audit log tab: activity timeline (default) + data table toggle, advanced filters (actor, event type, date range, entity, severity, department, free-text), live tail mode, CSV/JSON export
- Conversation log tab: conversation list with filters (agent, department, date), click to view transcript in chat replay or structured log view
**Emergency Controls:**
- Type-to-confirm dialog component (reusable)
- Emergency action buttons on agent cards (freeze, revoke tools, disable)
- Red overlay + "FROZEN"/"DISABLED" banner on agent cards
- Tenant-wide kill switch on business settings (tucked behind menu)
- Restore button on frozen/disabled agents
**Files ~20-25**

**Requirements covered:** TOPS-03, TOPS-05, SECR-06, DASH-11 (partial), TOPS-02 (completion — filterable per tenant)

### Plan 05-03: Command Center Chat with Conversation Storage
**Services:** chat-service (CRUD for conversations and messages), chat-stub (simulated agent responses)
**Server Actions:** sendMessage, getMessages, getConversations, archiveConversation
**UI Page:**
- `/businesses/[id]/chat` — full page Slack-like layout
- Left sidebar: department channel list with unread badges
- Right area: message list with avatars, agent name labels, typing indicator
- Message input with text + file upload support
- Inline tool call trace summaries under agent messages
- Frozen agents show "Agent is frozen" state in chat
**Orchestrator integration:** message routing picks agent via existing `selectAgent()` from `packages/core/orchestrator/router.ts`
**Stub responses:** department-appropriate simulated responses with mock tool_calls
**Files ~15-20**

**Requirements covered:** COMM-01, COMM-02, COMM-03, DASH-10, DASH-11 (completion)

## 8. Requirement Coverage

| Requirement | Covered By | Notes |
|-------------|-----------|-------|
| TOPS-01 | Plan 05-01 | Health dashboard with agent status, error rates, task throughput, deployment state |
| TOPS-02 | Plan 05-01 + 05-02 | All queries scoped by business_id via RLS; filters by business_id on log/metrics views |
| TOPS-03 | Plan 05-02 | Audit log viewer with search, filter by actor/event type, timeline + table views |
| TOPS-05 | Plan 05-02 | Tenant kill switch sets business.status='disabled'; RLS helper blocks all access |
| COMM-01 | Plan 05-03 | Chat routes messages to agent via orchestrator's selectAgent() |
| COMM-02 | Plan 05-03 | Conversations + messages stored with tool_calls jsonb for traces |
| COMM-03 | Plan 05-03 + 05-02 | Conversation log viewer filterable by agent, department, date |
| DASH-10 | Plan 05-03 | Command center chat interface at /businesses/[id]/chat |
| DASH-11 | Plan 05-02 + 05-03 | Conversation log viewer with transcript history and tool call traces |
| SECR-06 | Plan 05-02 | Emergency controls: freeze agent, revoke tools, disable tenant — all immediate |

All 10 requirements covered across 3 plans.

## 9. Technical Considerations

### Stub Chat Responses (Hybrid MVP)
Per CONTEXT: "full chat UI and routing logic are real, but agent responses are simulated with realistic stubs." The stub response generator should:
- Accept department type and user message content
- Return a response object with: content (text), agent_name, tool_calls (array of simulated traces)
- Include a simulated delay (1-2 seconds) via the client-side typing indicator
- Be clearly marked as stub in code for future replacement with real Claude API calls (Phase 6)

### Tenant Kill Switch Implementation
The existing `is_business_member()` RLS helper already includes `AND b.status != 'disabled'`. Setting `businesses.status = 'disabled'` immediately blocks all data access for that tenant. This means:
- The kill switch is a single UPDATE to the businesses table
- All RLS-protected queries return zero rows for disabled tenants
- No need to individually freeze each agent — the RLS gate handles isolation
- Restoring requires setting status back to 'active' (or 'suspended' for partial restoration)

However, per CONTEXT: "tenant-wide kill switch available but tucked behind a menu/settings page." For defense-in-depth, the kill switch should ALSO freeze all agents (so they don't resume if the business is re-enabled before an admin reviews them).

### SQL Migration Numbering
Existing migrations go up to 023. New Phase 5 migrations:
- `024_conversations_table.sql`
- `025_messages_table.sql`
- `026_phase5_rls_policies.sql`

### Audit Log Full-Text Search
The audit_logs table stores metadata as jsonb. For the free-text search requirement, options:
- **Option A: Client-side filtering** — load recent logs (paginated) and filter in browser. Simplest, works for moderate log volumes
- **Option B: Postgres jsonb containment** — use `metadata::text ILIKE '%search%'` for basic text search
- **Option C: Postgres full-text search** — add a tsvector column with GIN index
- **Recommended: Option B** for MVP — simple, no schema changes, adequate performance for per-tenant log volumes. Upgrade to Option C if search performance becomes an issue

### Chat Message Ordering and Pagination
Messages should be fetched in ascending order (oldest first) for chat display. For long conversations:
- Default: load last 50 messages
- "Load more" button scrolls up to fetch older messages (offset-based pagination)
- New messages append at bottom via polling (5-10 second interval on active chat view)

### File Upload for Chat
Per CONTEXT: "Text + file upload support." For MVP:
- Accept file via standard HTML file input
- Upload to Supabase Storage bucket (scoped by business_id)
- Store file reference (URL, filename, size, type) in message metadata jsonb
- Display as a file attachment card in the message bubble
- Stub agent does not process files — just acknowledges receipt

### Emergency Controls: Type-to-Confirm Component
Build a reusable `TypeToConfirmDialog` component that:
- Shows the action description and warning text
- Has a text input where user must type the confirmation phrase (agent name or "FREEZE")
- Confirm button stays disabled until input matches
- Has a mandatory "Reason" textarea
- On confirm: calls Server Action with action + reason

This replaces the current `FreezeDialog` (simple AlertDialog) with a more secure confirmation pattern.

### Agent Status Display on Dashboard
The CONTEXT specifies a 5-state model: Active / Idle / Error / Frozen / Deploying. Map from existing AgentStatus:
- `active` → Active (green)
- `paused` → Idle (gray)
- `error` → Error (red)
- `frozen` → Frozen (blue-gray, with red overlay per CONTEXT)
- `provisioning` → Deploying (amber)
- `retired` → not shown in health grid (terminal state, agent is gone)

### Export Functionality
CSV/JSON export for audit logs (per CONTEXT). Implement client-side:
- Fetch all matching logs (with current filters applied)
- Convert to CSV or JSON format in browser
- Trigger download via Blob URL
- No server-side file generation needed for MVP volumes

## RESEARCH COMPLETE
