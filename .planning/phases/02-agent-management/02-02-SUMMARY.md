---
phase: 02-agent-management
plan: 02
subsystem: ui, agent
tags: [shadcn, tabs, card-grid, lifecycle, dropdown-menu, alert-dialog, sonner, template-diff]

# Dependency graph
requires:
  - phase: 02-agent-management
    plan: 01
    provides: "Agent lifecycle state machine, Server Actions (freeze/pause/resume/retire), template CRUD, StatusBadge"
  - phase: 01-foundation-and-tenant-provisioning
    provides: "Schema tables (agents, departments, agent_templates, audit_logs), RLS, Supabase client, sidebar nav, business overview"
provides:
  - "Agents list page with department-grouped card grid and kebab menu lifecycle actions"
  - "Agent detail page with 4-tab layout: Overview, Config, Activity, Conversations"
  - "Freeze confirmation dialog warning about execution stop and tool access revocation"
  - "Retire type-to-confirm dialog requiring exact agent name match"
  - "Config tab with inline system prompt editing and template drift detection"
  - "Activity tab with audit log timeline and relative timestamps"
  - "Conversations tab placeholder for Phase 5"
  - "Business overview Agents quick link (enabled)"
affects: [agent-execution, deployment, observability]

# Tech tracking
tech-stack:
  added: []
  patterns: [department-grouped-card-grid, controlled-alert-dialog, type-to-confirm-dialog, template-diff-detection]

key-files:
  created:
    - apps/web/app/(dashboard)/businesses/[id]/agents/page.tsx
    - apps/web/app/(dashboard)/businesses/[id]/agents/[agentId]/page.tsx
    - apps/web/_components/agents-list.tsx
    - apps/web/_components/agent-card.tsx
    - apps/web/_components/agent-detail-tabs.tsx
    - apps/web/_components/agent-overview.tsx
    - apps/web/_components/agent-config.tsx
    - apps/web/_components/agent-activity.tsx
    - apps/web/_components/agent-conversations.tsx
    - apps/web/_components/freeze-dialog.tsx
    - apps/web/_components/retire-dialog.tsx
  modified:
    - apps/web/_components/business-overview.tsx

key-decisions:
  - "Controlled AlertDialog pattern: freeze/retire dialogs use open/onOpenChange props for programmatic control from kebab menu"
  - "Template diff uses JSON.stringify comparison for simplicity, with side-by-side display for diverged fields"
  - "Activity timeline uses relative time formatting (just now, X minutes ago, X hours ago) computed client-side"

patterns-established:
  - "Controlled dialog pattern: dialogs opened by external triggers use open/onOpenChange state management"
  - "Department-grouped card grid: agents grouped by department with type-based ordering (owner, sales, support, operations)"
  - "Server Component + Client Tabs: parent fetches data, passes as props to client-side tab container"
  - "Template drift detection: JSON.stringify comparison with side-by-side amber-highlighted diff display"

requirements-completed: [AGNT-02, AGNT-03, AGNT-05, DASH-06, DASH-07]

# Metrics
duration: 6min
completed: 2026-03-25
---

# Phase 2 Plan 2: Agent List and Detail Pages Summary

**Department-grouped agent card grid with lifecycle kebab menus, 4-tab detail page with config drift detection, and freeze/retire confirmation dialogs**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-25T19:11:50Z
- **Completed:** 2026-03-25T19:18:00Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Agents list page renders agents in a department-grouped responsive card grid with status badges, template info, and model profile display
- Agent card kebab menu uses getValidTransitions to show only valid lifecycle actions per agent status
- Agent detail page with 4-tab layout: Overview (hero status + lifecycle controls), Config (editable system prompt + template diff), Activity (audit log timeline), Conversations (Phase 5 placeholder)
- Freeze dialog warns about stopping execution and revoking tool access; Retire dialog requires typing exact agent name to confirm
- Config tab detects template drift and shows side-by-side comparison for diverged fields
- Frozen agents appear visually "dead" (opacity-50 grayscale) across list and detail views
- Business overview now includes enabled Agents quick link

## Task Commits

Each task was committed atomically:

1. **Task 1: Agents list page with department-grouped card grid** - `01760e7` (feat)
2. **Task 2: Agent detail page with 4-tab layout and business overview update** - `c8133dd` (feat)

## Files Created/Modified
- `apps/web/app/(dashboard)/businesses/[id]/agents/page.tsx` - Agents list Server Component with department/template joins
- `apps/web/app/(dashboard)/businesses/[id]/agents/[agentId]/page.tsx` - Agent detail Server Component with audit logs
- `apps/web/_components/agents-list.tsx` - Department-grouped card grid with type-based ordering
- `apps/web/_components/agent-card.tsx` - Agent card with status badge, template info, kebab menu, and frozen/retired styling
- `apps/web/_components/agent-detail-tabs.tsx` - Client-side 4-tab container (Overview, Config, Activity, Conversations)
- `apps/web/_components/agent-overview.tsx` - Hero status, lifecycle controls, frozen banner
- `apps/web/_components/agent-config.tsx` - System prompt editor, template reference, template diff, tool/model profiles
- `apps/web/_components/agent-activity.tsx` - Audit log timeline with relative timestamps
- `apps/web/_components/agent-conversations.tsx` - Phase 5 placeholder
- `apps/web/_components/freeze-dialog.tsx` - Controlled AlertDialog for freeze confirmation
- `apps/web/_components/retire-dialog.tsx` - Type-to-confirm AlertDialog for retire action
- `apps/web/_components/business-overview.tsx` - Added enabled Agents quick link

## Decisions Made
- Used controlled AlertDialog pattern (open/onOpenChange) for freeze and retire dialogs since they're triggered from kebab menus rather than inline triggers
- Template drift detection uses JSON.stringify comparison for simplicity -- sufficient for MVP, can be replaced with deep diff library later
- Activity timeline computes relative times client-side to avoid hydration mismatches from server/client time differences

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 2 agent management is complete (both plans executed)
- All agent pages (list, detail, lifecycle controls) are functional
- Templates management from Plan 01 provides CRUD for agent blueprints
- Ready for Phase 3 (deployment pipeline) which will build on agent and business foundations

## Self-Check: PASSED

All 12 created/modified files verified on disk. Both task commits (01760e7, c8133dd) verified in git log.

---
*Phase: 02-agent-management*
*Completed: 2026-03-25*
