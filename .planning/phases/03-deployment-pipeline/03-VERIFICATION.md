---
phase: 03-deployment-pipeline
verified: 2026-03-26T06:00:00Z
status: human_needed
score: 5/5 must-haves verified
re_verification:
  previous_status: human_needed
  previous_score: 5/5
  gaps_closed:
    - "Deploy button triggers a deployment successfully (DB migrations applied to Supabase)"
    - "Add Mock button creates integration with toast feedback and UI refresh"
    - "Deployment artifacts visible after successful deploy (unblocked by migration application)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Navigate to /businesses/{id}/deployments, click Deploy, wait for completion, select the new deployment"
    expected: "The Generated Artifacts section should show four code blocks: tenant-config.json, docker-compose.generated.yml, .env.generated, and at least one agent-{id}.json runtime config"
    why_human: "Requires live Supabase with migrations applied (done) and agents seeded; need to confirm the full deploy-to-view flow now works end to end"
  - test: "On a live deployment, click Rollback, select a previous version, confirm"
    expected: "A new deployment record is created with the rolled-back version's config, status progresses to live, the old live deployment shows as rolled_back"
    why_human: "Requires at least two successful deployments in the database to test the rollback dialog and service interaction. Was skipped in UAT due to deploy failure that is now fixed."
  - test: "Set ENCRYPTION_KEY in .env.local. Add a secret via /businesses/{id}/settings/secrets. Trigger a new deployment. View the .env.generated artifact."
    expected: "The .env.generated artifact contains the secret key with its decrypted value"
    why_human: "Requires ENCRYPTION_KEY env var set in local environment and a real Supabase connection with secrets table populated; decryption path through deployment service must be verified end-to-end"
---

# Phase 3: Deployment Pipeline Verification Report

**Phase Goal:** Admin can deploy a business's agent stack and the system generates all required artifacts (tenant config, docker-compose, env file, per-agent runtime configs) with versioning, retry, and rollback

**Verified:** 2026-03-26
**Status:** human_needed — all automated checks pass; 3 human tests remain (2 newly unblocked by UAT gap closure)
**Re-verification:** Yes — after UAT gap closure (UNIQUE constraint, error handling, DB migrations applied)

---

## Re-Verification Summary

**Previous status:** human_needed (5/5)
**Current status:** human_needed (5/5)

**What changed since previous verification:**

Three UAT gaps from `03-UAT.md` were diagnosed and resolved via Plan 05 (commit `ac16003`):

1. **Deploy trigger failure** — Root cause: DB migrations 013, 014, 015 not applied to Supabase. The `integrations` table did not exist, causing `triggerDeployment` to throw at line 82. Fixed: user applied all three migrations via Supabase SQL Editor (human-action checkpoint confirmed in 03-05-SUMMARY.md).

2. **Artifacts not visible** — Downstream of gap 1. Deploy pipeline never reached artifact generation (lines 244-265 of `service.ts`). Unblocked by migration application. Code was correct; no code change needed.

3. **Add Mock button silent failure** — Three compounding issues fixed in commit `ac16003`:
   - UNIQUE index `idx_integrations_business_agent_type` added to `014_integrations_table.sql` and `_combined_schema.sql` enabling upsert `onConflict` to work
   - `handleAddMock`, `handleSave`, `handleDelete` in `agent-integrations.tsx` now check `result.error` and call `toast.error()` on failure
   - `router.refresh()` added to all three handlers on success for immediate UI update

All code fixes confirmed in static analysis. DB migration application confirmed by user at human-action checkpoint. The three previous human verification items now include two that are unblocked (deploy flow, rollback flow) and one that remains environment-dependent (secrets + deploy requires `ENCRYPTION_KEY`).

**No regressions detected** in the five passing truths.

---

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin can trigger deploy and redeploy; status progresses through queued, building, deploying, live, or failed | VERIFIED | `deploy-button.tsx` calls `deployAction`; `triggerDeployment` transitions through all states; DB migrations applied unblocking live execution |
| 2 | Each deployment generates four artifact types visible in the UI | VERIFIED | All 4 generators produce output; service stores with underscore keys; `deployment-detail.tsx` reads matching keys and iterates `agent_configs` array; deploy pipeline unblocked by migration application |
| 3 | Failed deployments can be retried; any deployment can be rolled back | VERIFIED | `retryDeploymentAction` and `rollbackDeploymentAction` wired from UI through to service; rollback flow now testable |
| 4 | Each deployment creates a versioned snapshot; deployment history visible | VERIFIED | `createConfigSnapshot` captures full business/agent/dept/integration state; `deployment-list.tsx` renders scrollable history |
| 5 | Secrets encrypted (AES-256-GCM), integration credentials scoped per tenant, 5 mock adapters with swappable interface | VERIFIED | AES-256-GCM with IV+authTag+ciphertext envelope; RLS on secrets and integrations tables; `IntegrationAdapter` interface with `MOCK_ADAPTERS` for 5 types; UNIQUE constraint now enables upsert |

