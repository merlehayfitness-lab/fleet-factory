---
phase: 03-deployment-pipeline
plan: 01
subsystem: runtime, database, crypto
tags: [aes-256-gcm, encryption, docker-compose, runtime-config, integration-adapters, rls]

# Dependency graph
requires:
  - phase: 01-foundation-and-tenant-provisioning
    provides: "businesses, agents, departments tables with RLS helpers"
  - phase: 02-agent-management
    provides: "agent lifecycle, templates, agent CRUD"
provides:
  - "packages/runtime with 4 pure config generators (tenant-config, docker-compose, env-file, agent-runtime)"
  - "AES-256-GCM encrypt/decrypt functions in packages/core/crypto"
  - "IntegrationAdapter interface with 5 mock adapters (CRM, email, helpdesk, calendar, messaging)"
  - "secrets table with RLS for encrypted credential storage"
  - "integrations table with RLS for per-agent integration config"
  - "deployments table additions (triggered_by, rolled_back_to)"
affects: [03-deployment-pipeline, 04-agent-execution, 05-observability]

# Tech tracking
tech-stack:
  added: ["@types/node (devDep for crypto)"]
  patterns: ["pure function config generators", "AES-256-GCM envelope encryption", "integration adapter interface with mock registry"]

key-files:
  created:
    - packages/runtime/generators/tenant-config.ts
    - packages/runtime/generators/docker-compose.ts
    - packages/runtime/generators/env-file.ts
    - packages/runtime/generators/agent-runtime.ts
    - packages/runtime/index.ts
    - packages/runtime/package.json
    - packages/core/crypto/encryption.ts
    - packages/core/integrations/adapter.ts
    - packages/core/integrations/index.ts
    - packages/core/integrations/mock-crm.ts
    - packages/core/integrations/mock-email.ts
    - packages/core/integrations/mock-helpdesk.ts
    - packages/core/integrations/mock-calendar.ts
    - packages/core/integrations/mock-messaging.ts
    - packages/db/schema/013_secrets_table.sql
    - packages/db/schema/014_integrations_table.sql
    - packages/db/schema/015_deployments_columns.sql
  modified:
    - packages/core/index.ts
    - packages/core/types/index.ts
    - packages/core/package.json
    - packages/db/schema/_combined_schema.sql
    - pnpm-lock.yaml

key-decisions:
  - "Added @types/node to packages/core for Node.js crypto module support"
  - "Pure function generators with string output for maximum testability and portability"
  - "Docker compose YAML built via template literals (no yaml library) for zero dependencies"
  - "Frozen and retired agents excluded from docker-compose generation"

patterns-established:
  - "Config generators as pure functions: typed input -> string output"
  - "Integration adapter interface with factory registry for swappable providers"
  - "Envelope encryption pattern: IV + authTag + ciphertext in base64"
  - "Mock adapters with realistic sample data for development"

requirements-completed: [DEPL-03, DEPL-04, DEPL-05, DEPL-06, SECR-01, SECR-02, INTG-01, INTG-02, INTG-03, INTG-04]

# Metrics
duration: 4min
completed: 2026-03-25
---

# Phase 3 Plan 1: Runtime Config Generators Summary

**Four pure config generators for tenant deployment artifacts, AES-256-GCM encryption for secrets, and integration adapter interface with 5 mock adapters**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-25T22:25:39Z
- **Completed:** 2026-03-25T22:29:48Z
- **Tasks:** 2
- **Files modified:** 23

## Accomplishments
- Created packages/runtime workspace package with 4 config generators (tenant-config.json, docker-compose.yml, .env, per-agent runtime)
- Implemented AES-256-GCM encrypt/decrypt with proper envelope format (IV + authTag + ciphertext)
- Built IntegrationAdapter interface with 5 mock adapters returning realistic sample data
- Added secrets and integrations tables with full RLS (member read, admin write)
- Extended deployments table with triggered_by and rolled_back_to columns

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migrations, encryption helpers, and integration adapters** - `edd2682` (feat)
2. **Task 2: Create packages/runtime with four config generators** - `3568ee2` (feat)

