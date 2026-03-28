---
phase: 09-skill-management-deployment
plan: 02
subsystem: ui, api
tags: [skills, editor, assignment, agent-detail, server-actions, split-pane]

# Dependency graph
requires:
  - phase: 09-skill-management-deployment
    provides: skills table, skill_assignments table, skill service CRUD, skill types
provides:
  - Server Actions for skill CRUD, assignment, templates, and usage
  - Split-pane SkillEditor dialog with structured form and live SKILL.md preview
  - Skill assignment list with checkboxes and inherited department badge
  - Skill usage card with expandable agent/department names
  - Skills tab on agent detail page (7-tab layout)
  - Skill count badge on agent cards
  - Agents list page skill count queries (direct + inherited)
affects: [09-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: [split-pane editor dialog, checkbox assignment list with confirmation, client-side skill state management]

key-files:
  created:
    - apps/web/_actions/skill-actions.ts
    - apps/web/_components/skill-editor.tsx
    - apps/web/_components/skill-usage-card.tsx
    - apps/web/_components/skill-assignment-list.tsx
    - apps/web/_components/agent-skills-tab.tsx
  modified:
    - apps/web/_components/agent-detail-tabs.tsx
    - apps/web/_components/agent-card.tsx
    - apps/web/_components/agents-list.tsx
    - apps/web/app/(dashboard)/businesses/[id]/agents/[agentId]/page.tsx
    - apps/web/app/(dashboard)/businesses/[id]/agents/page.tsx

key-decisions:
  - "SkillEditor uses Dialog with sm:max-w-5xl for split-pane layout, stacked on mobile"
  - "Skill assignment list uses native HTML checkbox (matching Phase 4 pattern -- no shadcn Checkbox)"
  - "AgentSkillsTab fetches skills client-side via Server Actions, not server-side at page level"
  - "Add from Templates and Import from GitHub buttons are disabled placeholders for 09-03"

patterns-established:
  - "Split-pane editor pattern: form left, live preview right, both in Dialog with max-w-5xl"
  - "Checkbox assignment pattern: checked/unchecked toggle with confirmation dialog for destructive actions"
  - "Client-side tab data fetching: tab components fetch their own data via Server Actions"

requirements-completed: [SKILL-01, SKILL-03]

# Metrics
duration: 5min
completed: 2026-03-28
---

# Phase 9 Plan 2: Skill Editor UI, Assignment List, and Agent Skills Tab Summary

**Split-pane skill editor with live SKILL.md preview, checkbox-based agent skill assignment with inherited department badges, and 7-tab agent detail layout with skill count badges on agent cards**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-28T16:23:34Z
- **Completed:** 2026-03-28T16:29:05Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Server Actions file with 10 actions covering skill CRUD, assignment, templates, usage, and business skill listing
- Split-pane SkillEditor dialog with structured form (name, description, instructions, triggers) on left and live SKILL.md preview on right
- SkillAssignmentList with checkboxes, "Inherited" badge for department-level skills, and confirmation dialog for unassign
- AgentSkillsTab with "New Skill" button plus disabled "Add from Templates" and "Import from GitHub" placeholders
- Agent detail page expanded to 7 tabs with Skills between Integrations and Knowledge
- Agent cards display skill count badges; agents list page queries and merges direct + inherited counts

## Task Commits

Each task was committed atomically:

1. **Task 1: Server Actions and skill editor component** - `be6ef32` (feat)
2. **Task 2: Skill assignment list, Skills tab, agent card badge, and page updates** - `62b74f5` (feat)

## Files Created/Modified
- `apps/web/_actions/skill-actions.ts` - Server Actions for skill CRUD, assignment, templates, usage, and listing
- `apps/web/_components/skill-editor.tsx` - Split-pane Dialog editor with form and live SKILL.md preview
- `apps/web/_components/skill-usage-card.tsx` - Usage stats card with expandable agent/department list
- `apps/web/_components/skill-assignment-list.tsx` - Checkbox list with inherited badge and unassign confirmation
- `apps/web/_components/agent-skills-tab.tsx` - Skills tab content with create, assignment, and editor integration
- `apps/web/_components/agent-detail-tabs.tsx` - Updated from 6 to 7 tabs, added Skills tab
- `apps/web/_components/agent-card.tsx` - Added optional skillCount prop with badge display
- `apps/web/_components/agents-list.tsx` - Added skill_count to Agent interface, passes to AgentCard
- `apps/web/app/(dashboard)/businesses/[id]/agents/page.tsx` - Queries skill_assignments for per-agent counts
- `apps/web/app/(dashboard)/businesses/[id]/agents/[agentId]/page.tsx` - No changes needed (tab fetches own data)

## Decisions Made
- SkillEditor uses Dialog with sm:max-w-5xl for full split-pane layout; on mobile the columns stack vertically
- Native HTML checkbox used for skill assignment (consistent with Phase 4 approval pattern; no shadcn Checkbox installed)
- AgentSkillsTab fetches its own data client-side via Server Actions rather than server-side at page level, keeping the agent detail page clean
- "Add from Templates" and "Import from GitHub" buttons rendered as disabled placeholders with "Coming in next update" title tooltip, to be implemented in 09-03

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. The 036 migration must already be applied to Supabase (from 09-01).

## Next Phase Readiness
- All UI components ready for Plan 09-03 (template browser, GitHub import UI, department skill management)
- "Add from Templates" and "Import from GitHub" button slots ready to connect in 09-03
- Server Actions provide complete API surface for skill operations

## Self-Check: PASSED

All 10 files verified present. Both task commits (be6ef32, 62b74f5) verified in git log.

---
*Phase: 09-skill-management-deployment*
*Completed: 2026-03-28*
