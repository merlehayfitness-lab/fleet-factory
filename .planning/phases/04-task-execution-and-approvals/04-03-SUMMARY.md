---
phase: 04-task-execution-and-approvals
plan: 03
subsystem: ui
tags: [approvals, policy-engine, tasks-page, kanban, bulk-actions, risk-tiers, state-machine, supabase, rls]

# Dependency graph
requires:
  - phase: 04-task-execution-and-approvals
    provides: "Task schema, orchestrator, worker execution engine with risk-level gates"
provides:
  - "Approvals table with risk-tiered status tracking and RLS"
  - "Approval policies table with 13 seeded default policies"
  - "Approval state machine with two-step rejection flow"
  - "Policy engine for risk evaluation and agent trust checking"
  - "Approval CRUD service with bulk approve/reject"
  - "Tasks page with table/kanban toggle, quick-add, and filters"
  - "Full task creation page and task detail page"
  - "Approvals page with bulk actions and expandable reasoning"
  - "Sidebar and overview nav updates with live approval counts"
affects: [04-04]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Approval state machine with two-step rejection (retry_pending -> guidance_required)", "Policy engine prefix matching for action risk evaluation", "Kanban board as CSS grid columns by status", "Client-side task filtering with useMemo", "Approval polling via setInterval (10s)", "Slide-over panel via fixed positioned div"]

key-files:
  created:
    - "packages/db/schema/021_approvals_table.sql"
    - "packages/db/schema/022_approval_policies.sql"
    - "packages/db/schema/023_phase4_rls_policies.sql"
    - "packages/core/approval/approval-schema.ts"
    - "packages/core/approval/approval-lifecycle.ts"
    - "packages/core/approval/approval-service.ts"
    - "packages/core/approval/policy-engine.ts"
    - "apps/web/_actions/approval-actions.ts"
    - "apps/web/app/(dashboard)/businesses/[id]/tasks/page.tsx"
    - "apps/web/app/(dashboard)/businesses/[id]/tasks/tasks-page-client.tsx"
    - "apps/web/app/(dashboard)/businesses/[id]/tasks/new/page.tsx"
    - "apps/web/app/(dashboard)/businesses/[id]/tasks/new/new-task-form.tsx"
    - "apps/web/app/(dashboard)/businesses/[id]/tasks/[taskId]/page.tsx"
    - "apps/web/app/(dashboard)/businesses/[id]/approvals/page.tsx"
    - "apps/web/_components/tasks-table.tsx"
    - "apps/web/_components/tasks-kanban.tsx"
    - "apps/web/_components/task-quick-add.tsx"
    - "apps/web/_components/task-detail-panel.tsx"
    - "apps/web/_components/task-filters.tsx"
    - "apps/web/_components/approvals-list.tsx"
    - "apps/web/_components/approval-card.tsx"
  modified:
    - "packages/db/schema/_combined_schema.sql"
    - "packages/core/types/index.ts"
    - "packages/core/index.ts"
    - "packages/core/server.ts"
    - "apps/web/_actions/task-actions.ts"
    - "apps/web/_components/sidebar-nav.tsx"
    - "apps/web/_components/business-overview.tsx"
    - "apps/web/_components/status-badge.tsx"
    - "apps/web/app/(dashboard)/businesses/[id]/page.tsx"

key-decisions:
  - "Slide-over panel uses fixed positioned div with backdrop instead of Sheet component (not available)"
  - "Kanban board is visual only with CSS grid -- no drag-and-drop library added"
  - "Approval polling uses setInterval at 10s refresh via Server Action"
  - "Client-side filtering for tasks page with useMemo for performance"
  - "Checkbox selection uses native HTML input rather than shadcn Checkbox (not installed)"

patterns-established:
  - "Approval state machine: pending -> approved/rejected, rejected -> retry_pending/guidance_required"
  - "Policy engine: prefix matching against approval_policies action_pattern"
  - "Auto-approve rules: low=always, medium+trusted=auto, otherwise human review"
  - "Bulk operations: loop individual approve/reject for proper state machine validation per item"
  - "View toggle pattern: client wrapper with useState for table/kanban view"

requirements-completed: [TASK-05, APRV-01, APRV-02, APRV-03, APRV-04, APRV-05, APRV-06, APRV-07, DASH-09]

# Metrics
duration: 9min
completed: 2026-03-26
---

# Phase 4 Plan 3: Approval Gates and Tasks/Approvals Pages Summary

**Approval gates with risk-tiered policy engine and two-step rejection, tasks page with table/kanban toggle and quick-add, approvals page with bulk actions and expandable agent reasoning**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-26T14:58:59Z
- **Completed:** 2026-03-26T15:08:24Z
- **Tasks:** 2
- **Files modified:** 30

## Accomplishments
- Approvals table with risk-tiered status tracking, 3 RLS policies, and 13 seeded approval policies across 6 categories
- Approval state machine with two-step rejection: first reject triggers agent retry, second requires admin guidance
- Policy engine evaluates action risk by prefix matching against policy rules and checks agent trust for auto-approval
- Tasks page with table/kanban toggle, quick-add inline form, filter bar, and slide-over detail panel
- Approvals page with checkbox bulk approve/reject, expandable agent reasoning, risk-colored badges, and 10s polling
- Sidebar Tasks and Approvals links enabled, business overview wires live pending approval count

