# Phase 11: Sub-Agent Management -- Research

**Researched:** 2026-03-29
**Phase Goal:** Replace the current card-based agents list with a unified visual hierarchy tree showing the full business agent structure: business root > departments > lead agents > sub-agents. Includes connecting lines, right sidebar panel, drag-to-reparent, collapsible sections, and '+' buttons for creating agents at any level.

## 1. Existing Code That Must Change

### Agents List Page (`apps/web/app/(dashboard)/businesses/[id]/agents/page.tsx`)

Currently a Server Component that fetches agents with department/template joins plus skill assignment counts, then renders the `AgentsList` component inside a standard page layout with a "New Agent" button. Phase 11 replaces the entire page content: the `AgentsList` component is replaced with the new `AgentTreeView` component. The page query must also fetch departments separately (for department header nodes in the tree), and continue to include skill counts. The "New Agent" button in the page header may be removed since '+' buttons on nodes serve that purpose, or kept as a fallback.

### Agents List Component (`apps/web/_components/agents-list.tsx`)

Currently renders agents grouped by department in a card grid layout with lead/sub-agent hierarchy via `border-l-2` indentation. This component is **entirely replaced** by the new tree visualization. The existing grouping logic (DEPARTMENT_ORDER, lead/sub separation, subsByParent map) is useful reference for the tree data transformation but the rendering output changes completely -- from card grid to an org-chart tree with SVG connecting lines and compact pill nodes.

### Agent Card Component (`apps/web/_components/agent-card.tsx`)

Currently a full Card component with status badge, template info, model display, skill count, kebab menu with lifecycle controls, and freeze/retire dialogs. Phase 11 replaces this with compact pill/badge nodes in the tree. The card's kebab menu functionality moves into the right sidebar panel instead. The existing `AgentCard` component itself remains available for use in other contexts (e.g., the agent detail page) but is no longer used on the agents list page.

### Agent Setup Wizard (`apps/web/_components/agent-setup-wizard.tsx`)

Currently handles new agent creation via a 5-step wizard (Basic Info -> Knowledge -> Role Definition -> Prompt Generation -> Review). The wizard already supports sub-agent creation: it detects `hasLead` on departments and auto-assigns `parent_agent_id` via `createProvisionalAgentAction`. Phase 11 adds new entry points to this wizard: '+' buttons on department nodes (pre-fill department, create as lead) and '+' buttons on agent nodes (pre-fill department + parent, create as sub-agent). The wizard itself does not need structural changes -- only the navigation to it changes. Query parameter pre-filling (e.g., `?departmentId=xxx&parentAgentId=yyy`) is the simplest approach.

### Wizard Basic Info Step (`apps/web/_components/wizard-basic-info-step.tsx`)

Currently collects agent name, department (via native select), and role. Shows a blue info banner when the selected department already has a lead. Phase 11 may need to read query parameters to pre-fill department and parent context, but the component itself needs minimal changes -- the parent already handles state injection.

### New Agent Page (`apps/web/app/(dashboard)/businesses/[id]/agents/new/page.tsx`)

Currently a Server Component that fetches business details, departments with agent counts, and integrations. Must be updated to read URL search params (departmentId, parentAgentId) and pass them to the wizard as initial values.

### Agent Service (`packages/core/agent/service.ts`)

Already has `getChildAgents()`, `getParentAgent()`, and `updateAgentConfig()` with `parent_agent_id` support. Phase 11 needs a new `reparentAgent()` function for drag-and-drop reparenting that validates the move (no circular references, same business, same department for sub-agents) and updates `parent_agent_id`.

### Agent Detail Page Header (`apps/web/app/(dashboard)/businesses/[id]/agents/[agentId]/page.tsx`)

Currently shows "Sub-agent of {parent}" link for sub-agents. No changes needed -- this page is not affected by the tree view. Users navigate here from the tree sidebar panel's "Details" link.

### Agent Overview (`apps/web/_components/agent-overview.tsx`)

Currently shows "Reports To" card for sub-agents and "Sub-Agents" card with list for lead agents. No changes needed -- this remains the detail view accessed from the tree sidebar.

## 2. New Database Schema

### No New Tables Required

The database schema already has everything needed for sub-agent hierarchy:

- `agents.parent_agent_id` (uuid, nullable, FK to agents.id, ON DELETE SET NULL) -- added in migration 033
- `agents.role` (text, nullable) -- added in migration 033
- `idx_agents_parent_agent_id` index -- added in migration 033
- Departments table has `id`, `name`, `type`, `business_id`

