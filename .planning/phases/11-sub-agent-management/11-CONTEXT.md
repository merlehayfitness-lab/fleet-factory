# Phase 11: Sub-Agent Management - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the current card-based agents list with a unified visual hierarchy tree showing the full business agent structure: business root > departments > lead agents > sub-agents. Includes connecting lines, inline panel, drag-to-reparent, collapsible sections, and '+' buttons for creating agents at any level. Schema and core services already exist from Phase 8 (parent_agent_id, role columns, getChildAgents, getParentAgent).

</domain>

<decisions>
## Implementation Decisions

### Tree visual style
- Vertical (top-down) org chart orientation — lead at top, sub-agents below
- Curved/bezier connecting lines between parent and children — modern, soft feel
- Single unified tree rooted at the business level, with departments as first-level branches
- Replaces the current agents list entirely (no toggle between list/tree — tree IS the agents page)

### Node content & density
- Compact pill/badge nodes for agents — just name + status dot
- Departments rendered as distinct header nodes — larger, visually different from agent pills (bold/distinct style)
- Status indicator: colored dot (green=active, yellow=frozen, red=error) — Slack presence style
- Clicking a node opens a right sidebar panel (not a popover, not below the node)

### Interaction & controls
- '+' button on department headers creates a new lead agent (opens wizard pre-filled with department)
- '+' button on lead agent nodes creates a sub-agent (opens wizard pre-filled with parent)
- Drag-and-drop to reparent agents — drag a node onto another to change its parent
- Right sidebar panel shows: name, role, status, model, skill count + action buttons (Freeze, Edit, Details link to full detail page)

### Collapsible sections
- Departments and lead agents are collapsible (two levels of collapse)
- Default state: fully expanded on first load
- Collapsed nodes show badge count of hidden children (e.g., "SALES (3) >")
- Collapse state persists in localStorage across page navigation

### Claude's Discretion
- Exact bezier curve implementation (SVG vs CSS)
- Tree layout algorithm / spacing calculations
- Drag-and-drop library choice
- Sidebar panel animation style
- How the business root node looks (or whether it's implied)
- Mobile/responsive behavior of the tree

</decisions>

<specifics>
## Specific Ideas

- Department nodes should feel like headers (bold, outlined/double-border style) while agent nodes are compact pills — clear visual hierarchy between the two
- Status dots should match Slack presence indicators (green/yellow/red circles)
- The right sidebar is the primary way to interact with an agent — clicking the pill opens it, clicking "Details" navigates to the full detail page
- The '+' buttons should be discoverable but not cluttering — appear on hover or as subtle icons

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-sub-agent-management*
*Context gathered: 2026-03-29*