**Score:** 5/5 truths verified

---

## Required Artifacts

### Plan 03-01 Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `packages/runtime/generators/tenant-config.ts` | VERIFIED | Exports `generateTenantConfig`, pure function |
| `packages/runtime/generators/docker-compose.ts` | VERIFIED | Exports `generateDockerCompose`, filters agents by status |
| `packages/runtime/generators/env-file.ts` | VERIFIED | Exports `generateEnvFile`, accepts decrypted secrets |
| `packages/runtime/generators/agent-runtime.ts` | VERIFIED | Exports `generateAgentRuntimeConfig` and `generateAllAgentConfigs` |
| `packages/core/crypto/encryption.ts` | VERIFIED | AES-256-GCM with IV+authTag+ciphertext envelope; graceful error if ENCRYPTION_KEY not set |
| `packages/core/integrations/adapter.ts` | VERIFIED | Exports `IntegrationAdapter` interface |
| `packages/core/integrations/index.ts` | VERIFIED | Exports `getAdapter` factory and `MOCK_ADAPTERS` with 5 entries |
| `packages/db/schema/013_secrets_table.sql` | VERIFIED | `encrypted_value` column, 4 RLS policies |
| `packages/db/schema/014_integrations_table.sql` | VERIFIED | 5-type CHECK constraint, RLS policies, UNIQUE index on `(business_id, agent_id, type)` |

### Plan 03-02 Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `packages/core/deployment/lifecycle.ts` | VERIFIED | `DEPLOYMENT_TRANSITIONS`, `canTransitionDeployment`, `assertDeploymentTransition` all present |
| `packages/core/deployment/service.ts` | VERIFIED | All four functions implemented with full state transitions and error handling |
| `packages/core/deployment/snapshot.ts` | VERIFIED | `ConfigSnapshot` type typed with `{ tenant_config, docker_compose, env_file, agent_configs[] }` |
| `apps/web/_actions/deployment-actions.ts` | VERIFIED | Thin server actions delegating to core service |

### Plan 03-03 Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `apps/web/app/(dashboard)/businesses/[id]/deployments/page.tsx` | VERIFIED | Server Component, renders DeploymentCenter, DeployButton, RollbackDialog |
| `apps/web/_components/deployment-list.tsx` | VERIFIED | Scrollable list with version, StatusBadge, relative timestamp, agent count |
| `apps/web/_components/deployment-detail.tsx` | VERIFIED | Stage timeline, stepper, artifact section using underscore keys and `agent_configs` array iteration |
| `apps/web/_components/deployment-stepper.tsx` | VERIFIED | 4-step horizontal stepper |
| `apps/web/_components/artifact-viewer.tsx` | VERIFIED | Code block with `<pre>`, download button using Blob API |
| `apps/web/_components/deploy-button.tsx` | VERIFIED | One-click first deploy, AlertDialog confirmation for redeploy |
| `apps/web/_components/rollback-dialog.tsx` | VERIFIED | Shows live/rolled_back deployments; calls `rollbackDeploymentAction` |
| `apps/web/app/(dashboard)/businesses/[id]/settings/secrets/page.tsx` | VERIFIED | Server Component fetching secrets, renders SecretsManager |
| `apps/web/_components/secrets-manager.tsx` | VERIFIED | Grouped by category, masked values, add/delete form |

### Plan 03-04 Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `apps/web/_components/agent-integrations.tsx` | VERIFIED | 5 type sections, toast error feedback on all handlers, router.refresh() on success |
| `apps/web/app/(dashboard)/businesses/[id]/integrations/page.tsx` | VERIFIED | Server Component, renders IntegrationsOverview |
| `apps/web/_components/integrations-overview.tsx` | VERIFIED | Groups by type, summary stats |
| `apps/web/_components/integration-config-card.tsx` | VERIFIED | Shows agent name, provider, status, capabilities via adapter |
| `packages/core/integrations/service.ts` | VERIFIED | CRUD service with audit logging |

### Plan 03-05 Artifacts (Gap Closure)