The hierarchy is: departments -> lead agents (parent_agent_id IS NULL) -> sub-agents (parent_agent_id IS NOT NULL).

### No Migration Needed

All required columns and indexes exist from Phase 8 (migration 033_agent_role_hierarchy.sql). The tree visualization is purely a UI concern -- no schema changes are necessary.

## 3. New Dependencies Required

### Drag-and-Drop Library

The CONTEXT specifies drag-and-drop to reparent agents. Options:

**Option A: @dnd-kit/core + @dnd-kit/sortable** (recommended)
- Purpose-built for React, accessible, lightweight (~30KB gzipped)
- Supports custom drag overlays, collision detection strategies
- Well-maintained, actively used in production
- Works with any DOM structure (not just lists)
- Keyboard accessibility built-in

**Option B: react-dnd**
- Older, larger, more complex API
- HTML5 backend + touch backend needed separately
- Heavier bundle

**Option C: Native HTML5 drag-and-drop**
- No dependency
- Janky UX, no touch support, limited styling during drag
- Harder to implement accessible interactions

**Recommendation:** `@dnd-kit/core` -- it provides the most flexible API for tree-based drag interactions without the overhead of react-dnd. Only `@dnd-kit/core` is needed (not sortable, since we're doing reparent-drop, not reordering).

### No Other Dependencies

- SVG/CSS for bezier connecting lines -- no library needed, hand-drawn SVG paths or CSS pseudo-elements
- Collapsible sections -- existing `Collapsible` component from shadcn/ui available
- localStorage persistence -- native browser API
- Right sidebar panel -- existing fixed-position pattern from Phase 4 (slide-over panel)

## 4. Architecture Decisions

### Tree Data Model

The tree has 3 levels:

```
Business (implicit root, not rendered as node per CONTEXT discretion)
  |
  +-- Department (header nodes -- bold, distinct style)
  |     |
  |     +-- Lead Agent (compact pill, parent_agent_id IS NULL)
  |     |     |
  |     |     +-- Sub-Agent 1 (compact pill, parent_agent_id = lead.id)
  |     |     +-- Sub-Agent 2
  |     |
  |     +-- Lead Agent 2 (second lead in same department)
  |           |
  |           +-- Sub-Agent 3
  |
  +-- Department 2
        |
        +-- Lead Agent 3
```

Data transformation function:

```typescript
interface TreeDepartment {
  id: string;
  name: string;
  type: string;
  isCollapsed: boolean;
  leads: TreeAgent[];
}

interface TreeAgent {
  id: string;
  name: string;
  status: string;
  role: string | null;
  skillCount: number;
  modelId: string | null;
  isCollapsed: boolean; // for lead agents with children
  children: TreeAgent[];
}

function buildAgentTree(
  departments: Department[],
  agents: Agent[],
  collapseState: Record<string, boolean>,
): TreeDepartment[]
```

### Connecting Lines (SVG Bezier Curves)

Per CONTEXT: "Curved/bezier connecting lines between parent and children -- modern, soft feel."

Implementation approach: Use an absolutely-positioned SVG overlay on top of the tree layout, with bezier paths calculated from DOM node positions via `getBoundingClientRect()`.

Steps:
1. Render tree nodes with React refs or data attributes for position tracking
2. After layout, use `useLayoutEffect` to measure node positions
3. Draw SVG `<path>` elements using cubic bezier curves (`M x1,y1 C cx1,cy1 cx2,cy2 x2,y2`)
4. Recalculate on collapse/expand and window resize

The SVG layer sits behind the nodes (via z-index) so nodes remain interactive.

Alternative: CSS-only approach using `::before`/`::after` pseudo-elements with borders. This is simpler but cannot produce smooth bezier curves -- only right-angle connectors. Given the CONTEXT explicitly requests bezier/curved lines, SVG is the correct approach.

### Node Design

**Department nodes (header style):**
- Larger, bold text
- Distinct background/border (e.g., double-border or heavier outline)
- Agent count badge (e.g., "SALES (3)")
- Collapse/expand chevron
- '+' button for creating a new lead agent

**Agent nodes (compact pill style):**
- Name + status dot (Slack presence style: green=active, yellow=paused/frozen, red=error/retired)
- Compact horizontal pill shape
- For leads: collapse chevron (if has children) + '+' button for sub-agent
- Click to open right sidebar panel

### Right Sidebar Panel

Per CONTEXT: "Clicking a node opens a right sidebar panel (not a popover, not below the node)."

Panel shows:
- Agent name and role
- Status with colored indicator
- Model (friendly name)
- Skill count
- Action buttons: Freeze, Edit (opens config), Details (navigates to full detail page)
- Lifecycle controls (Pause/Resume/Freeze/Retire) based on valid transitions

Implementation: Fixed-position panel on the right side of the page (matches Phase 4 slide-over pattern). Opens on agent node click, closes on clicking outside or pressing Escape.

For department nodes: clicking opens a simpler panel showing department name, type, agent count, and a "View Agents" summary.

### Drag-and-Drop Reparenting

Per CONTEXT: "Drag-and-drop to reparent agents -- drag a node onto another to change its parent."

Rules:
1. Only agent nodes are draggable (not department headers)
2. Valid drop targets: lead agents (to become a sub-agent), department headers (to become a lead agent in that department)
3. Validation: cannot drop onto self, cannot create circular references (sub-agent of own child), must stay within same business
4. Moving a lead agent with children: children come along (they keep their parent relationship)
5. Moving a sub-agent to a different department: updates both `department_id` and `parent_agent_id`

Server action: `reparentAgentAction(agentId, businessId, newParentAgentId, newDepartmentId)` -- validates and updates in a single call.

### Collapse State Persistence

Per CONTEXT: "Collapse state persists in localStorage across page navigation."

Key format: `agent-tree-collapse-${businessId}`
Value: JSON object mapping node IDs to boolean (collapsed=true).

```typescript
const STORAGE_KEY = `agent-tree-collapse-${businessId}`;

function loadCollapseState(): Record<string, boolean> {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : {};
}

function saveCollapseState(state: Record<string, boolean>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
```

Default state: fully expanded on first load.

### '+' Button Behavior

Per CONTEXT: "'+' button on department headers creates a new lead agent (opens wizard pre-filled with department). '+' button on lead agent nodes creates a sub-agent (opens wizard pre-filled with parent)."

Implementation: Navigate to `/businesses/${businessId}/agents/new?departmentId=${deptId}` for department '+' and `/businesses/${businessId}/agents/new?departmentId=${deptId}&parentAgentId=${agentId}` for agent '+'.

The wizard page reads these search params and passes them as initial values.

### Tree Layout Algorithm

Vertical top-down layout with departments as top-level rows:

```
Department Header
  |
  +--[Agent Pill]--+--[Agent Pill]
                   |
              +----+----+
              |         |
         [Sub Pill] [Sub Pill]
```

Each department occupies a full-width horizontal band. Lead agents within a department are arranged horizontally. Sub-agents are arranged horizontally below their parent with bezier lines connecting them.

Layout calculation:
1. Fixed horizontal spacing between sibling nodes (e.g., 180px)
2. Fixed vertical spacing between levels (e.g., 80px)
3. Center parent over its children
4. Department header spans full width at the top of its section

For MVP, a simple recursive layout calculation is sufficient. Complex tree layout libraries (dagre, elkjs) are overkill for this 3-level structure.

### Mobile/Responsive Behavior

Per CONTEXT Claude's Discretion: "Mobile/responsive behavior of the tree."

- On small screens (< 768px): switch to a vertical list/accordion view instead of the tree
- Each department becomes a collapsible accordion section
- Lead agents listed with sub-agents indented below
- No bezier lines on mobile -- use left-border indent (similar to current agents-list.tsx)
- Right sidebar becomes a bottom sheet or full-screen overlay
- Drag-and-drop disabled on mobile (tap to select, then use a "Move to..." action instead)

## 5. File Impact Analysis

### New Files (estimated ~8-10)

**`apps/web/_components/`** (new components):
- `agent-tree-view.tsx` -- Main tree container component with SVG overlay, collapse state, and drag-drop context provider
- `agent-tree-node.tsx` -- Individual agent pill node (status dot, name, collapse chevron, '+' button)
- `agent-tree-department.tsx` -- Department header node (bold style, count badge, collapse chevron, '+' button)
- `agent-tree-sidebar.tsx` -- Right sidebar panel for selected node (agent details, actions, lifecycle controls)
- `agent-tree-lines.tsx` -- SVG bezier line renderer (calculates and draws connecting paths)

**`packages/core/agent/`** (service extensions):
- No new files -- `reparentAgent` function added to existing `service.ts`

**`apps/web/_actions/`** (server actions):
- No new files -- `reparentAgentAction` added to existing `agent-actions.ts`

### Modified Files (estimated ~5-6)

- `apps/web/app/(dashboard)/businesses/[id]/agents/page.tsx` -- Replace AgentsList with AgentTreeView, fetch departments separately
- `apps/web/app/(dashboard)/businesses/[id]/agents/new/page.tsx` -- Read search params (departmentId, parentAgentId) and pass to wizard
- `apps/web/_components/agent-setup-wizard.tsx` -- Accept optional initial departmentId and parentAgentId props
- `apps/web/_actions/agent-actions.ts` -- Add reparentAgentAction
- `packages/core/agent/service.ts` -- Add reparentAgent function with validation
- `packages/core/index.ts` -- Export reparentAgent (if needed client-side, or keep server-only)

### Unchanged Files

- `apps/web/_components/agent-card.tsx` -- Kept for other contexts but not used in tree view
- `apps/web/_components/agent-detail-tabs.tsx` -- No changes
- `apps/web/_components/agent-overview.tsx` -- No changes (Reports To / Sub-Agents cards remain)
- `apps/web/_components/sidebar-nav.tsx` -- No changes (Agents link already exists)
- Database schema -- No migrations needed
- Deployment pipeline -- No changes

## 6. Plan Breakdown Strategy

### Plan 11-01: Tree Data Model, Reparent Service, and Layout Foundation
**Scope:** Backend service + core tree rendering without interactivity
- Add `reparentAgent()` to agent service with validation (circular ref check, same business, department consistency)
- Add `reparentAgentAction` server action in agent-actions.ts
- Create `agent-tree-view.tsx` -- tree container with data transformation (buildAgentTree)
- Create `agent-tree-department.tsx` -- department header nodes
- Create `agent-tree-node.tsx` -- agent pill nodes with status dots
- Create `agent-tree-lines.tsx` -- SVG bezier curve connector
- Update agents page to render tree instead of AgentsList
- Collapse/expand with localStorage persistence
- Static '+' buttons on department and agent nodes (navigation to wizard with pre-filled params)
- Update new agent page to read search params

**Requirements covered:** SUBAG-01 (backend reparent), SUBAG-02 (tree visualization), SUBAG-03 (hierarchy grouping with collapsible)

**Files ~10-12**

### Plan 11-02: Right Sidebar Panel, Drag-and-Drop, and Responsive Behavior
**Scope:** Interactive features for the tree
- Install `@dnd-kit/core` dependency
- Create `agent-tree-sidebar.tsx` -- right sidebar panel with agent details, lifecycle controls, action buttons
- Integrate drag-and-drop on agent nodes with @dnd-kit/core
- Drop target highlighting on valid targets (lead agents, department headers)
- Reparent confirmation dialog before committing
- Responsive/mobile fallback (accordion list on small screens)
- Polish: drag overlay, animations, loading states

**Requirements covered:** SUBAG-01 (creation via '+' buttons), SUBAG-02 (interactive tree), SUBAG-03 (collapsible + sidebar)

**Files ~6-8**

## 7. Requirement Coverage

| Requirement | Covered By | Implementation |
|-------------|-----------|----------------|
| SUBAG-01 | Plan 11-01 + 11-02 | Sub-agents created via '+' buttons on lead agent nodes (pre-fills wizard with parentAgentId). Reparent via drag-and-drop. `reparentAgent` service validates and updates parent_agent_id. Role field already exists on agents from Phase 8. |
| SUBAG-02 | Plan 11-01 | Vertical org-chart tree with departments as header nodes, agents as compact pills, and SVG bezier connecting lines. Departments and leads are collapsible with badge counts. Collapse state persists in localStorage. |
| SUBAG-03 | Plan 11-01 + 11-02 | Tree IS the agents page (replaces card grid). Each department is a collapsible section with lead agents and their sub-agents rendered in hierarchy. Right sidebar panel shows agent details on click. Detail page retains "Reports To" and "Sub-Agents" cards from Phase 8. |

All 3 requirements covered across 2 plans.

## 8. Technical Considerations

### SVG Line Rendering Performance

The SVG overlay needs to recalculate line positions when:
- Nodes collapse/expand (layout changes)
- Window resizes
- Drag-and-drop in progress (temporary lines)

Strategy: Use `ResizeObserver` on the tree container and `useLayoutEffect` after state changes. Debounce resize recalculations (100ms). For a typical business with 4 departments and 8-16 agents, the number of lines is small (< 20) -- no performance concern.

### Circular Reference Prevention

When reparenting via drag-and-drop, the service must prevent:
1. An agent becoming its own parent
2. An agent becoming a child of one of its descendants (circular loop)

Validation algorithm:
```typescript
function wouldCreateCycle(
  agentId: string,
  newParentId: string,
  agents: Map<string, { parentAgentId: string | null }>,
): boolean {
  let current = newParentId;
  while (current) {
    if (current === agentId) return true;
    current = agents.get(current)?.parentAgentId ?? null;
  }
  return false;
}
```

Since the hierarchy is max 2 levels deep (lead -> sub-agent), cycles are inherently limited. But the check is still necessary for correctness.

### Department Consistency on Reparent

When dragging a sub-agent to a different lead agent:
- If the target lead is in a different department, the sub-agent's `department_id` must also update
- This ensures the sub-agent's department matches its parent's department
- The reparent service handles this atomically (update both `parent_agent_id` and `department_id`)

When dragging an agent to a department header (making it a lead):
- Set `parent_agent_id = null` and `department_id = target department`
- If the agent had children (was a lead), those children either: follow their parent to the new department, or stay in the old department with no parent. Per CONTEXT: children follow the parent (preserves hierarchy).

### Template-ID Constraint

The `agents.template_id` column was made nullable in migration 035 to support wizard-created agents. This means agents created via the wizard (with '+' buttons) work without needing a template. No constraint issues.

### Existing Agent Wizard Integration

The wizard already handles sub-agent creation:
1. `createProvisionalAgentAction` accepts `parentAgentId` parameter
2. Auto-detects lead agent if not explicitly provided
3. WizardBasicInfoStep shows blue banner when department has a lead

The '+' button integration only needs to pass URL search params. The wizard page reads them and injects into the wizard state. No changes to the wizard steps themselves.

### Collision Detection for Drag-and-Drop

@dnd-kit provides multiple collision detection strategies:
- `rectIntersection` (default) -- checks if dragged item overlaps target
- `closestCenter` -- finds nearest target by center point
- `closestCorners` -- finds nearest by corners
- `pointerWithin` -- checks if pointer is inside target

For tree reparenting, `closestCenter` is the best choice: it allows dropping near a node even if the overlap isn't perfect. Combined with visual feedback (target node highlights on hover), this provides good UX.

### Accessibility

The tree must be keyboard-navigable:
- Arrow keys to navigate between nodes (up/down/left/right)
- Enter to select/open sidebar
- Space to collapse/expand
- The '+' buttons are focusable
- Drag-and-drop has keyboard alternative: select node, then use a "Move to..." dropdown

@dnd-kit provides built-in keyboard support for drag operations, which is one of its advantages over native HTML5 drag-and-drop.

## 9. Risk Assessment

### Low Risk
- **No schema changes** -- All data model support exists from Phase 8. No migrations, no RLS changes.
- **Agents page replacement** -- The old AgentsList component is self-contained. Replacing it with the tree view is clean substitution.
- **Reparent service** -- Simple update of `parent_agent_id` and `department_id` with standard validation.
- **localStorage collapse state** -- Trivial client-side storage with no server round-trips.
- **Wizard pre-fill via search params** -- Well-established Next.js pattern.

### Medium Risk
- **SVG bezier line rendering** -- Requires DOM measurement after layout, which can be tricky with React's rendering lifecycle. Mitigate: Use `useLayoutEffect` for synchronous measurement, debounce for performance, and fall back to simple lines if measurement fails.
- **Drag-and-drop with @dnd-kit** -- New dependency. The tree layout is not a standard list, so custom collision detection and drop targets are needed. Mitigate: Start with basic drop-on-node (no sortable ordering), add polish iteratively.
- **Responsive fallback** -- The tree layout doesn't work on small screens. Mitigate: Detect screen size and render a simpler accordion list on mobile, reusing existing patterns.

### No High Risks
This phase is primarily a frontend visualization change with minimal backend impact. The data model is already complete. The worst case for the SVG/drag-and-drop features is that they degrade gracefully to simpler interactions (list view, move-to dropdown instead of drag).

## RESEARCH COMPLETE
