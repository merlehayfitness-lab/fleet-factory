# Phase 2: Agent Management - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin can view and manage the full lifecycle of template-based agents across departments within a business. This includes agent templates (CRUD), agent list view, agent detail view with tabs, lifecycle state transitions (pause/resume/freeze/retire), and emergency freeze controls. Deployment pipeline, task execution, and approval workflows are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Agent List Layout
- Card grid layout, not data table
- Grouped by department with section headers (Sales, Support, Operations, etc.)
- Each card shows: agent name, status badge, template name, and model profile
- Quick actions available on each card via kebab menu or icon buttons (freeze, pause, etc.)

### Agent Detail Page
- Tabbed layout with 4 tabs: Overview, Config, Activity, Conversations
- Overview tab hero section: big status badge + lifecycle controls (pause/resume/freeze/retire buttons)
- Config tab: system prompt shown fully visible in a code/text block — no collapse
- Config tab shows which template the agent was created from with a link, plus highlights any config that differs from the template (diff view)
- Activity tab: recent actions log
- Conversations tab: chat history for this agent

### Freeze & Lifecycle Controls
- Freeze: red "Freeze" button with confirmation dialog ("This will immediately stop the agent and revoke tool access")
- Frozen agents appear greyed out with a distinct ice/frozen status badge across the entire UI
- Admin lifecycle transitions: pause (soft stop), resume, freeze (emergency), retire (permanent decommission)
- Retire requires type-to-confirm (type agent name) — prevents accidental permanent action
- Lifecycle statuses: provisioning, active, paused, frozen, error, retired

### Template Visibility
- Dedicated templates page listing all agent templates with system prompts, tool profiles, model configs
- Templates also visible on each agent's config tab (linked to template + diff)
- Agent config is editable per-agent — template is the starting point, not a hard constraint
- Templates page supports full CRUD — admin can create, edit, and delete templates from the UI

### Claude's Discretion
- Exact card sizing and grid responsive breakpoints
- Activity log entry format and pagination
- Conversations tab layout and message rendering
- Status badge color scheme (beyond frozen = greyed)
- Template diff presentation format

</decisions>

<specifics>
## Specific Ideas

- Frozen agents should feel visually "dead" — greyed out card with an ice-themed badge, clearly distinct from paused or error states
- Department grouping on the list page should make it easy to see agent distribution at a glance
- Type-to-confirm for retire mirrors the GitHub "delete repository" pattern — serious actions require intentional input

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-agent-management*
*Context gathered: 2026-03-25*
