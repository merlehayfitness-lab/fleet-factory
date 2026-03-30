---
status: diagnosed
trigger: "Tree renders as separate flat department sections stacked vertically. User wants a single unified org-chart with one root node (Owner/Admin) at the top, departments branching down from it, agents flowing under departments, and sub-agents further down."
created: 2026-03-29T00:00:00Z
updated: 2026-03-29T00:00:00Z
goal: find_root_cause_only
---

## Current Focus

hypothesis: confirmed - four independent causes found
test: complete code audit of all four files plus data model
expecting: root cause documented for plan-phase fix
next_action: return structured diagnosis

## Symptoms

expected: Single unified org-chart - one business root node at top, department nodes branching from it, lead agents under departments, sub-agents under leads - all connected by lines
actual: Four independent department sections stacked vertically with `space-y-8`. Each department is its own header with agents beneath it. No business-level root node. SVG lines only connect department headers to their direct agent children (and agent leads to sub-agents), with no cross-department connections.
errors: none - renders without errors, just wrong layout
reproduction: navigate to /businesses/[id]/agents
started: current implementation - never had unified tree

## Eliminated

- hypothesis: SVG line renderer is broken
  evidence: AgentTreeLines correctly draws bezier curves between any two registered node IDs. It is generic and would work correctly if given the right connections. The line-drawing logic itself is sound.
  timestamp: 2026-03-29

- hypothesis: sub-agent parent_agent_id linking is broken
  evidence: buildAgentTree correctly uses parent_agent_id to nest sub-agents under their lead. children are properly recursed. This part works.
  timestamp: 2026-03-29

## Evidence

- timestamp: 2026-03-29
  checked: apps/web/app/(dashboard)/businesses/[id]/agents/page.tsx data query
  found: Fetches agents with departments join. No concept of a "root" or "owner" business node. No special treatment for `type: 'owner'` department. All four departments treated identically.
  implication: There is no business-level root node in the data - the data model does not produce one.

- timestamp: 2026-03-29
  checked: packages/db/schema/006_agents.sql + 033_agent_role_hierarchy.sql
  found: agents table has `parent_agent_id uuid REFERENCES agents(id)`. No `is_root` flag, no `is_lead` flag, no `business_root` concept. An agent in the `owner` department with `parent_agent_id = null` is indistinguishable from a lead in the `sales` department with `parent_agent_id = null`.
  implication: The schema has no mechanism to nominate a single cross-department root. The owner department's lead agent is not flagged as the tree root.

- timestamp: 2026-03-29
  checked: apps/web/_components/agent-tree-view.tsx - buildAgentTree() function (lines 86-150)
  found: Groups agents by department_id, builds per-department TreeDepartment[] array. The data model output is `TreeDepartment[]` - a flat list of departments. There is no TreeRoot concept, no business node, no connection between departments.
  implication: The tree data structure itself is flat-by-department. No unified root node is ever constructed.

- timestamp: 2026-03-29
  checked: apps/web/_components/agent-tree-view.tsx - render (lines 462-541)
  found: `<div className="space-y-8">` wraps `{treeDepartments.map(...)}` - renders each TreeDepartment independently in vertical sequence. No root node rendered before the loop. No connections wired between a business root and department nodes.
  implication: The rendering is intentionally flat. Each department is a sibling, not a child of anything.

- timestamp: 2026-03-29
  checked: connections computation (lines 232-247 in agent-tree-view.tsx)
  found: connections array is built as `dept.id -> lead.id` and `lead.id -> child.id`. There is no `businessRoot.id -> dept.id` connection. The SVG layer never receives cross-department connections.
  implication: Even if a root node were rendered, the line layer would not draw lines from it to departments - those connections are never computed.

- timestamp: 2026-03-29
  checked: apps/web/_components/agent-tree-department.tsx
  found: Renders as a horizontal bar (`border-2 rounded-lg`) not as a tree node box. Style is `flex items-center gap-3 px-4 py-3` - a list row, not an org chart box node. `data-node-id` is set so it registers with the SVG layer correctly.
  implication: The visual shape of departments is wrong for an org chart. The mockup requires bordered rectangular boxes (like agent nodes) not full-width header bars.

- timestamp: 2026-03-29
  checked: apps/web/_components/agent-tree-node.tsx
  found: Renders as a rounded pill (`rounded-full border px-3 py-1.5`). The mockup reference describes "box nodes" with name, role, and icon - a different visual treatment.
  implication: The node shape (pill) does not match the target org-chart box style from the mockup.

## Resolution

root_cause: |
  Four distinct problems combine to produce flat department sections instead of a unified org chart:

  1. MISSING ROOT NODE - DATA MODEL
     There is no business-level root node concept in the data or the buildAgentTree() function.
     The `owner` department's lead agent is not flagged as a tree root. buildAgentTree() returns
     TreeDepartment[] with no wrapping root. The desired root (business owner/admin agent OR a
     synthetic "Business" node) does not exist anywhere in the data pipeline.

  2. MISSING ROOT-TO-DEPARTMENT CONNECTIONS - CONNECTIONS ARRAY
     The connections array in agent-tree-view.tsx (lines 232-247) only produces:
       dept.id -> lead.id
       lead.id -> child.id
     It never produces:
       businessRoot -> dept.id
     So the SVG line layer can never draw the connecting lines from root to departments,
     regardless of how the root is rendered.

  3. FLAT RENDER LOOP - LAYOUT STRUCTURE
     The desktop render (lines 475-529) does `treeDepartments.map()` inside `space-y-8`.
     This is a vertical list, not a tree layout. A unified org chart requires either:
     (a) CSS flexbox/grid with explicit horizontal+vertical positioning per level, or
     (b) A horizontal layout where departments spread across one row, each column
         containing its agents below.
     The current layout makes it structurally impossible to render departments on the
     same horizontal plane branching from a single root above them.

  4. WRONG NODE VISUAL SHAPE
     AgentTreeDepartment renders as a full-width header bar, not a box node.
     AgentTreeNode renders as a compact pill, not a box node.
     The target mockup shows bordered rectangular "cards" (box nodes with name + role + icon)
     at all levels of the tree, which requires redesigning both components.

fix: not applied - diagnosis only
verification: not applied
files_changed: []
