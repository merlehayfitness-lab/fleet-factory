---
phase: 13-secrets-management-ux
plan: 01
subsystem: database, api
tags: [secrets, encryption, provider-credentials, test-connection, supabase, server-actions]

# Dependency graph
requires:
  - phase: 03-deployment-pipeline
    provides: "secrets table, encryption helpers, integration adapters"
  - phase: 12-integrations-catalog-setup
    provides: "INTEGRATION_CATALOG with 15 providers, integration table with department scope"
provides:
  - "provider_credential_fields table with seed data for 15 providers"
  - "secrets.provider column for provider-scoped credential grouping"
  - "getSecretsByProvider, revealSecret, saveProviderCredentials, deleteProviderSecrets service functions"
  - "testConnection mock service with per-provider switch/case structure"
  - "Server actions for provider fields, reveal, test connection, provider credential CRUD"
affects: [13-02-PLAN, 13-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: [provider-scoped credential grouping, auto-integration management on credential save/delete]

key-files:
  created:
    - packages/db/schema/039_provider_credential_fields.sql
    - packages/db/schema/040_secrets_provider_column.sql
    - packages/core/secrets/test-connection.ts
  modified:
    - packages/db/schema/_combined_schema.sql
    - packages/core/secrets/service.ts
    - packages/core/server.ts
    - apps/web/_actions/secrets-actions.ts

key-decisions:
  - "Provider credential field definitions stored in DB (not hardcoded TypeScript constants) per user decision -- enables dynamic forms"
  - "saveProviderCredentials auto-creates/activates integration record, deleteProviderSecrets deactivates to mock"
  - "testConnection uses switch/case with mock success for all 15 providers -- real implementations slot in per case"
  - "Provider-scoped unique index on (business_id, provider, key) WHERE provider IS NOT NULL preserves backward compatibility"

patterns-established:
  - "Provider-scoped upsert: onConflict uses business_id,provider,key for provider credentials"
  - "Auto-integration lifecycle: saving credentials auto-creates/activates integration; deleting deactivates to mock"
  - "Credential field definitions are global (not per-tenant) with RLS SELECT-only for authenticated users"

requirements-completed: [SECR-ENH-01, SECR-ENH-03]

# Metrics
duration: 4min
completed: 2026-03-29
---

# Phase 13 Plan 01: Schema & Service Foundation Summary

**Provider credential field definitions for 15 providers, extended secrets service with provider-scoped CRUD and auto-integration management, mock test connection service, and server actions**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-30T00:34:39Z
- **Completed:** 2026-03-30T00:38:39Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created provider_credential_fields table with seed data for all 15 integration catalog providers (HubSpot, Salesforce, Pipedrive, SendGrid, Mailgun, SES, Zendesk, Freshdesk, Intercom, Google Calendar, Outlook Calendar, Calendly, Slack, Teams, Discord)
- Extended secrets service with 4 new functions: getSecretsByProvider (grouped queries), revealSecret (server-side decrypt), saveProviderCredentials (encrypt + upsert + auto-integration), deleteProviderSecrets (delete + deactivate integration)
- Created test connection service with mock success responses and TODO markers for real API pings per provider
- Added 7 new server actions exposing all functionality to the frontend

## Task Commits

Each task was committed atomically:

1. **Task 1: Database migrations for provider credential fields and secrets provider column** - `e224710` (feat)
2. **Task 2: Extended secrets service, test connection module, and server actions** - `b8ee8c3` (feat)

## Files Created/Modified
- `packages/db/schema/039_provider_credential_fields.sql` - Provider credential field definitions table with seed data for all 15 providers
- `packages/db/schema/040_secrets_provider_column.sql` - Add nullable provider column to secrets table with provider-scoped unique index
- `packages/db/schema/_combined_schema.sql` - Appended both new migrations
- `packages/core/secrets/service.ts` - Extended with getSecretsByProvider, revealSecret, saveProviderCredentials, deleteProviderSecrets
- `packages/core/secrets/test-connection.ts` - Mock test connection service with per-provider switch/case
- `packages/core/server.ts` - Re-exports for new secrets and test connection functions
- `apps/web/_actions/secrets-actions.ts` - 7 new server actions for provider fields, reveal, test, save, delete, grouped fetch

## Decisions Made
- Provider credential field definitions stored in DB (not hardcoded TypeScript) per user decision -- enables dynamic forms driven by database queries
- saveProviderCredentials auto-creates/activates integration record; deleteProviderSecrets deactivates to mock status -- keeps integration state in sync with credential presence
- testConnection returns mock success for all 15 providers with clear TODO comments for real API implementations
- Provider-scoped unique index uses WHERE provider IS NOT NULL to preserve backward compatibility with legacy secrets that have no provider

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing typecheck errors in agent-tree-view.tsx (Phase 11 gap closure uncommitted work) -- not caused by this plan, documented as out of scope

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Foundation layer complete for Plans 13-02 (Settings page UI with provider-grouped secrets) and 13-03 (credential side drawer on Integrations page)
- All server actions ready for frontend consumption
- Test connection service ready for real implementations when API keys are available

## Self-Check: PASSED

All files verified present. All commits verified in git log.

---
*Phase: 13-secrets-management-ux*
*Completed: 2026-03-29*
