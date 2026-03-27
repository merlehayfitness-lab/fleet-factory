# Phase 3: Deployment Pipeline — Research

**Researched:** 2026-03-25
**Phase Goal:** Admin can deploy a business's agent stack and the system generates all required artifacts (tenant config, docker-compose, env file, per-agent runtime configs) with versioning, retry, and rollback

## 1. Existing Schema & Infrastructure

### Database Tables Already Exist
- `deployments` table has: id, business_id, version (int), status (queued|building|deploying|live|failed|rolled_back), config_snapshot (jsonb), error_message, started_at, completed_at, created_at
- RLS policies already allow member SELECT, owner/admin INSERT and UPDATE
- Provision RPC already creates a version=1 queued deployment per business
- `DeploymentStatus` type exported from `@agency-factory/core`

### Missing Schema Elements
- **No `secrets` table** — need to store encrypted secrets per business
- **No `integrations` table** — need to store integration config (provider, credentials_ref, status) per agent
- **No `deployment_artifacts` table** — could store generated artifact content per deployment, or store in config_snapshot jsonb
- **Deployments table lacks**: `triggered_by` (user who triggered), `rolled_back_to` (version pointer for rollback tracking)

### Existing Code Patterns
- Server Actions pattern: thin action in `apps/web/_actions/`, delegates to service in `packages/core/`
- Supabase client created via `createServerClient()` from `@/_lib/supabase/server`
- Environment variables accessed via helper in `@/_lib/env.ts`
- Agent service uses `transitionAgentStatus()` and `updateAgentConfig()` patterns with audit logging
- Business sub-routes use `(dashboard)/businesses/[id]/` layout with RLS-gated access check

## 2. Architecture Decisions

### Config Generation (packages/runtime)
The `packages/runtime` directory doesn't exist yet. Needs to be created with pure functions that generate:

1. **tenant-config.json** — Business metadata, department list, agent roster, deployment version
2. **docker-compose.generated.yml** — Service definitions for the agent runtime (OpenClaw workers)
3. **.env.generated** — Environment variables for the deployed tenant (decrypted secrets, connection strings)
4. **Per-agent runtime config** — agent-{id}.json with system_prompt, tool_profile, model_profile, integration references

All generators should be pure functions: `(businessData, agents, secrets, integrations) => string`

### Deployment Job Flow
For MVP, deployment is a synchronous server-side process (not a separate worker):
1. Admin triggers deploy → creates deployment row (queued)
2. Server Action transitions to `building` → runs config generators
3. Transitions to `deploying` → stores artifacts in config_snapshot jsonb
4. Transitions to `live` + snapshots all agent configs
5. On error at any stage → transitions to `failed` with error_message

No actual Docker deployment in MVP — we generate the artifacts and store them. Real VPS push is a later concern.

### Versioning & Rollback
- Each deployment auto-increments version from the last deployment for that business
- `config_snapshot` jsonb stores the full snapshot of all agent configs at deploy time
- Rollback = create a NEW deployment with the config_snapshot from a previous successful deployment, re-run generators
- Retry = create a new deployment using current live state (re-fetch agents/config)

### Secrets Management
- New `secrets` table: id, business_id, key (text), encrypted_value (text), category (api_key|credential|token), integration_type (optional), created_at, updated_at
- AES-256-GCM encryption using app-level key from `ENCRYPTION_KEY` env var
- Encryption/decryption functions in `packages/core/crypto/` — never store plaintext
- RLS: member can SELECT (but encrypted value is opaque), owner/admin can INSERT/UPDATE/DELETE
- Decryption only happens server-side during deployment artifact generation

### Integration Adapters
- New `integrations` table: id, business_id, agent_id, provider (text), type (crm|email|helpdesk|calendar|messaging), config (jsonb), status (active|inactive|mock), created_at, updated_at
- Adapter interface in `packages/core/integrations/adapter.ts`:
  ```typescript
  interface IntegrationAdapter {
    type: string;
    provider: string;
    testConnection(): Promise<boolean>;
    getCapabilities(): string[];
  }
  ```
- Mock adapters return realistic sample data — no external calls
- Provider selection: mock (default) → real provider (future, just needs credential swap)

## 3. UI Architecture

### New Routes Needed
- `/businesses/[id]/deployments` — Deployment center (main Phase 3 page)
- `/businesses/[id]/integrations` — Business-wide integrations overview
- `/businesses/[id]/settings/secrets` — Secrets management page

