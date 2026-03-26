---
phase: 03-deployment-pipeline
verified: 2026-03-25T23:55:00Z
status: human_needed
score: 5/5 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "Generated artifacts (tenant-config.json, docker-compose.generated.yml, .env.generated, per-agent runtime configs) are viewable inline in the deployment center"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Navigate to /businesses/{id}/deployments, click Deploy, wait for completion, select the new deployment"
    expected: "The Generated Artifacts section should show four code blocks: tenant-config.json, docker-compose.generated.yml, .env.generated, and at least one agent-{id}.json runtime config"
    why_human: "Requires live Supabase connection with agents seeded; need to confirm the full deploy-to-view flow works end to end and artifacts contain realistic content"
  - test: "On a live deployment, click Rollback, select a previous version, confirm"
    expected: "A new deployment record is created with the rolled-back version's config, status progresses to live, the old live deployment shows as rolled_back"
    why_human: "Rollback flow requires live deployments in the database to test the dialog and service interaction"
  - test: "Add a secret on the Secrets page, then trigger a new deployment"
    expected: "The .env.generated artifact in the new deployment includes the secret key (decrypted value should appear in the env file content)"
    why_human: "Requires ENCRYPTION_KEY set in .env.local and a secret pre-saved to test the decrypt-during-deploy path"
---

# Phase 3: Deployment Pipeline Verification Report

**Phase Goal:** Admin can deploy a business's agent stack and the system generates all required artifacts (tenant config, docker-compose, env file, per-agent runtime configs) with versioning, retry, and rollback

**Verified:** 2026-03-25
**Status:** human_needed — all automated checks pass; 3 human tests remain
**Re-verification:** Yes — after gap closure (artifact viewer key mismatch fixed)

---

## Re-Verification Summary

**Previous status:** gaps_found (4/5)
**Current status:** human_needed (5/5)

The gap identified in the initial verification has been confirmed fixed:

- **Gap closed:** `apps/web/_components/deployment-detail.tsx` previously looked for artifact keys using hyphen format (`artifacts["tenant-config"]`, `artifacts["docker-compose"]`, `artifacts["env-file"]`) and scanned for flat `agent-*` prefix keys. The service stores artifacts using underscore format (`tenant_config`, `docker_compose`, `env_file`) and agent configs as an array under `agent_configs`.

- **Fix verified:** Lines 288-320 of `deployment-detail.tsx` now read `artifacts.tenant_config`, `artifacts.docker_compose`, `artifacts.env_file`, and iterate `artifacts.agent_configs` as an array with `{ agent_id, filename, content }` fields. These keys match exactly what `packages/core/deployment/service.ts` stores at lines 248-255. The per-agent mapping in the UI (`ac.agent_id`, `ac.filename`, `ac.content`) aligns with what the service stores (`agent_id: ac.agentId`, `filename: ac.filename`, `content: ac.content`).

- **No regressions detected** in the other four passing truths during regression check.

---

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin can trigger deploy and redeploy; status progresses through queued, building, deploying, live, or failed | VERIFIED | `deploy-button.tsx` calls `deployAction`; `triggerDeployment` transitions through all states in service; deployment page renders status |
| 2 | Each deployment generates four artifact types visible in the UI | VERIFIED | Generators produce all 4 types; service stores with underscore keys; `deployment-detail.tsx` now reads matching keys and iterates `agent_configs` array correctly |
| 3 | Failed deployments can be retried; any deployment can be rolled back | VERIFIED | `retryDeploymentAction` and `rollbackDeploymentAction` wired from UI through to service; `rollback-dialog.tsx` shows previous live/rolled_back deployments |
| 4 | Each deployment creates a versioned snapshot; deployment history visible | VERIFIED | `createConfigSnapshot` captures full business/agent/dept/integration state at deploy time; `deployment-list.tsx` renders scrollable history with version, status, config diff |
| 5 | Secrets encrypted (AES-256-GCM), integration credentials scoped per tenant, 5 mock adapters with swappable interface | VERIFIED | `encrypt`/`decrypt` use AES-256-GCM with IV+authTag+ciphertext envelope; RLS on secrets and integrations tables; `IntegrationAdapter` interface with `MOCK_ADAPTERS` registry for CRM, email, helpdesk, calendar, messaging |

**Score:** 5/5 truths verified

---

## Required Artifacts