## Task Commits

Each task was committed atomically:

1. **Task 1: Approval schema, lifecycle, policy engine, and approval service** - `3199807` (feat)
2. **Task 2: Tasks page, approvals page, UI components, and nav updates** - `8b5e04d` (feat)

**Plan metadata:** (pending)

## Files Created/Modified
- `packages/db/schema/021_approvals_table.sql` - Approvals table with risk_level CHECK, 3 indexes, 3 RLS policies
- `packages/db/schema/022_approval_policies.sql` - Approval policies table with 13 seeded defaults across 6 categories
- `packages/db/schema/023_phase4_rls_policies.sql` - Phase 4 RLS documentation placeholder
- `packages/db/schema/_combined_schema.sql` - Appended 021, 022, 023 migrations
- `packages/core/types/index.ts` - Added ApprovalStatus and RiskLevel types
- `packages/core/approval/approval-schema.ts` - Zod schemas for approve, reject, bulk actions
- `packages/core/approval/approval-lifecycle.ts` - Approval state machine with two-step rejection
- `packages/core/approval/approval-service.ts` - CRUD: create, approve, reject, provideGuidance, bulkApprove, bulkReject
- `packages/core/approval/policy-engine.ts` - evaluateRisk, checkAgentTrust, shouldAutoApprove
- `packages/core/index.ts` - Added approval types, lifecycle, and schema exports
- `packages/core/server.ts` - Added approval service and policy engine exports
- `apps/web/_actions/approval-actions.ts` - 7 Server Actions for approval operations
- `apps/web/_actions/task-actions.ts` - Added quickAddTaskAction for inline form
- `apps/web/app/(dashboard)/businesses/[id]/tasks/page.tsx` - Tasks page Server Component
- `apps/web/app/(dashboard)/businesses/[id]/tasks/tasks-page-client.tsx` - Client wrapper with view toggle and filters
- `apps/web/app/(dashboard)/businesses/[id]/tasks/new/page.tsx` - Full task creation page
- `apps/web/app/(dashboard)/businesses/[id]/tasks/new/new-task-form.tsx` - Full task creation form
- `apps/web/app/(dashboard)/businesses/[id]/tasks/[taskId]/page.tsx` - Task detail page with subtasks, approvals, audit
- `apps/web/app/(dashboard)/businesses/[id]/approvals/page.tsx` - Approvals page with pending count badge
- `apps/web/_components/tasks-table.tsx` - Table view with clickable rows opening detail panel
- `apps/web/_components/tasks-kanban.tsx` - Kanban board with 6 status columns
- `apps/web/_components/task-quick-add.tsx` - Inline creation form with react-hook-form
- `apps/web/_components/task-detail-panel.tsx` - Slide-over panel with task actions
- `apps/web/_components/task-filters.tsx` - Filter bar with status, department, priority, agent selects
- `apps/web/_components/approvals-list.tsx` - List with checkbox selection, bulk actions, 10s polling
- `apps/web/_components/approval-card.tsx` - Card with expand toggle, approve/reject, guidance input
- `apps/web/_components/sidebar-nav.tsx` - Enabled Tasks and Approvals links
- `apps/web/_components/business-overview.tsx` - Wired pendingApprovalCount, enabled Tasks and Approvals quick links
- `apps/web/_components/status-badge.tsx` - Added task, approval, and risk level status mappings

## Decisions Made
- **Slide-over panel implementation:** Used a fixed positioned div with backdrop overlay rather than a Sheet component (not available in the installed shadcn/ui set). Achieves the same UX without adding a dependency.
- **Kanban board approach:** Visual-only CSS grid with 6 status columns. No drag-and-drop library added per CONTEXT decision ("feel" not functional). Tasks can be opened via click.
- **Checkbox selection:** Used native HTML checkbox input since shadcn/ui Checkbox component was not installed. Functional and visually adequate for MVP.
- **Client-side filtering:** Tasks page filters client-side with useMemo rather than re-fetching from server, providing instant filter response.
- **Approval polling:** 10-second setInterval with Server Action fetch for near-real-time updates per RESEARCH recommendation.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
**Database migration required.** Run the new SQL migrations (021, 022, 023) or re-run `_combined_schema.sql` in the Supabase SQL editor to create the approvals and approval_policies tables.

## Next Phase Readiness
- Approval gates and policy engine complete for 04-04 (usage metering and security hardening)
- Tasks and approvals pages fully functional for end-to-end testing
- All Phase 4 UI routes now enabled in sidebar navigation
- Business overview shows live approval counts

## Self-Check: PASSED

- All 30 files verified present on disk
- Commit 3199807 (Task 1) verified in git log
- Commit 8b5e04d (Task 2) verified in git log
- `pnpm turbo typecheck` passes with 0 errors

---
*Phase: 04-task-execution-and-approvals*
*Completed: 2026-03-26*