## Files Created/Modified
- `packages/db/schema/013_secrets_table.sql` - Secrets table with encrypted_value column and 4 RLS policies
- `packages/db/schema/014_integrations_table.sql` - Integrations table with 5 type options and RLS
- `packages/db/schema/015_deployments_columns.sql` - Adds triggered_by and rolled_back_to to deployments
- `packages/db/schema/_combined_schema.sql` - Appended 013, 014, 015 migrations
- `packages/core/crypto/encryption.ts` - AES-256-GCM encrypt/decrypt with ENCRYPTION_KEY env var
- `packages/core/types/index.ts` - Added IntegrationType, IntegrationStatus, SecretCategory types
- `packages/core/integrations/adapter.ts` - IntegrationAdapter interface
- `packages/core/integrations/mock-crm.ts` - Mock CRM adapter with contacts and deals sample data
- `packages/core/integrations/mock-email.ts` - Mock email adapter with sent emails sample data
- `packages/core/integrations/mock-helpdesk.ts` - Mock helpdesk adapter with tickets sample data
- `packages/core/integrations/mock-calendar.ts` - Mock calendar adapter with events sample data
- `packages/core/integrations/mock-messaging.ts` - Mock messaging adapter with messages sample data
- `packages/core/integrations/index.ts` - Adapter registry with getAdapter factory
- `packages/core/index.ts` - Added re-exports for crypto, types, and integration modules
- `packages/runtime/package.json` - New workspace package with @agency-factory/core dependency
- `packages/runtime/tsconfig.json` - TypeScript config targeting ES2022
- `packages/runtime/generators/tenant-config.ts` - Generates tenant-config.json from business data
- `packages/runtime/generators/docker-compose.ts` - Generates docker-compose.yml with per-agent services
- `packages/runtime/generators/env-file.ts` - Generates .env with business vars and secrets
- `packages/runtime/generators/agent-runtime.ts` - Generates per-agent runtime config JSON
- `packages/runtime/index.ts` - Re-exports all 5 generator functions

## Decisions Made
- Added `@types/node` to packages/core devDependencies for Node.js crypto module type support (auto-fix, Rule 3)
- All generators are pure functions (typed input -> string output) for maximum testability and portability
- Docker compose YAML built with template literals -- no yaml library dependency
- Frozen and retired agents are excluded from docker-compose generation (only deploy active/provisioning/paused)
- Mock adapters return realistic sample data (named contacts, real-looking tickets, etc.) for development

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed @types/node for Node.js crypto support**
- **Found during:** Task 1 (encryption helpers)
- **Issue:** `node:crypto`, `Buffer`, and `process` not recognized without Node.js type definitions
- **Fix:** Added `@types/node` as devDependency to packages/core
- **Files modified:** packages/core/package.json, pnpm-lock.yaml
- **Verification:** `pnpm turbo typecheck` passes cleanly
- **Committed in:** edd2682 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential for TypeScript compilation of Node.js crypto module. No scope creep.

## Issues Encountered
None beyond the @types/node deviation above.

## User Setup Required

**Database migration required.** Run the following SQL in Supabase SQL Editor:
- `packages/db/schema/013_secrets_table.sql` - Creates secrets table
- `packages/db/schema/014_integrations_table.sql` - Creates integrations table
- `packages/db/schema/015_deployments_columns.sql` - Adds deployment columns

Or re-run the full `packages/db/schema/_combined_schema.sql`.

**ENCRYPTION_KEY environment variable required** for secrets encryption:
```bash
# Generate a key:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Add to .env.local:
ENCRYPTION_KEY=<64-hex-char-key>
```

## Next Phase Readiness
- Config generators ready for deployment job queue (03-02) to call
- Encryption helpers ready for secrets CRUD in deployment service
- Integration adapters ready for agent config enrichment
- Schema migrations ready to apply to Supabase

## Self-Check: PASSED

- All 21 created files verified present on disk
- Commit edd2682 (Task 1) verified in git log
- Commit 3568ee2 (Task 2) verified in git log
- `pnpm turbo typecheck` passes across all 4 packages (core, db, runtime, web)

---
*Phase: 03-deployment-pipeline*
*Completed: 2026-03-25*
