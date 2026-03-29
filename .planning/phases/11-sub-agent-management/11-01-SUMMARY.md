---
phase: 11-sub-agent-management
plan: 01
subsystem: ui
tags: [tree-view, svg, agent-hierarchy, reparent, collapsible, localStorage]

# Dependency graph
requires:
  - phase: 08-agent-creation-wizard
    provides: "AgentSetupWizard with provisional agent creation flow"
  - phase: 02-agent-management
    provides: "Agent service with lifecycle transitions and config updates"
provides:
  - "reparentAgent service with circular reference validation and child migration"
  - "reparentAgentAction server action for drag-and-drop reparenting"
  - "AgentTreeView org-chart visualization with collapsible departments and agents"
  - "AgentTreeDepartment bold header nodes with count badges and '+' buttons"
  - "AgentTreeNode compact pill nodes with Slack-style status dots"
  - "AgentTreeLines SVG bezier curve connectors"
  - "Search param pre-fill for wizard from tree '+' buttons"
affects: [11-sub-agent-management, agent-detail, deployment]

# Tech tracking
tech-stack:
  added: []
  patterns: [SVG bezier curves for tree connectors, localStorage collapse persistence, ResizeObserver for dynamic layout]

key-files:
  created:
    - apps/web/_components/agent-tree-view.tsx
    - apps/web/_components/agent-tree-department.tsx
    - apps/web/_components/agent-tree-node.tsx
    - apps/web/_components/agent-tree-lines.tsx
  modified:
    - packages/core/agent/service.ts
    - packages/core/server.ts
    - apps/web/_actions/agent-actions.ts
    - apps/web/app/(dashboard)/businesses/[id]/agents/page.tsx
    - apps/web/app/(dashboard)/businesses/[id]/agents/new/page.tsx
    - apps/web/_components/agent-setup-wizard.tsx

key-decisions:
  - "Explicit type cast on Supabase query result in wouldCreateCycle to avoid TS7022 self-referential type inference"
  - "Agent pill click navigates to agent detail page (router.push) rather than sidebar panel (deferred to 11-02)"
  - "Empty departments still render as header nodes with '+' button for creating first agent"

patterns-established:
  - "SVG bezier overlay: absolute-positioned SVG with pointer-events-none behind z-10 nodes"
  - "ResizeObserver + data-node-id attributes for dynamic position tracking across tree nodes"
  - "localStorage collapse state with businessId-scoped key for per-tenant persistence"

requirements-completed: [SUBAG-01, SUBAG-02, SUBAG-03]

# Metrics
duration: 5min
completed: 2026-03-29
---

# Phase 11 Plan 01: Reparent Service & Agent Tree Visualization Summary

**Org-chart tree view replacing card-based agents list with SVG bezier connectors, collapsible departments/leads, Slack-style status dots, and reparent service for drag-and-drop**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-29T17:25:33Z
- **Completed:** 2026-03-29T17:30:45Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- reparentAgent service with circular reference prevention, same-business constraint, department consistency, and child migration when a lead changes departments
- Full agent tree visualization with departments as bold header nodes and agents as compact pills with Slack-style status dots connected by SVG bezier curves
- Two-level collapsible hierarchy (departments collapse leads, leads collapse sub-agents) with localStorage persistence
- '+' buttons on departments and lead agents navigate to wizard with pre-filled departmentId and parentAgentId search params

## Task Commits

Each task was committed atomically:

1. **Task 1: Reparent service, server action, tree data components, and SVG lines** - `c4a0254` (feat)
2. **Task 2: Update agents page, new agent page, and wizard for tree rendering** - `a39c61d` (feat)

## Files Created/Modified
- `packages/core/agent/service.ts` - Added reparentAgent with circular reference validation and wouldCreateCycle helper
- `packages/core/server.ts` - Re-exported reparentAgent from server barrel
- `apps/web/_actions/agent-actions.ts` - Added reparentAgentAction server action
- `apps/web/_components/agent-tree-view.tsx` - Main tree container with data transformation, collapse state, ResizeObserver
- `apps/web/_components/agent-tree-department.tsx` - Bold department header with count badge, chevron, '+' button
- `apps/web/_components/agent-tree-node.tsx` - Compact pill with status dot, collapse for leads, '+' button
- `apps/web/_components/agent-tree-lines.tsx` - SVG bezier curve connector layer
- `apps/web/app/(dashboard)/businesses/[id]/agents/page.tsx` - Replaced AgentsList with AgentTreeView, added departments query
- `apps/web/app/(dashboard)/businesses/[id]/agents/new/page.tsx` - Reads departmentId/parentAgentId from searchParams
- `apps/web/_components/agent-setup-wizard.tsx` - Accepts initialDepartmentId and initialParentAgentId props

## Decisions Made
- Explicit type cast on Supabase query result in wouldCreateCycle to avoid TS7022 self-referential type inference error
- Agent pill click navigates to agent detail page via router.push rather than opening a sidebar panel (sidebar deferred to Plan 11-02)
- Empty departments still render as header nodes with '+' button so users can create their first agent in any department

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TS7022 self-referential type inference in wouldCreateCycle**
- **Found during:** Task 1 (reparentAgent service)
- **Issue:** Supabase query `const { data }` triggered TS7022 because the variable was referenced in its own async iteration pattern
- **Fix:** Used explicit type cast `as { data: { parent_agent_id: string | null } | null }` on the query result
- **Files modified:** packages/core/agent/service.ts
- **Verification:** `pnpm turbo typecheck` passes
- **Committed in:** c4a0254 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Type fix necessary for compilation. No scope creep.

## Issues Encountered
None beyond the type inference issue documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Tree visualization complete, ready for drag-and-drop reparenting and right sidebar panel in Plan 11-02
- reparentAgent service ready to be called from drag event handlers
- AgentTreeNode onSelect callback ready to be wired to sidebar panel

---
*Phase: 11-sub-agent-management*
*Completed: 2026-03-29*