### Plan 03-01 Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `packages/runtime/generators/tenant-config.ts` | VERIFIED | Exports `generateTenantConfig`, pure function returning JSON string |
| `packages/runtime/generators/docker-compose.ts` | VERIFIED | Exports `generateDockerCompose`, filters retired/frozen agents, builds YAML via template literals |
| `packages/runtime/generators/env-file.ts` | VERIFIED | Exports `generateEnvFile`, accepts decrypted secrets array |
| `packages/runtime/generators/agent-runtime.ts` | VERIFIED | Exports `generateAgentRuntimeConfig` and `generateAllAgentConfigs` |
| `packages/core/crypto/encryption.ts` | VERIFIED | Exports `encrypt`/`decrypt` using AES-256-GCM with proper IV+authTag+ciphertext format |
| `packages/core/integrations/adapter.ts` | VERIFIED | Exports `IntegrationAdapter` interface with `testConnection`, `getCapabilities`, `getSampleData` |
| `packages/core/integrations/index.ts` | VERIFIED | Exports `getAdapter` factory and `MOCK_ADAPTERS` record with 5 entries |
| `packages/db/schema/013_secrets_table.sql` | VERIFIED | `encrypted_value` column present, 4 RLS policies (select_member, insert/update/delete_admin) |
| `packages/db/schema/014_integrations_table.sql` | VERIFIED | 5-type CHECK constraint, RLS policies, business_id FK |

### Plan 03-02 Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `packages/core/deployment/lifecycle.ts` | VERIFIED | `DEPLOYMENT_TRANSITIONS`, `canTransitionDeployment`, `assertDeploymentTransition`, `getValidDeploymentTransitions` all present |
| `packages/core/deployment/service.ts` | VERIFIED | `triggerDeployment`, `retryDeployment`, `rollbackDeployment`, `getDeploymentHistory` implemented with full state transitions and error handling |
| `packages/core/deployment/snapshot.ts` | VERIFIED | `ConfigSnapshot` type, `createConfigSnapshot`, `restoreFromSnapshot` exported; artifacts field typed as `{ tenant_config, docker_compose, env_file, agent_configs[] }` |
| `apps/web/_actions/deployment-actions.ts` | VERIFIED | `deployAction`, `retryDeploymentAction`, `rollbackDeploymentAction`, `getDeploymentsAction` — thin server actions delegating to core service |

### Plan 03-03 Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `apps/web/app/(dashboard)/businesses/[id]/deployments/page.tsx` | VERIFIED | Server Component fetches business, deployments (limit 50), agent count; renders DeploymentCenter, DeployButton, RollbackDialog |
| `apps/web/_components/deployment-list.tsx` | VERIFIED | Scrollable list with version, StatusBadge, relative timestamp, agent count, config diff summary |
| `apps/web/_components/deployment-detail.tsx` | VERIFIED (gap fixed) | Stage timeline and stepper render correctly; artifact section now uses matching underscore keys (`tenant_config`, `docker_compose`, `env_file`) and iterates `agent_configs` array |
| `apps/web/_components/deployment-stepper.tsx` | VERIFIED | 4-step horizontal stepper with correct status-to-step mapping, pulsing active indicator, fail/rollback states |
| `apps/web/_components/artifact-viewer.tsx` | VERIFIED | Code block with `<pre>`, download button using Blob API |
| `apps/web/_components/deploy-button.tsx` | VERIFIED | One-click for first deploy, AlertDialog confirmation for redeploy; calls `deployAction` |
| `apps/web/_components/rollback-dialog.tsx` | VERIFIED | Shows live/rolled_back deployments as selectable list; calls `rollbackDeploymentAction` with selected version |
| `apps/web/app/(dashboard)/businesses/[id]/settings/secrets/page.tsx` | VERIFIED | Server Component fetching secrets, renders SecretsManager |
| `apps/web/_components/secrets-manager.tsx` | VERIFIED | Grouped by category, masked values, reveal shows "Value stored securely", add/delete form, calls `saveSecretAction`/`deleteSecretAction` |

### Plan 03-04 Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `apps/web/_components/agent-integrations.tsx` | VERIFIED | 5 type sections, provider dropdown, capabilities from adapter, sample data preview, calls `saveIntegrationAction` |
| `apps/web/app/(dashboard)/businesses/[id]/integrations/page.tsx` | VERIFIED | Server Component fetching all integrations with agent names, renders IntegrationsOverview |
| `apps/web/_components/integrations-overview.tsx` | VERIFIED | Groups by type, summary stats, IntegrationConfigCard per integration |
| `apps/web/_components/integration-config-card.tsx` | VERIFIED | Shows agent name (link), provider, status, capabilities via `getAdapter(type).getCapabilities()` |
| `packages/core/integrations/service.ts` | VERIFIED | `getIntegrationsForAgent`, `getIntegrationsForBusiness`, `upsertIntegration`, `deleteIntegration` with audit logging |

---

## Key Link Verification

### Plan 03-01 Key Links

