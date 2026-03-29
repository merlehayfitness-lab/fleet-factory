---
status: diagnosed
phase: 11-sub-agent-management
source: [11-01-SUMMARY.md, 11-02-SUMMARY.md]
started: 2026-03-29T17:50:00Z
updated: 2026-03-29T18:18:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Agent Tree Renders on Agents Page
expected: Navigate to a business's Agents page. Instead of a card list, you should see an org-chart style tree with departments as bold header bars and agents as compact pill nodes with colored status dots (green=active, amber=paused/frozen, red=error).
result: issue
reported: "Tree renders as separate flat department sections stacked vertically. User wants a single unified org-chart tree with one root node (Owner/Admin) at the top, departments branching down from it, and agents flowing under their departments — one connected tree for the whole org. Reference: dark terminal-style org chart with Owner at top, department leads as direct children, sub-agents flowing further down, box nodes showing name/role/icon, straight-line connectors."
severity: major

### 2. SVG Bezier Lines Connect Parent-Child Nodes
expected: On the agents page, smooth curved lines (bezier curves) visually connect lead agents to their sub-agents, creating a clear parent-child visual hierarchy.
result: issue
reported: "Hydration error from @dnd-kit/core: aria-describedby DndDescribedBy-0 vs DndDescribedBy-2 mismatch between server and client render. DnD hooks generate different IDs during SSR vs client hydration."
severity: major

### 3. Department Collapse/Expand
expected: Each department header has a chevron icon. Clicking it collapses the department, hiding all its agents. The department header shows an agent count badge when collapsed. Clicking again expands it back.
result: skipped
reason: Tree structure fundamentally wrong — needs unified org chart, not flat sections. Remaining tests skipped pending structural rework.

### 4. Lead Agent Collapse/Expand with Child Count
expected: Lead agents that have sub-agents show a chevron. Clicking it collapses the sub-agents. When collapsed, the lead pill shows a child count badge (e.g., "(2)"). Clicking again expands them back.
result: skipped
reason: Skipped pending structural rework.

### 5. '+' Button on Department Creates Lead Agent
expected: Hovering a department header reveals a '+' button. Clicking it navigates to the new agent wizard page with the department pre-selected in the URL (e.g., ?departmentId=...).
result: skipped
reason: Skipped pending structural rework.

### 6. '+' Button on Lead Agent Creates Sub-Agent
expected: Hovering a lead agent pill reveals a '+' button. Clicking it navigates to the new agent wizard with both the department and parent agent pre-filled in the URL (e.g., ?departmentId=...&parentAgentId=...).
result: skipped
reason: Skipped pending structural rework.

### 7. Agent Sidebar Opens on Click
expected: Clicking an agent pill opens a right sidebar panel showing the agent's name, status with colored indicator, role, model friendly name, and skill count.
result: skipped
reason: Skipped pending structural rework.

### 8. Sidebar Lifecycle Controls
expected: The sidebar footer shows lifecycle action buttons based on current status. Active agents show Pause and Freeze buttons. Paused agents show Resume and Freeze. Frozen agents show Resume. There's also an Edit button that navigates to the agent detail page.
result: skipped
reason: Skipped pending structural rework.

### 9. Sidebar Closes on Escape and Backdrop
expected: Pressing Escape closes the sidebar. Clicking the dark backdrop area behind the sidebar also closes it.
result: skipped
reason: Skipped pending structural rework.

### 10. Drag-and-Drop Reparenting
expected: You can drag an agent pill (cursor changes to grab). Dragging over a department header or lead agent highlights it with a blue ring. Dropping shows a confirmation toast with Confirm/Cancel. Confirming moves the agent to the new location.
result: skipped
reason: Skipped pending structural rework.

## Summary

total: 10
passed: 0
issues: 2
pending: 0
skipped: 8

## Gaps

- truth: "Tree renders as a single unified org-chart with Owner/Admin root node at top, departments branching down, agents flowing under departments — one connected tree"
  status: failed
  reason: "User reported: Tree renders as separate flat department sections stacked vertically. User wants unified org-chart with Owner root node, departments as children, agents flowing down. Reference mockup: dark terminal-style with box nodes (name, role, icon), straight-line connectors, multiple depth levels."
  severity: major
  test: 1
  root_cause: "4 compounding issues: (1) buildAgentTree() produces flat TreeDepartment[] with no root node concept — owner dept lead is structurally identical to any other lead; (2) connections array never wires root-to-department links; (3) layout is space-y-8 vertical list instead of centered-root horizontal tree; (4) node visuals are pills/bars instead of consistent box cards matching org chart style"
  artifacts:
    - path: "apps/web/_components/agent-tree-view.tsx"
      issue: "buildAgentTree() returns flat department list, not rooted tree; layout is vertical stack; connections missing root-to-dept"
    - path: "apps/web/_components/agent-tree-department.tsx"
      issue: "Full-width header bar instead of box node"
    - path: "apps/web/_components/agent-tree-node.tsx"
      issue: "Compact pill instead of box node with name/role/icon"
    - path: "apps/web/_components/agent-tree-lines.tsx"
      issue: "Bezier curves need to become elbow/step connectors for horizontal org chart"
  missing:
    - "Root node concept — designate owner dept lead as tree root or create synthetic business root"
    - "Horizontal layout with root centered at top, departments in a row beneath"
    - "Consistent box-style node component for all levels"
    - "Elbow/step connector lines instead of bezier curves"
  debug_session: ".planning/debug/flat-tree-no-root-node.md"

- truth: "No hydration errors on page load — DnD hooks produce consistent IDs between server and client"
  status: failed
  reason: "User reported: Hydration error from @dnd-kit/core — aria-describedby DndDescribedBy-0 vs DndDescribedBy-2 mismatch. useDraggable generates non-deterministic IDs during SSR."
  severity: major
  test: 2
  root_cause: "@dnd-kit/core uses module-level auto-incrementing counter for DndDescribedBy IDs. SSR starts at 0, client starts at 2 (React 18 StrictMode double-invokes setup). DndContext renders on server because isMobile defaults to false. Fix: dynamic() import with ssr:false for the desktop DnD tree."
  artifacts:
    - path: "apps/web/_components/agent-tree-view.tsx"
      issue: "DndContext renders during SSR because isMobile defaults to false; no ssr:false guard"
    - path: "apps/web/_components/agent-tree-node.tsx"
      issue: "useDraggable spreads {...attributes} with mismatched aria-describedby"
    - path: "apps/web/_components/agent-tree-department.tsx"
      issue: "useDroppable runs on server, incrementing counter"
  missing:
    - "Extract desktop DnD tree into separate component, import via next/dynamic with ssr:false"
  debug_session: ".planning/debug/dnd-kit-hydration-mismatch.md"
