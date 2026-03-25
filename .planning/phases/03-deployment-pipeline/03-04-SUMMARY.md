---
phase: 03-deployment-pipeline
plan: 04
subsystem: ui, integrations
tags: [integration-adapters, per-agent-config, provider-selector, mock-adapters, business-overview]

# Dependency graph
requires:
  - phase: 03-deployment-pipeline
    plan: 01
    provides: "IntegrationAdapter interface with 5 mock adapters, integrations table with RLS"
  - phase: 03-deployment-pipeline
    plan: 03
    provides: "Secrets management, sidebar nav with enabled links, business overview quick links"
provides:
  - "Per-agent Integrations tab on agent detail page with provider selector and mock adapter support"
  - "Business-wide integrations overview page at /businesses/[id]/integrations"
  - "Integrations CRUD service in packages/core/integrations/service.ts"
  - "Integration Server Actions for CRUD operations"
  - "Sidebar nav and business overview Integrations links"
affects: [04-agent-execution, 05-observability]

# Tech tracking
tech-stack:
  added: []
  patterns: ["per-agent integration config with type-scoped provider selector", "read-only business-wide overview with edit-on-detail pattern", "coming-soon placeholder for real provider options"]

key-files:
  created:
    - packages/core/integrations/service.ts
    - apps/web/_actions/integration-actions.ts
    - apps/web/_components/agent-integrations.tsx
    - apps/web/app/(dashboard)/businesses/[id]/integrations/page.tsx
    - apps/web/_components/integrations-overview.tsx
    - apps/web/_components/integration-config-card.tsx
  modified:
    - packages/core/index.ts
    - apps/web/_components/agent-detail-tabs.tsx
    - apps/web/app/(dashboard)/businesses/[id]/agents/[agentId]/page.tsx
    - apps/web/_components/sidebar-nav.tsx
    - apps/web/_components/business-overview.tsx

key-decisions:
  - "Server Actions call Supabase directly instead of delegating to core service for simpler auth flow"
  - "Real provider options shown in dropdown but display coming-soon message -- no credential forms for MVP"
  - "Business-wide overview is read-only; editing happens only on agent detail Integrations tab"
  - "Integration config card shows max 3 capabilities with +N more overflow badge"

patterns-established:
  - "Per-entity tab pattern: Server Component fetches data, passes to client Tabs component with per-tab sub-components"
  - "Edit-on-detail pattern: overview page is read-only, links to detail page for editing"
  - "Provider selector pattern: mock functional, real providers show coming-soon placeholder"

requirements-completed: [INTG-01, INTG-02, INTG-03, INTG-04]

# Metrics
duration: 4min
completed: 2026-03-25
---

# Phase 3 Plan 4: Integrations UI Summary

**Per-agent Integrations tab with 5-type provider selector and mock adapter support, plus business-wide integrations overview page with type-grouped cards and nav updates**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-25T22:55:34Z
- **Completed:** 2026-03-25T23:00:26Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Built per-agent Integrations tab showing 5 integration types (CRM, Email, Helpdesk, Calendar, Messaging) with provider dropdown, status badge, capabilities list, and sample data preview
- Created business-wide integrations overview page at /businesses/[id]/integrations with summary stats and type-grouped cards showing agent name, provider, status, and capabilities
- Added integrations CRUD service (getIntegrationsForAgent, getIntegrationsForBusiness, upsertIntegration, deleteIntegration) and 4 Server Actions with auth checks
- Updated sidebar nav with Integrations link (Plug icon) and business overview with Integrations quick link card

## Task Commits

Each task was committed atomically:

1. **Task 1: Integrations CRUD service, Server Actions, and agent Integrations tab** - `def5c12` (feat)
2. **Task 2: Business-wide integrations overview page and nav updates** - `ab2426c` (feat)

## Files Created/Modified
- `packages/core/integrations/service.ts` - CRUD service with getIntegrationsForAgent, getIntegrationsForBusiness, upsertIntegration, deleteIntegration
- `apps/web/_actions/integration-actions.ts` - Server Actions for integration CRUD with auth checks and revalidation
- `apps/web/_components/agent-integrations.tsx` - Per-agent Integrations tab with 5 type sections, provider selector, capabilities, sample data
- `apps/web/_components/agent-detail-tabs.tsx` - Added 5th Integrations tab to agent detail page
- `apps/web/app/(dashboard)/businesses/[id]/agents/[agentId]/page.tsx` - Fetch integrations and pass to AgentDetailTabs
- `packages/core/index.ts` - Re-export integrations CRUD service functions
- `apps/web/app/(dashboard)/businesses/[id]/integrations/page.tsx` - Server Component for business-wide integrations overview
- `apps/web/_components/integrations-overview.tsx` - Groups integrations by type with summary stats and unconfigured agent links
- `apps/web/_components/integration-config-card.tsx` - Read-only card showing agent, provider, status, capabilities
- `apps/web/_components/sidebar-nav.tsx` - Added Integrations link with Plug icon after Deployments
- `apps/web/_components/business-overview.tsx` - Added Integrations quick link card

## Decisions Made
- Server Actions call Supabase directly instead of delegating through the core integrations service -- simpler auth flow and avoids double SupabaseClient creation
- Real provider options (Salesforce, HubSpot, SendGrid, etc.) appear in dropdown but show a "Coming soon -- configure credentials in Settings > Secrets" message when selected, per CONTEXT.md guidance
- Business-wide integrations overview is read-only; all editing happens via each agent's Integrations tab to avoid duplicate mutation paths
- Integration config card shows max 3 capability badges with "+N more" overflow to prevent card bloat

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no new external service configuration required. Database migrations (integrations table) were documented in 03-01-SUMMARY.md.

## Next Phase Readiness
- All integration UI surfaces complete for MVP
- Mock adapters fully functional with capabilities and sample data
- Ready for Phase 4 (agent execution) to use integration config for runtime behavior
- Ready for Phase 5 (observability) to track integration usage
- Phase 3 (Deployment Pipeline) now fully complete with all 4 plans executed

## Self-Check: PASSED

- All 6 created files verified present on disk
- Commit def5c12 (Task 1) verified in git log
- Commit ab2426c (Task 2) verified in git log
- `pnpm turbo typecheck` passes across all 4 packages
- `pnpm turbo build` passes with all routes compiling successfully

---
*Phase: 03-deployment-pipeline*
*Completed: 2026-03-25*