| From | To | Via | Status |
|------|----|-----|--------|
| `packages/runtime/generators/agent-runtime.ts` | `packages/core/integrations/adapter.ts` | references `IntegrationType` | NOT WIRED (by design) — runtime generators define their own local interfaces to avoid circular dep; `IntegrationType` string union is compatible but not imported. Functionally correct. |
| `packages/core/integrations/index.ts` | `packages/core/integrations/mock-crm.ts` | registry maps `MockCrmAdapter` | WIRED — registry imports all 5 mock adapters |

### Plan 03-02 Key Links

| From | To | Via | Status |
|------|----|-----|--------|
| `packages/core/deployment/service.ts` | `packages/core/deployment/lifecycle.ts` | `assertDeploymentTransition` | WIRED — line 2: `import { assertDeploymentTransition }` |
| `packages/core/deployment/service.ts` | `packages/core/deployment/snapshot.ts` | `createConfigSnapshot` | WIRED — line 3: `import { createConfigSnapshot }` |
| `packages/core/deployment/service.ts` | `packages/core/crypto/encryption.ts` | `decrypt` | WIRED — line 4: `import { decrypt }` |
| `packages/core/deployment/service.ts` | `@agency-factory/runtime` | all 4 generators | WIRED — lines 6-10: imports `generateTenantConfig`, `generateDockerCompose`, `generateEnvFile`, `generateAllAgentConfigs` |
| `apps/web/_actions/deployment-actions.ts` | `packages/core/deployment/service.ts` | via `@agency-factory/core/server` | WIRED — imports from `@agency-factory/core/server` which re-exports all 4 deployment service functions |

### Plan 03-03 Key Links

| From | To | Via | Status |
|------|----|-----|--------|
| `apps/web/_components/deploy-button.tsx` | `apps/web/_actions/deployment-actions.ts` | `deployAction` | WIRED |
| `apps/web/_components/rollback-dialog.tsx` | `apps/web/_actions/deployment-actions.ts` | `rollbackDeploymentAction` | WIRED |
| `apps/web/_components/deployment-detail.tsx` | `apps/web/_actions/deployment-actions.ts` | `retryDeploymentAction` | WIRED |
| `apps/web/_components/secrets-manager.tsx` | `apps/web/_actions/secrets-actions.ts` | `saveSecretAction`, `deleteSecretAction` | WIRED |
| **Artifact viewer data flow** | `packages/core/deployment/service.ts` → `deployment-detail.tsx` | underscore artifact keys | WIRED — UI reads `artifacts.tenant_config`, `artifacts.docker_compose`, `artifacts.env_file`; service stores exactly those keys. Per-agent iteration uses `artifacts.agent_configs` array with `{ agent_id, filename, content }` fields that match service output. |

### Plan 03-04 Key Links

| From | To | Via | Status |
|------|----|-----|--------|
| `apps/web/_components/agent-integrations.tsx` | `apps/web/_actions/integration-actions.ts` | `saveIntegrationAction` | WIRED |
| `apps/web/_actions/integration-actions.ts` | `packages/core/integrations/service.ts` | `upsertIntegration` | NOT WIRED — documented deviation in SUMMARY: actions call Supabase directly. The service exists and is exported but not used in the web actions. Functionality is equivalent, audit logging is duplicated. Not a functional blocker. |
| `apps/web/_components/integration-config-card.tsx` | `packages/core/integrations/index.ts` | `getAdapter` | WIRED |

---

## Requirements Coverage

All 17 requirements accounted for in PLAN frontmatter across the 4 plans. All are marked complete in REQUIREMENTS.md.

