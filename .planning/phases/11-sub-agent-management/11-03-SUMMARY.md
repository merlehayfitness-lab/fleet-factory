---
phase: 11-sub-agent-management
plan: 03
subsystem: ui
tags: [react, dnd-kit, svg, org-chart, flexbox, hydration]

# Dependency graph
requires:
  - phase: 11-sub-agent-management (plans 01-02)
    provides: Agent tree with department sections, sidebar panel, drag-and-drop reparenting
provides:
  - Unified org chart layout with single root node and centered tree
  - Rectangular box nodes with name, role, status dot
  - Elbow/step SVG connector lines (vertical + horizontal + vertical)
  - DnD hydration fix via isClient guard
  - Department labels as subtle inline text (not full-width bars)
affects: [agent-management, deployment-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "OrgChartNode tree model replacing flat TreeDepartment[] array"
    - "Centered flexbox tree layout with recursive renderNode()"
    - "ConnectionGroup-based SVG lines (parent + childIds) for elbow connectors"
    - "isClient useState guard to prevent DndContext SSR hydration errors"
    - "PointerSensor with distance constraint to distinguish click from drag"
    - "SVG overflow:visible with scroll-offset-aware coordinate calculation"

key-files:
  modified:
    - apps/web/_components/agent-tree-view.tsx
    - apps/web/_components/agent-tree-node.tsx
    - apps/web/_components/agent-tree-department.tsx
    - apps/web/_components/agent-tree-lines.tsx
    - apps/web/_components/agent-tree-sidebar.tsx
    - apps/web/app/(dashboard)/businesses/[id]/agents/page.tsx

key-decisions:
  - "OrgChartNode tree model with root/lead/sub-agent types replaces flat TreeDepartment array"
  - "PointerSensor with distance:5 constraint prevents click-vs-drag ambiguity"
  - "SVG uses getBoundingClientRect minus container scroll offset for accurate line positions"
  - "transition-colors replaces transition-all on nodes to prevent drag transform animation"
  - "Agent dependency array (not agents.length) ensures lines recalculate on data changes"

patterns-established:
  - "Unified org chart: single root node, department leads as children, sub-agents below"
  - "Elbow connectors: vertical from parent, horizontal bar, verticals down to children"
  - "isClient guard pattern for @dnd-kit SSR compatibility"

requirements-completed: [SUBAG-02, SUBAG-03]

# Metrics
duration: 15min
completed: 2026-03-30
---

# Phase 11 Plan 03: Unified Org Chart Summary

**Restructured agent tree from flat department sections into a unified org chart with box nodes, elbow connectors, and DnD hydration fix**

## Performance

- **Duration:** ~15 min (across multiple sessions with checkpoint)
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint)
- **Files modified:** 6
- **Commits:** 5 (1 feat + 4 fix)

## Accomplishments

- Replaced flat vertical department sections with a single connected org chart (root at top, leads branching down, sub-agents below)
- Replaced pill-shaped nodes with consistent rectangular box cards showing name, role, and status dot
- Replaced bezier SVG curves with straight-line elbow/step connectors (vertical + horizontal + vertical)
- Fixed DnD hydration error by guarding DndContext with isClient state
- Fixed drag interaction issues: click-vs-drag ambiguity, toast spam, SVG line breakage after drag, and transform animation artifacts

## Task Commits

Each task was committed atomically:

1. **Task 1: Restructure tree into unified org chart** - `9db0b94` (feat) + `de3d2d8` (fix: click/toast/lines after drag) + `2ccbc88` (fix: SVG connector scroll offset) + `d6a5f2f` (fix: transition-all drag animation) + `c2a6175` (fix: line recalculation on data change)
2. **Task 2: Visual verification checkpoint** - User approved

## Files Created/Modified

