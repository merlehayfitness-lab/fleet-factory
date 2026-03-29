---
phase: 12-integrations-catalog-setup
plan: 01
subsystem: integrations
tags: [catalog, dialog, department-scope, svg, migration, multi-target, supabase]

# Dependency graph
requires:
  - phase: 03-integration-deployment
    provides: Integration schema, adapter registry, mock adapters, integration CRUD service
  - phase: 11-sub-agent-management
    provides: Department/agent hierarchy and relationships
provides:
  - Static integration catalog with 15 entries across 5 categories
  - Migration 038 adding department_id, setup_instructions, name columns with partial unique indexes
  - Bulk create integration service for multi-target assignment
  - Department-level integration support with lazy inheritance
  - Multi-step catalog browsing dialog with search and category grouping
  - Target picker for department and agent multi-select assignment
  - 15 SVG brand logo files
affects: [12-02-plan, integrations-page, agent-detail, deployment-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: [check-then-insert for partial unique indexes, lazy department inheritance, multi-step dialog with controlled state]

key-files:
  created:
    - packages/core/integrations/catalog.ts
    - packages/db/schema/038_integrations_department_scope.sql
    - apps/web/_components/integration-catalog-dialog.tsx
    - apps/web/_components/catalog-target-picker.tsx
    - apps/web/public/integrations/*.svg (15 files)
  modified:
    - packages/core/integrations/service.ts
    - packages/core/integrations/index.ts
    - packages/core/index.ts
    - packages/db/schema/_combined_schema.sql
    - apps/web/_actions/integration-actions.ts
    - apps/web/app/(dashboard)/businesses/[id]/integrations/page.tsx
    - apps/web/_components/integrations-overview.tsx
    - apps/web/_components/integration-config-card.tsx
    - apps/web/_components/agent-integrations.tsx
    - apps/web/_components/agent-detail-tabs.tsx
    - apps/web/app/(dashboard)/businesses/[id]/agents/[agentId]/page.tsx

key-decisions:
  - "Check-then-insert pattern for bulkCreateIntegrations because partial unique indexes don't work cleanly with Supabase upsert onConflict"
  - "Lazy department inheritance: department_id set + agent_id NULL, queried via OR filter for effective integrations"
  - "AgentDetailTabs receives departments and allAgents props from server page to pass to catalog dialog"

patterns-established:
  - "Multi-step controlled Dialog with step state and reset on close"
  - "Department-level integration records with agent_id NULL for lazy inheritance"
  - "Partial unique indexes (agent-level + department-level) replacing single composite unique"

requirements-completed: [INTG-ENH-01, INTG-ENH-02, INTG-ENH-04]

# Metrics
duration: 9min
completed: 2026-03-29
---

# Phase 12 Plan 01: Integration Catalog & Department Assignment Summary

**Browsable 15-entry integration catalog with multi-step dialog, department-level lazy inheritance, and category auto-population from catalog selection**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-29T21:28:13Z
- **Completed:** 2026-03-29T21:37:07Z
- **Tasks:** 3
- **Files modified:** 30

## Accomplishments
- Static INTEGRATION_CATALOG with 15 entries (3 per category: CRM, email, helpdesk, calendar, messaging) with metadata, logos, and category mapping
- Migration 038 adds department_id, setup_instructions, name columns with partial unique indexes replacing the old composite unique
- Multi-step IntegrationCatalogDialog: browse/search catalog by category, assign to departments and/or agents, confirmation step
- CatalogTargetPicker with department/agent grouping and multi-select checkboxes
- addCatalogIntegrationAction for bulk creation with category auto-populated from catalog entry
- Integration service updated with bulkCreateIntegrations, getEffectiveIntegrationsForAgent, getIntegrationsForDepartment
- All existing UI updated: integrations page has "Add Integration" button, overview handles department-level display, config card shows department name, agent-integrations uses "Add from Catalog" instead of per-type "Add Mock"

## Task Commits

Each task was committed atomically:

1. **Task 1: Catalog data module, schema migration, integration service updates, SVG logos, and core exports** - `200a0ae` (feat)
2. **Task 2a: Catalog dialog, target picker, and server action** - `513c1af` (feat)
3. **Task 2b: Integrations page, overview, config card, and agent-integrations updates** - `dffc639` (feat)

## Files Created/Modified
- `packages/core/integrations/catalog.ts` - Static integration catalog with 15 entries, getCatalogByCategory, getCatalogEntry helpers
- `packages/core/integrations/service.ts` - Updated with department-aware queries, bulkCreateIntegrations, getEffectiveIntegrationsForAgent
- `packages/core/integrations/index.ts` - Re-exports catalog data and types
- `packages/core/index.ts` - Exports catalog, new service functions, and types
- `packages/db/schema/038_integrations_department_scope.sql` - Migration adding department_id, setup_instructions, name columns and partial unique indexes
- `packages/db/schema/_combined_schema.sql` - Appended migration 038
- `apps/web/public/integrations/*.svg` - 15 brand-colored SVG logo files
- `apps/web/_components/integration-catalog-dialog.tsx` - Multi-step catalog browsing dialog with search and category groups
- `apps/web/_components/catalog-target-picker.tsx` - Multi-select picker for departments and agents
- `apps/web/_actions/integration-actions.ts` - Added addCatalogIntegrationAction, updated getBusinessIntegrationsAction for department join
- `apps/web/app/(dashboard)/businesses/[id]/integrations/page.tsx` - Added "Add Integration" button, fetches departments
- `apps/web/_components/integrations-overview.tsx` - Handles department-level integrations, updated empty state
- `apps/web/_components/integration-config-card.tsx` - Shows department name for department-level integrations
- `apps/web/_components/agent-integrations.tsx` - Replaced "Add Mock" with "Add from Catalog" button
- `apps/web/_components/agent-detail-tabs.tsx` - Passes departments and allAgents to AgentIntegrations
- `apps/web/app/(dashboard)/businesses/[id]/agents/[agentId]/page.tsx` - Fetches departments and all agents for catalog dialog

## Decisions Made
- Used check-then-insert pattern for bulkCreateIntegrations since Supabase upsert with partial unique indexes does not work cleanly with onConflict
- Lazy department inheritance model: department_id set with agent_id NULL, effective integrations queried via OR filter
- AgentDetailTabs receives departments and allAgents as props from the server page, passing them down to the catalog dialog for target picking

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added departments and allAgents props to AgentDetailTabs**
- **Found during:** Task 2b (agent-integrations updates)
- **Issue:** AgentIntegrations now requires departments and agents props for the catalog dialog, but these were not passed through AgentDetailTabs
- **Fix:** Added Department and AgentTarget interfaces to AgentDetailTabs, updated props, and updated the agent detail page to fetch and pass department/agent data
- **Files modified:** apps/web/_components/agent-detail-tabs.tsx, apps/web/app/(dashboard)/businesses/[id]/agents/[agentId]/page.tsx
- **Verification:** pnpm turbo typecheck passes
- **Committed in:** dffc639 (Task 2b commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix was necessary for the catalog dialog to work in the agent detail page context. No scope creep.

## Issues Encountered
None

## User Setup Required
Database migration 038 must be applied to add department_id, setup_instructions, and name columns to the integrations table.

## Next Phase Readiness
- Catalog and assignment infrastructure complete, ready for plan 12-02 (AI setup instructions)
- Step 3 of the catalog dialog has a placeholder for setup instructions that 12-02 will fill
- All integration UI components handle department-level records

## Self-Check: PASSED

All created files verified present. All 3 task commits verified in git log. 15 SVG files confirmed.

---
*Phase: 12-integrations-catalog-setup*
*Completed: 2026-03-29*