| Requirement | Source Plan | Description | Status | Evidence |
|------------|-------------|-------------|--------|----------|
| DEPL-01 | 03-03 | Deployment center page per business | SATISFIED | Page at `/businesses/[id]/deployments` with split-view, history, status |
| DEPL-02 | 03-02 | Admin can trigger deploy and redeploy | SATISFIED | `deployAction` → `triggerDeployment` pipeline functional |
| DEPL-03 | 03-01 | Generates `tenant-config.json` | SATISFIED | `generateTenantConfig` produces correct output; stored in snapshot as `tenant_config` |
| DEPL-04 | 03-01 | Generates `docker-compose.generated.yml` | SATISFIED | `generateDockerCompose` produces per-agent YAML; stored in snapshot as `docker_compose` |
| DEPL-05 | 03-01 | Generates `.env.generated` | SATISFIED | `generateEnvFile` accepts decrypted secrets; stored in snapshot as `env_file` |
| DEPL-06 | 03-01 | Generates per-agent runtime config | SATISFIED | `generateAgentRuntimeConfig`/`generateAllAgentConfigs` produces agent configs; stored in snapshot as `agent_configs` array |
| DEPL-07 | 03-02 | Deployment status tracked (queued, building, deploying, live, failed) | SATISFIED | `DEPLOYMENT_TRANSITIONS` state machine enforced throughout service |
| DEPL-08 | 03-02 | Failed deployments can be retried | SATISFIED | `retryDeployment` verifies failed status, creates fresh deployment |
| DEPL-09 | 03-02 | Rollback to last working version | SATISFIED | `rollbackDeployment` restores from previous snapshot, marks old as rolled_back |
| DEPL-10 | 03-02 | Agent configs versioned per deployment snapshot | SATISFIED | `createConfigSnapshot` captures full agent/dept/integration state plus generated artifacts |
| DASH-08 | 03-03 | Deployment center page per business | SATISFIED | See DEPL-01 above |
| SECR-01 | 03-01 | Secrets encrypted, never plaintext | SATISFIED | AES-256-GCM with envelope format; `saveSecret` encrypts before insert |
| SECR-02 | 03-01 | Per-tenant credential isolation | SATISFIED | RLS on `secrets` table uses `is_business_member(business_id)` |
| INTG-01 | 03-01/03-04 | Integration model with provider, credentials_ref, status per business | SATISFIED | `integrations` table with `provider`, `status`, `business_id`, `agent_id`, `config` |
| INTG-02 | 03-01/03-04 | Mock adapters for CRM, email, helpdesk, calendar, messaging | SATISFIED | 5 mock adapters in `packages/core/integrations/` with realistic sample data |
| INTG-03 | 03-01/03-04 | Adapter interface for swappable real connectors | SATISFIED | `IntegrationAdapter` interface; `getAdapter` factory; real provider options in UI show "coming soon" |
| INTG-04 | 03-01/03-04 | Integration credentials scoped per tenant | SATISFIED | `integrations.business_id` FK with RLS; `agent_id` scopes further per-agent |

**No orphaned requirements.** All 17 IDs claimed in plan frontmatter are present in REQUIREMENTS.md and assigned to Phase 3.

---

## Anti-Patterns Found

| File | Issue | Severity | Impact |
|------|-------|----------|--------|
| `apps/web/_components/deployment-detail.tsx` line 157 | Type cast `as Record<string, string>` is technically inaccurate — `agent_configs` is an array, not a string. However the code guards with `Array.isArray(artifacts.agent_configs)` at runtime, so this works correctly. TypeScript may produce a type narrowing warning. | WARNING | No functional impact; runtime guard handles it correctly |
| `apps/web/_actions/integration-actions.ts` | Directly queries Supabase instead of delegating to `packages/core/integrations/service.ts` as planned | WARNING | Code duplication between service and actions; audit logging is duplicated. Not a functional blocker — documented deliberate deviation. |

---

## Human Verification Required

### 1. Full Deploy-to-Artifact Flow

**Test:** Create or use a business with agents. Navigate to `/businesses/{id}/deployments`, click Deploy, wait for status to reach "live", select the completed deployment.

**Expected:** Four code blocks appear in the Generated Artifacts section: tenant-config.json (JSON with tenant/agents/departments), docker-compose.generated.yml (YAML with per-agent services), .env.generated (env vars with BUSINESS_ID/SLUG/VERSION), and one agent-{uuid}.json per agent.

**Why human:** Requires live Supabase connection with agents seeded; need to confirm artifacts contain realistic content and the section renders correctly end to end.

### 2. Rollback Flow

**Test:** With at least two live/completed deployments for a business, click the Rollback button, select an older version, confirm.

**Expected:** A new deployment record appears in the history list at the next version number; the previously live deployment shows status "rolled_back"; the new deployment reaches "live".

**Why human:** Requires multiple prior deployments in the database to populate the rollback dialog.

### 3. Secrets Integration with Deploy

**Test:** Set `ENCRYPTION_KEY` in `.env.local`. Add a secret via `/businesses/{id}/settings/secrets` (e.g., key: `OPENAI_API_KEY`, value: `sk-test`). Trigger a new deployment. View the .env.generated artifact.

**Expected:** The `.env.generated` artifact contains `OPENAI_API_KEY=sk-test` (the decrypted value).

**Why human:** Requires `ENCRYPTION_KEY` env var set and a real Supabase connection with secrets table populated; decryption path through deployment service must be verified end-to-end.

---

## Gaps Summary

No automated gaps remain. All 5 success criteria are verified by static analysis:

1. The original gap (artifact key mismatch) is confirmed fixed. The UI and service now use the same underscore convention (`tenant_config`, `docker_compose`, `env_file`, `agent_configs`), and the per-agent config array iteration correctly reads `{ agent_id, filename, content }` fields.

2. All other success criteria were already verified in the initial pass and show no regressions.

The remaining items are human-only verification (live browser + Supabase tests), not code gaps.

---

_Verified: 2026-03-25_
_Re-verified after gap closure: 2026-03-25_
_Verifier: Claude (gsd-verifier)_
