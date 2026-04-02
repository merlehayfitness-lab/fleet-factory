---
phase: 02-agent-management
plan: 01
subsystem: agent, database, ui
tags: [zod, state-machine, rls, crud, server-actions, shadcn, lifecycle]

# Dependency graph
requires:
  - phase: 01-foundation-and-tenant-provisioning
    provides: "Schema tables (agents, agent_templates, audit_logs), RLS helpers, Supabase client, sidebar nav"
provides:
  - "Agent lifecycle state machine (canTransition, assertTransition, getValidTransitions)"
  - "Agent service layer (transitionAgentStatus, updateAgentConfig with audit logging)"
  - "Template CRUD service with Zod validation and active-agent protection on delete"
  - "Schema migration adding frozen status to agents CHECK constraint"
  - "is_platform_admin() RLS helper and template write policies"
  - "Agent lifecycle Server Actions (freeze, pause, resume, retire)"
  - "Template CRUD Server Actions (create, update, delete)"
  - "Templates list, create, and edit pages"
  - "Sidebar nav with Agents and Templates links"
affects: [02-02-PLAN, agent-execution, deployment]

# Tech tracking
tech-stack:
  added: [shadcn/alert-dialog, shadcn/dialog, shadcn/tabs, sonner-toaster]
  patterns: [agent-lifecycle-state-machine, core-service-delegation, template-crud-with-zod]

key-files:
  created:
    - packages/db/schema/011_agent_frozen_status.sql
    - packages/db/schema/012_agent_templates_rls.sql
    - packages/core/agent/lifecycle.ts
    - packages/core/agent/service.ts
    - packages/core/agent/template-schema.ts
    - packages/core/agent/template-service.ts
    - apps/web/_actions/agent-actions.ts
    - apps/web/_actions/template-actions.ts
    - apps/web/_components/template-list.tsx
    - apps/web/_components/template-form.tsx
    - apps/web/app/(dashboard)/businesses/[id]/templates/page.tsx
    - apps/web/app/(dashboard)/businesses/[id]/templates/new/page.tsx
    - apps/web/app/(dashboard)/businesses/[id]/templates/[templateId]/edit/page.tsx
  modified:
    - packages/db/schema/_combined_schema.sql
    - packages/core/types/index.ts
    - packages/core/index.ts
    - packages/core/tsconfig.json
    - apps/web/_components/status-badge.tsx
    - apps/web/_components/sidebar-nav.tsx
    - apps/web/app/layout.tsx

key-decisions:
  - "Added dom lib to packages/core tsconfig.json to support console.error for audit log failure logging"
  - "Agent audit logging is best-effort (errors logged not thrown) to avoid failing core operations on audit failures"
  - "Templates are global (not business-scoped) but routed under business path for navigation consistency"
  - "Added Toaster from sonner to root layout to enable toast notifications across the app"

patterns-established:
  - "Agent lifecycle state machine: all transitions explicitly declared in VALID_TRANSITIONS map"
  - "Core service delegation: Server Actions delegate to packages/core service functions with audit logging"
  - "Template CRUD protection: deleteTemplate refuses if non-retired agents reference the template"
  - "JSON fields (tool_profile, model_profile) editable via Textarea with manual JSON.parse"

requirements-completed: [AGNT-01, AGNT-04, AGNT-05, AGNT-06]

# Metrics
duration: 9min
completed: 2026-03-25
---

# Phase 2 Plan 1: Agent Templates and Lifecycle Summary

**Agent lifecycle state machine with 6 statuses including frozen, template CRUD with Zod validation, and templates management pages with sidebar nav integration**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-25T18:58:09Z
- **Completed:** 2026-03-25T19:08:00Z
- **Tasks:** 2
- **Files modified:** 23

## Accomplishments
- Agent lifecycle state machine validates all 6 statuses (provisioning, active, paused, frozen, error, retired) with explicit transition rules
- Template CRUD service provides validated create/update/delete with protection against deleting templates still referenced by active agents
- Agent lifecycle Server Actions (freeze, pause, resume, retire) with audit trail logging
- Templates management pages (list with card grid, create form, edit form) with react-hook-form + Zod validation
- Sidebar nav updated with enabled Agents and Templates links
- StatusBadge supports frozen status with greyed-out ice styling

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migrations and core agent service layer** - `01d7562` (feat)
2. **Task 2: Template CRUD Server Actions, templates pages, and sidebar nav** - `ac120d3` (feat)