- `apps/web/_components/agent-tree-view.tsx` - Rewrote to use OrgChartNode tree model, buildOrgChart(), centered flexbox layout, connectionGroups, isClient guard
- `apps/web/_components/agent-tree-node.tsx` - Rectangular box card with status dot, name, role, collapse chevron, add-child button
- `apps/web/_components/agent-tree-department.tsx` - Simplified to minimal inline label (removed full-width bar, useDroppable, collapse controls)
- `apps/web/_components/agent-tree-lines.tsx` - Elbow/step SVG connectors using ConnectionGroup interface (parent + childIds)
- `apps/web/_components/agent-tree-sidebar.tsx` - Updated to accept OrgChartNode instead of separate selectedAgent/selectedDepartment
- `apps/web/app/(dashboard)/businesses/[id]/agents/page.tsx` - Added business name query, passes businessName prop to AgentTreeView

## Decisions Made

- **OrgChartNode tree model:** Replaced flat `TreeDepartment[]` with a single `OrgChartNode` tree rooted at the Owner lead (or synthetic business root). This enables the unified hierarchy layout.
- **PointerSensor with distance constraint:** Used `distance: 5` to distinguish intentional drags from clicks, fixing toast spam and unintended drag starts.
- **SVG scroll offset compensation:** Lines use `getBoundingClientRect()` minus container scroll offset for accurate positioning, fixing broken connectors after scrolling or dragging.
- **transition-colors instead of transition-all:** Prevents the CSS transition from animating the DnD transform reset, which caused nodes to slide back visually after drop.
- **agents array dependency (not .length):** Ensures SVG line positions recalculate whenever agent data changes (reparent, status change), not just when count changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed click-vs-drag ambiguity and toast spam**
- **Found during:** Task 1 verification
- **Issue:** MouseSensor treated every click as a potential drag start, causing toast spam and broken SVG lines
- **Fix:** Switched to PointerSensor with `activationConstraint: { distance: 5 }` to require 5px movement before drag starts
- **Files modified:** `apps/web/_components/agent-tree-view.tsx`
- **Committed in:** `de3d2d8`

**2. [Rule 1 - Bug] Fixed SVG connector lines breaking after drag**
- **Found during:** Task 1 verification
- **Issue:** SVG lines disappeared or broke after drag operations due to scroll offset not being accounted for in coordinate calculations
- **Fix:** Added `containerRef.current.scrollLeft/scrollTop` offset to line position calculations, set `overflow: visible` on SVG element
- **Files modified:** `apps/web/_components/agent-tree-lines.tsx`, `apps/web/_components/agent-tree-view.tsx`
- **Committed in:** `2ccbc88`

**3. [Rule 1 - Bug] Fixed transition-all animating drag transform reset**
- **Found during:** Task 1 verification
- **Issue:** `transition-all` on nodes caused a visible slide-back animation when DnD transform was removed after drop
- **Fix:** Changed to `transition-colors` to only transition color/border changes, not transform
- **Files modified:** `apps/web/_components/agent-tree-node.tsx`
- **Committed in:** `d6a5f2f`

**4. [Rule 1 - Bug] Fixed line positions not updating on data changes**
- **Found during:** Task 1 verification
- **Issue:** SVG lines only recalculated when `agents.length` changed, not when individual agent data changed (e.g., after reparenting)
- **Fix:** Changed dependency from `agents.length` to `agents` array reference
- **Files modified:** `apps/web/_components/agent-tree-view.tsx`
- **Committed in:** `c2a6175`

---

**Total deviations:** 4 auto-fixed (4 bugs)
**Impact on plan:** All auto-fixes were necessary for correct drag-and-drop behavior and visual accuracy. No scope creep.

## Issues Encountered

None beyond the auto-fixed bugs above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 11 (Sub-Agent Management) is now fully complete with all 3 plans delivered
- Unified org chart provides a polished visual hierarchy for all agent management workflows
- Ready for Phase 14 (Slack Integration & Chat Replacement) or any remaining phases

## Self-Check: PASSED

All 6 files verified on disk. All 5 commit hashes verified in git log.

---
*Phase: 11-sub-agent-management*
*Completed: 2026-03-30*
