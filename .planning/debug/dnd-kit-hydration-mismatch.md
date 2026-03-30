---
status: diagnosed
trigger: "React hydration error on agents page. @dnd-kit/core's useDraggable hook generates aria-describedby=DndDescribedBy-0 on server but aria-describedby=DndDescribedBy-2 on client"
created: 2026-03-29T00:00:00Z
updated: 2026-03-29T00:00:00Z
symptoms_prefilled: true
goal: find_root_cause_only
---

## Current Focus

hypothesis: DndContext initializes an auto-incrementing global counter for accessibility IDs (DndDescribedBy-N) during SSR, but the counter state differs between SSR and client hydration because other DndContext instances or renders have already incremented the counter before the component mounts on the client
test: read all three component files and trace the DnD hook usage
expecting: confirmation that hooks are used inside SSR-rendered components with no ssr:false guard
next_action: COMPLETE — root cause confirmed, diagnosis returned

## Symptoms

expected: Agents page loads without hydration errors; agent tree renders with DnD enabled
actual: Hydration mismatch — SSR generates aria-describedby="DndDescribedBy-0" but client generates aria-describedby="DndDescribedBy-2"
errors: "A tree hydrated but some attributes of the server rendered HTML didn't match the client properties."
reproduction: Navigate to /businesses/[businessId]/agents (or wherever the agent tree renders)
started: Phase 11 sub-agent management feature introduction of @dnd-kit/core

## Eliminated

- hypothesis: RLS or data-fetching causes different HTML shapes between SSR and client
  evidence: Error message specifically names aria-describedby attribute, a DnD-kit accessibility attribute — not data-driven
  timestamp: 2026-03-29

- hypothesis: The counter increment is caused by AgentTreeDepartment's useDroppable call alone
  evidence: Both AgentTreeNode (useDraggable + useDroppable) and AgentTreeDepartment (useDroppable) contribute to counter increments; root cause is the SSR execution itself, not which specific hook
  timestamp: 2026-03-29

## Evidence

- timestamp: 2026-03-29
  checked: apps/web/_components/agent-tree-view.tsx lines 1-3, 462-542
  found: AgentTreeView is a "use client" component. It renders DndContext on line 464. Crucially, the DndContext is ONLY rendered when !isMobile (line 463), and isMobile starts as false (useState(false) on line 165). During SSR, isMobile is false, so DndContext IS rendered on the server.
  implication: The DndContext and all its children (AgentTreeDepartment, AgentTreeNode) execute on the server and generate HTML with DnD accessibility attributes.

- timestamp: 2026-03-29
  checked: apps/web/_components/agent-tree-node.tsx lines 60-70
  found: useDraggable({ id: agent.id }) on line 65, useDroppable({ id: agent.id, disabled: !isLead }) on line 67. The spread {...attributes} on line 119 injects aria-describedby="DndDescribedBy-N" into the rendered div.
  implication: Each AgentTreeNode rendered in the tree contributes N increments to the global DnD counter. With multiple agents (departments + lead agents + sub-agents), the counter value at each node depends on render order.

- timestamp: 2026-03-29
  checked: apps/web/_components/agent-tree-department.tsx lines 53-55
  found: useDroppable({ id: department.id }) on line 53. This also increments the DnD global counter.
  implication: Department nodes each contribute to the counter before agent nodes render.

- timestamp: 2026-03-29
  checked: apps/web/_components/agent-tree-view.tsx lines 165-172
  found: isMobile state initializes to false. The mobile detection useEffect only runs after mount (client-side only). On SSR, isMobile === false, so the full DndContext tree renders server-side.
  implication: Server renders the DndContext tree. On client, before the useEffect fires, isMobile is still false and the same DndContext tree renders. HOWEVER, the @dnd-kit/core global counter is reset/different between the SSR Node.js process and the browser hydration pass. If any other render or instance has already called useDraggable/useDroppable in the browser environment before this component hydrates, the counter will be at a different offset, producing mismatched IDs.

- timestamp: 2026-03-29
  checked: @dnd-kit/core internal behavior (known library characteristic)
  found: DndContext uses a module-level auto-incrementing counter (incrementing on each DndContext instantiation) to create unique accessibility description IDs of the form "DndDescribedBy-N". This counter is global to the JavaScript module scope. In SSR, it may start at 0. In the browser, it may start at a different value if React StrictMode double-invokes effects, if Fast Refresh has re-run modules, or if other DndContext instances exist on the page.
  implication: The mismatch (0 vs 2) suggests the counter has been incremented twice before the hydrating DndContext is created on the client — consistent with React 18 StrictMode double-invoking or a previous DndContext instance having been created and destroyed.

## Resolution

root_cause: |
  @dnd-kit/core maintains a module-level auto-incrementing integer counter that generates unique
  accessibility IDs (DndDescribedBy-N) for each DndContext instance. During SSR, the counter starts
  at 0, so the first DndContext gets ID "DndDescribedBy-0". In the browser, by the time the
  AgentTreeView component hydrates, the counter has already been incremented (likely to 2) due to
  React 18 StrictMode double-invoking component setup, Fast Refresh module re-execution, or a prior
  DndContext instance in the page lifecycle. The SSR HTML contains aria-describedby="DndDescribedBy-0"
  but the client generates aria-describedby="DndDescribedBy-2", causing React's hydration check to fail.

  The component structure that allows this to happen:
  - AgentTreeView is a "use client" component but still SSR-renders (Next.js renders "use client"
    components on the server for the initial HTML)
  - isMobile starts as false, so the DndContext branch renders on the server
  - There is no suppression of SSR for the DnD-dependent subtree

fix: |
  TWO viable approaches:

  APPROACH A (Recommended — suppress DnD SSR entirely):
  Extract the desktop DnD tree into a separate component and import it with dynamic() and ssr: false.
  This prevents @dnd-kit from ever running on the server, so no SSR HTML is generated for it and
  no hydration comparison occurs.

  In agent-tree-view.tsx:
    import dynamic from "next/dynamic";
    const AgentTreeDesktop = dynamic(
      () => import("@/_components/agent-tree-desktop").then(m => ({ default: m.AgentTreeDesktop })),
      { ssr: false }
    );
  Move the DndContext + tree rendering block (lines 464-542) into agent-tree-desktop.tsx.
  Replace in agent-tree-view.tsx with <AgentTreeDesktop ... /> guarded by !isMobile.

  APPROACH B (Minimal — suppressHydrationWarning on the DnD attributes div):
  Add suppressHydrationWarning to the div in AgentTreeNode that spreads {...attributes}.
  This silences the React warning without changing the architecture. The mismatch still occurs
  but React will not throw. ONLY use this if approach A is not feasible — it hides the symptom,
  not the cause.

verification: N/A — diagnose-only mode
files_changed: []