| Artifact | Status | Details |
|----------|--------|---------|
| `packages/db/schema/014_integrations_table.sql` | VERIFIED | UNIQUE index `idx_integrations_business_agent_type` on `(business_id, agent_id, type)` present at line 24 |
| `packages/db/schema/_combined_schema.sql` | VERIFIED | Matching UNIQUE index present (confirmed by grep at line 397) |
| `apps/web/_components/agent-integrations.tsx` | VERIFIED | `toast.error` at lines 173, 186, 199; `router.refresh()` at lines 176, 189, 202; `useRouter` imported at line 4; `toast` imported from `sonner` at line 22 |

---

## Key Link Verification

### Plan 03-01 Key Links

| From | To | Via | Status |
|------|----|-----|--------|
| `packages/core/integrations/index.ts` | mock adapter files | `MOCK_ADAPTERS` registry | WIRED |

### Plan 03-02 Key Links

| From | To | Via | Status |
|------|----|-----|--------|
| `packages/core/deployment/service.ts` | `packages/core/deployment/lifecycle.ts` | `assertDeploymentTransition` (line 2 import) | WIRED |
| `packages/core/deployment/service.ts` | `packages/core/deployment/snapshot.ts` | `createConfigSnapshot` (line 3 import) | WIRED |
| `packages/core/deployment/service.ts` | `packages/core/crypto/encryption.ts` | `decrypt` (line 4 import) | WIRED |
| `packages/core/deployment/service.ts` | `@fleet-factory/runtime` | all 4 generators (lines 5-10 import) | WIRED |
| `apps/web/_actions/deployment-actions.ts` | `packages/core/deployment/service.ts` | via `@fleet-factory/core/server` re-export | WIRED |

### Plan 03-03 Key Links

| From | To | Via | Status |
|------|----|-----|--------|
| `apps/web/_components/deploy-button.tsx` | `apps/web/_actions/deployment-actions.ts` | `deployAction` | WIRED |
| `apps/web/_components/rollback-dialog.tsx` | `apps/web/_actions/deployment-actions.ts` | `rollbackDeploymentAction` | WIRED |
| `apps/web/_components/deployment-detail.tsx` | `apps/web/_actions/deployment-actions.ts` | `retryDeploymentAction` | WIRED |
| `apps/web/_components/secrets-manager.tsx` | `apps/web/_actions/secrets-actions.ts` | `saveSecretAction`, `deleteSecretAction` | WIRED |
| Artifact viewer data flow | `packages/core/deployment/service.ts` to `deployment-detail.tsx` | underscore artifact keys match | WIRED |

### Plan 03-04 and 03-05 Key Links

| From | To | Via | Status |
|------|----|-----|--------|
| `apps/web/_components/agent-integrations.tsx` | `apps/web/_actions/integration-actions.ts` | `saveIntegrationAction` with `result.error` check (lines 172-173, 185-186, 198-199) | WIRED |
| `apps/web/_actions/integration-actions.ts` | Supabase directly | Direct `.upsert()` with `onConflict` backed by UNIQUE constraint | WIRED (documented deviation from service pattern) |
| `apps/web/_components/integration-config-card.tsx` | `packages/core/integrations/index.ts` | `getAdapter(type).getCapabilities()` | WIRED |

---

## Requirements Coverage

All 17 requirements accounted for across 5 plans.

| Requirement | Source Plan | Description | Status | Evidence |
|------------|-------------|-------------|--------|----------|
| DEPL-01 | 03-03 | Deployment center page per business | SATISFIED | Page at `/businesses/[id]/deployments` with split-view |
| DEPL-02 | 03-02, 03-05 | Admin can trigger deploy and redeploy | SATISFIED | `deployAction` pipeline functional; DB migrations applied |
| DEPL-03 | 03-01 | Generates `tenant-config.json` | SATISFIED | `generateTenantConfig` produces JSON; stored as `tenant_config` |
| DEPL-04 | 03-01 | Generates `docker-compose.generated.yml` | SATISFIED | `generateDockerCompose` produces YAML; stored as `docker_compose` |
| DEPL-05 | 03-01 | Generates `.env.generated` | SATISFIED | `generateEnvFile` accepts decrypted secrets; stored as `env_file` |
| DEPL-06 | 03-01 | Generates per-agent runtime config | SATISFIED | `generateAllAgentConfigs` produces configs; stored as `agent_configs` array |
| DEPL-07 | 03-02 | Deployment status tracked (queued, building, deploying, live, failed) | SATISFIED | `DEPLOYMENT_TRANSITIONS` state machine enforced throughout service |
| DEPL-08 | 03-02 | Failed deployments can be retried | SATISFIED | `retryDeployment` verifies failed status, creates fresh deployment |
| DEPL-09 | 03-02 | Rollback to last working version | SATISFIED | `rollbackDeployment` restores from snapshot, marks old as rolled_back |
| DEPL-10 | 03-02 | Agent configs versioned per deployment snapshot | SATISFIED | `createConfigSnapshot` captures full agent/dept/integration state |
| DASH-08 | 03-03 | Deployment center page per business | SATISFIED | Same as DEPL-01 |
| SECR-01 | 03-01 | Secrets encrypted, never plaintext | SATISFIED | AES-256-GCM; `saveSecret` encrypts before insert |
| SECR-02 | 03-01 | Per-tenant credential isolation | SATISFIED | RLS on `secrets` table via `is_business_member(business_id)` |
| INTG-01 | 03-01, 03-04, 03-05 | Integration model with provider, credentials_ref, status per business | SATISFIED | `integrations` table with all required columns; UNIQUE constraint enables upsert |
| INTG-02 | 03-01, 03-04 | Mock adapters for CRM, email, helpdesk, calendar, messaging | SATISFIED | 5 mock adapters with realistic sample data |
| INTG-03 | 03-01, 03-04 | Adapter interface for swappable real connectors | SATISFIED | `IntegrationAdapter` interface; `getAdapter` factory |
| INTG-04 | 03-01, 03-04 | Integration credentials scoped per tenant | SATISFIED | `integrations.business_id` FK with RLS; `agent_id` scopes per-agent |