## Files Created/Modified
- `packages/db/schema/011_agent_frozen_status.sql` - Migration adding frozen to agents CHECK constraint
- `packages/db/schema/012_agent_templates_rls.sql` - is_platform_admin() function and template write RLS policies
- `packages/db/schema/_combined_schema.sql` - Updated with migrations 011 and 012
- `packages/core/types/index.ts` - Added frozen to AgentStatus type union
- `packages/core/agent/lifecycle.ts` - Agent lifecycle state machine with transition validation
- `packages/core/agent/service.ts` - transitionAgentStatus and updateAgentConfig with audit logging
- `packages/core/agent/template-schema.ts` - Zod schemas for template create/update validation
- `packages/core/agent/template-service.ts` - CRUD service functions for agent templates
- `packages/core/index.ts` - Re-exports for all new agent and template modules
- `packages/core/tsconfig.json` - Added dom lib for console support
- `apps/web/_actions/agent-actions.ts` - Server Actions for agent lifecycle transitions
- `apps/web/_actions/template-actions.ts` - Server Actions for template CRUD
- `apps/web/_components/template-list.tsx` - Template card grid with edit/delete actions
- `apps/web/_components/template-form.tsx` - Template create/edit form with Zod + react-hook-form
- `apps/web/app/(dashboard)/businesses/[id]/templates/page.tsx` - Templates list page
- `apps/web/app/(dashboard)/businesses/[id]/templates/new/page.tsx` - New template page
- `apps/web/app/(dashboard)/businesses/[id]/templates/[templateId]/edit/page.tsx` - Edit template page
- `apps/web/_components/status-badge.tsx` - Added frozen status with greyed-out styling
- `apps/web/_components/sidebar-nav.tsx` - Added Agents and Templates nav links
- `apps/web/app/layout.tsx` - Added Toaster from sonner for toast notifications
- `apps/web/components/ui/alert-dialog.tsx` - shadcn alert-dialog component (installed)
- `apps/web/components/ui/dialog.tsx` - shadcn dialog component (installed)
- `apps/web/components/ui/tabs.tsx` - shadcn tabs component (installed)

## Decisions Made
- Added `dom` lib to `packages/core/tsconfig.json` to enable `console.error` for audit log failure logging (alternative: remove logging, but silent failure is worse for debugging)
- Audit logging is best-effort: errors logged but not thrown, so core operations don't fail on audit failures
- Templates are global (not business-scoped) but routed under the business path to maintain navigation consistency within the business context
- Added `<Toaster>` from sonner to root layout (was missing despite sonner being a dependency) to enable toast notifications for template CRUD feedback

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added dom lib to core tsconfig for console support**
- **Found during:** Task 1 (Core agent service layer)
- **Issue:** `console.error` in `agent/service.ts` caused TS2584 because core tsconfig only had `["esnext"]` lib which doesn't include console types
- **Fix:** Added `"dom"` to the lib array in `packages/core/tsconfig.json`
- **Files modified:** `packages/core/tsconfig.json`
- **Verification:** `pnpm turbo typecheck` passes cleanly
- **Committed in:** `01d7562` (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added Toaster to root layout**
- **Found during:** Task 2 (Template CRUD pages)
- **Issue:** sonner was installed as a dependency but `<Toaster>` was never rendered in the layout, so toast notifications would silently fail
- **Fix:** Added `<Toaster richColors position="bottom-right" />` to `apps/web/app/layout.tsx`
- **Files modified:** `apps/web/app/layout.tsx`
- **Verification:** Build passes, toast imports resolve correctly
- **Committed in:** `ac120d3` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug fix, 1 missing critical)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None.

## User Setup Required
Schema migrations 011 and 012 need to be applied to the Supabase database. Run the SQL from `packages/db/schema/011_agent_frozen_status.sql` and `packages/db/schema/012_agent_templates_rls.sql` in the Supabase SQL Editor.

## Next Phase Readiness
- Agent lifecycle state machine and template CRUD are complete, ready for 02-02 (agents list and detail pages)
- Sidebar nav has Agents link ready (route not yet created, will be built in 02-02)
- All core service functions are exported from `@fleet-factory/core` for use in upcoming pages

---
*Phase: 02-agent-management*
*Completed: 2026-03-25*
