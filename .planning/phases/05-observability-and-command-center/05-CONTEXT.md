# Phase 5: Observability and Command Center - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin has full operational visibility into tenant health, agent activity, and conversation history. Includes a unified chat interface to interact with agents through department channels, conversation log viewing, audit trail, and emergency controls (freeze, revoke tools, disable agent/tenant). All data is tenant-isolated.

</domain>

<decisions>
## Implementation Decisions

### Health Dashboard
- Mixed panel layout: system health metrics on one side, agent grid on the other — everything visible at once
- Enhance the existing business detail page (/businesses/[id]) with health panels rather than a separate route
- Agents grouped under department sections (Sales agents together, Support agents together, etc.)
- 5-state agent status tracking: Active / Idle / Error / Frozen / Deploying
- Clicking an agent card expands inline to show more detail (recent errors, task history) without leaving the page
- Auto-refresh polling every 30-60 seconds (no WebSockets needed for dashboard)

### Claude's Discretion (Dashboard)
- Metric visualization approach per metric type (numbers, badges, sparklines as appropriate)
- Default time range with a time range selector

### Chat Interface
- Department channels (Slack-like): department list on left sidebar, chat area on right, message bubbles with avatars
- Full page route at /businesses/[id]/chat
- Auto-routing: orchestrator analyzes message content and picks the right agent within the department
- Every response labeled with the agent name that handled it
- Persistent conversation threads per department channel — scroll back to see history
- Inline summary for tool call traces (e.g., "Queried database — 3 results") under agent messages
- Hybrid MVP: full chat UI and routing logic are real, but agent responses are simulated with realistic stubs — wire up real agents later
- Text + file upload support (images, documents that agents can reference)
- Typing indicator first ("Agent is thinking..."), then stream the response as it comes in
- No replay button — user can copy-paste and send again manually
- Unread message count badges on each department channel in the sidebar

### Log & Audit Viewing
- Hybrid format: activity timeline view by default, toggle to sortable data table view
- Tabbed route: /businesses/[id]/logs with tabs for Audit Log and Conversations
- Medium card density: each entry shows 2-3 lines of context plus metadata
- Advanced filters: actor (user/agent), event type, date range, target entity, severity level, department, and free-text search
- Conversation transcripts support both views: chat replay (rendered as it looked) and structured log view (metadata per message)
- Full-text search within message bodies and tool call outputs
- Live tail mode: new entries appear automatically as they happen
- Export support: CSV and JSON download for compliance and analysis

### Emergency Controls
- Controls live on agent cards on the dashboard — freeze/disable buttons right where you see status
- Type-to-confirm for emergency actions (type agent name or "FREEZE" to confirm — prevents accidental clicks)
- Full action suite: freeze agent, revoke tool access, disable agent, plus tenant-wide kill switch
- Tenant-wide kill switch ("Disable All Agents") available but tucked behind a menu/settings page
- Red overlay + prominent "FROZEN" or "DISABLED" banner on agent cards in emergency state
- Restore button on frozen/disabled agents to reverse the action
- Frozen agents show in chat but disabled — messages display "Agent is frozen" and input is disabled
- Every emergency action logged with actor, timestamp, and admin must enter a reason before confirming

</decisions>

<specifics>
## Specific Ideas

- Chat interface should feel Slack-like with department channels as the primary navigation
- Emergency controls should feel serious — type-to-confirm and mandatory reason logging convey gravity
- Dashboard should surface problems quickly — mixed panels mean you see both system-wide health and per-agent status at a glance
- Log viewer should work like tailing a production log — live updates, full-text search, export for offline analysis

</specifics>

<deferred>
## Deferred Ideas

- Wiring up real agent responses in chat (MVP uses realistic stubs) — future phase
- Scheduled/automated emergency actions (auto-freeze on error threshold) — future phase

</deferred>

---

*Phase: 05-observability-and-command-center*
*Context gathered: 2026-03-26*