**No orphaned requirements.** All 17 IDs claimed across plans are present in REQUIREMENTS.md and assigned to Phase 3.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/_components/deployment-detail.tsx` | 157 | `artifacts` cast as `Record<string, string>` — inaccurate since `agent_configs` is an array | WARNING | No functional impact; runtime guard `Array.isArray(artifacts.agent_configs)` at line 310 handles correctly |
| `apps/web/_actions/integration-actions.ts` | 75-135 | Directly queries Supabase instead of delegating to `packages/core/integrations/service.ts` | WARNING | Code duplication. Documented deliberate deviation. Not a functional blocker. |

---

## Human Verification Required

### 1. Full Deploy-to-Artifact Flow (Newly Unblocked)

**Test:** Navigate to `/businesses/{id}/deployments`, click Deploy, wait for status to reach "live", select the completed deployment.

**Expected:** Four code blocks appear in the Generated Artifacts section: tenant-config.json (JSON with tenant/agents/departments), docker-compose.generated.yml (YAML with per-agent services), .env.generated (env vars with BUSINESS_ID/SLUG/VERSION), and one agent-{uuid}.json per agent.

**Why human:** DB migrations have been applied. This test was blocked by missing `integrations` table during UAT — now unblocked. Need to confirm the end-to-end flow produces visible artifacts with realistic content.

### 2. Rollback Flow (Newly Unblocked)

**Test:** With at least two completed deployments for a business (requires Test 1 to succeed first), click the Rollback button, select an older version, confirm.

**Expected:** A new deployment record appears in the history list at the next version number; the previously live deployment shows status "rolled_back"; the new deployment reaches "live".

**Why human:** Was skipped in UAT because deploy was failing. Now that deploy works, this test is unblocked. Requires two prior deployments in the database to populate the rollback dialog.

### 3. Secrets Integration with Deploy

**Test:** Set `ENCRYPTION_KEY` in `.env.local` (generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`). Add a secret via `/businesses/{id}/settings/secrets` (e.g., key: `OPENAI_API_KEY`, value: `sk-test`). Trigger a new deployment. View the .env.generated artifact.

**Expected:** The `.env.generated` artifact contains `OPENAI_API_KEY=sk-test`.

**Why human:** Requires `ENCRYPTION_KEY` env var set in local environment. The deployment service gracefully skips decryption if the key is missing (logs a warning), so the deploy will succeed but secrets will not appear in the artifact without the env var.

---

## Gaps Summary

No automated gaps remain. All 5 success criteria are verified by static analysis.

The three UAT gaps (deploy failure due to missing migrations, artifacts not visible, Add Mock silent failure) have all been resolved:
- DB migrations 013, 014, 015 applied to live Supabase (user action, confirmed in 03-05-SUMMARY.md)
- UNIQUE constraint on `(business_id, agent_id, type)` added to migration 014 and combined schema in commit `ac16003`
- `agent-integrations.tsx` now shows toast errors on failure and refreshes the UI on success, confirmed in commit `ac16003`

The two human tests that were blocked by the deploy failure (Tests 1 and 2 above) are now unblocked and ready to run. Test 3 (secrets) remains environment-dependent and cannot be verified by static analysis.

---

_Verified: 2026-03-26_
_Re-verified after UAT gap closure: 2026-03-26_
_Verifier: Claude (gsd-verifier)_