### Deployment Center (CONTEXT decisions)
- **Split view**: left panel = deployment list/history, right panel = selected deployment details
- **Status stepper**: Queued → Building → Deploying → Live (with failed state branching)
- **Artifact viewer**: inline code blocks with download buttons for each generated file
- **Deploy button**: first deploy = one-click, redeploy = confirmation dialog with diff
- **Retry**: button on failed deployments with option to edit config first
- **Rollback**: pick any previous successful deployment from history

### Secrets Page (CONTEXT decisions)
- Categorized form: grouped by type (API keys, credentials, tokens)
- Masked by default, eye icon reveals for 10 seconds
- Accessible from deployment center via quick link

### Agent Integrations Tab
- New tab on agent detail page: "Integrations"
- Per-agent integration config: dropdown for provider (Mock, Salesforce, etc.)
- Selecting real provider shows credential fields

## 4. Plan Breakdown Strategy

Based on roadmap's suggested plan split:

### Plan 03-01: Config Generation Pure Functions (Wave 1)
- Create `packages/runtime/` package
- Implement 4 generators as pure TypeScript functions
- Schema migration for secrets + integrations tables
- Encryption helpers in `packages/core/crypto/`
- Integration adapter interface + 5 mock adapters
- No UI — pure backend/library work

### Plan 03-02: Deployment Job Queue & Status (Wave 1, parallel with 03-01)
- Deployment service in `packages/core/deployment/`
- Deploy, retry, rollback Server Actions
- Status transition state machine (like agent lifecycle)
- Version auto-increment logic
- Config snapshot creation/restoration
- Audit logging for all deployment actions

### Plan 03-03: Deployment Center UI + Secrets + Integrations (Wave 2, depends on 01+02)
- Deployment center page with split view layout
- Status stepper component
- Artifact viewer with code blocks
- Deploy/retry/rollback actions wired to Server Actions
- Secrets management page with encryption
- Integration overview page
- Agent detail "Integrations" tab
- Enable nav links for deployments route

## 5. Technical Considerations

### Encryption Implementation
- Use Node.js `crypto` module with AES-256-GCM
- Key from `ENCRYPTION_KEY` env var (32 bytes, hex-encoded)
- Each encrypted value stores IV + auth tag + ciphertext as a single base64 string
- Decryption only in server-side code paths, never exposed to client

### SQL Migration
New tables need to be added to `_combined_schema.sql` and applied via Supabase SQL editor:
- `secrets` table with RLS
- `integrations` table with RLS
- Additional columns on `deployments` (triggered_by, etc.)

### State Machine for Deployments
Similar to agent lifecycle, deployments need valid transition rules:
- queued → building
- building → deploying | failed
- deploying → live | failed
- failed → queued (retry)
- live → rolled_back (only when a newer deployment goes live)
- Any → queued (redeploy creates new record)

### Config Snapshot Design
`config_snapshot` jsonb stores:
```json
{
  "version": 2,
  "business": { "id": "...", "name": "...", "slug": "..." },
  "agents": [{ "id": "...", "name": "...", "system_prompt": "...", "tool_profile": {}, "model_profile": {} }],
  "departments": [...],
  "integrations": [...],
  "generated_at": "ISO timestamp"
}
```

## 6. Requirement Coverage

| Requirement | Covered By |
|-------------|-----------|
| DEPL-01 | Plan 03-03 (deployment center UI with history) |
| DEPL-02 | Plan 03-02 (deploy action) + Plan 03-03 (UI trigger) |
| DEPL-03 | Plan 03-01 (tenant-config.json generator) |
| DEPL-04 | Plan 03-01 (docker-compose generator) |
| DEPL-05 | Plan 03-01 (.env generator) |
| DEPL-06 | Plan 03-01 (per-agent runtime config generator) |
| DEPL-07 | Plan 03-02 (status tracking state machine) |
| DEPL-08 | Plan 03-02 (retry logic) + Plan 03-03 (retry UI) |
| DEPL-09 | Plan 03-02 (rollback logic) + Plan 03-03 (rollback UI) |
| DEPL-10 | Plan 03-02 (config_snapshot versioning) |
| DASH-08 | Plan 03-03 (deployment center page) |
| SECR-01 | Plan 03-01 (encryption helpers) + Plan 03-03 (secrets page) |
| SECR-02 | Plan 03-01 (RLS on secrets table) |
| INTG-01 | Plan 03-01 (integrations table + model) |
| INTG-02 | Plan 03-01 (5 mock adapters) |
| INTG-03 | Plan 03-01 (adapter interface) |
| INTG-04 | Plan 03-01 (RLS + encrypted credentials) |

All 17 requirements covered across 3 plans.

## RESEARCH COMPLETE
