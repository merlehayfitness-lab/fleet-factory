# Requirements: Agency Factory

**Defined:** 2026-03-25
**Core Value:** One-click tenant provisioning that creates an isolated business workspace with department agents, deployment pipeline, and a command center to manage it all.

## v1 Requirements

### Authentication

- [x] **AUTH-01**: User can sign in with email and password via Supabase Auth
- [x] **AUTH-02**: User session persists across browser refresh
- [x] **AUTH-03**: User can sign out and session is invalidated
- [x] **AUTH-04**: Unauthenticated users are redirected to sign-in page

### Tenant Isolation

- [x] **ISOL-01**: RLS enabled on all operational tables with `is_business_member()` helper function
- [x] **ISOL-02**: Users can only read/write rows for businesses they belong to via business_users membership
- [x] **ISOL-03**: Write operations gated by role (owner, admin, manager) on sensitive tables
- [x] **ISOL-04**: Agent templates table is globally readable but admin-only writable
- [x] **ISOL-05**: Tenant kill switch can disable a business (freeze agents, block deployments, revoke access) without affecting other tenants

### Business Provisioning

- [x] **PROV-01**: Admin can create a new business via create business wizard (name, slug, industry, departments, integrations, deployment target)
- [x] **PROV-02**: Business creation uses atomic Postgres RPC (business + membership + departments + agents + deployment job in one transaction)
- [x] **PROV-03**: 4 default departments seeded per business (Owner, Sales, Support, Operations)
- [x] **PROV-04**: Starter agents created from matching agent_templates per department
- [x] **PROV-05**: Deployment job created with status 'queued' upon provisioning
- [x] **PROV-06**: Provisioning is idempotent-safe (re-running does not create duplicates)

### Agent Management

- [x] **AGNT-01**: Agent templates store system_prompt, tool_profile, and model_profile per department_type
- [x] **AGNT-02**: Admin can view list of agents per business with status, department, and template info
- [x] **AGNT-03**: Admin can view agent detail page with config, status, recent activity, and conversation history
- [x] **AGNT-04**: Agents track lifecycle status (provisioning, active, paused, error, retired)
- [x] **AGNT-05**: Admin can freeze an agent immediately (emergency control — stops execution, revokes tool access)
- [x] **AGNT-06**: Agents are created only from approved templates (no dynamic spawning by end users)

### Deployment Pipeline

- [ ] **DEPL-01**: Deployment center shows current version, status, and deployment history per business
- [ ] **DEPL-02**: Admin can trigger deploy and redeploy from deployment center
- [x] **DEPL-03**: Deployment runner generates tenant-config.json per business
- [x] **DEPL-04**: Deployment runner generates docker-compose.generated.yml per business
- [x] **DEPL-05**: Deployment runner generates .env.generated per business
- [x] **DEPL-06**: Deployment runner generates one runtime config file per agent (prompt, tools, model)
- [ ] **DEPL-07**: Deployment status tracked (queued, building, deploying, live, failed)
- [ ] **DEPL-08**: Failed deployments can be retried
- [ ] **DEPL-09**: Deployments support rollback to last working version
- [ ] **DEPL-10**: Agent configs are versioned — each deployment creates a new version snapshot

### Task Execution

- [ ] **TASK-01**: Tasks can be created via admin panel or API with title, payload, priority, and target agent/department
- [ ] **TASK-02**: Orchestrator service (Paperclip) routes tasks to appropriate department agent based on type and priority
- [ ] **TASK-03**: Worker service (OpenClaw) executes agent tasks with allowed tools from tool_profile
- [ ] **TASK-04**: Tasks track status (queued, assigned, in_progress, completed, failed)
- [ ] **TASK-05**: Tasks page shows work queue across all departments for a business
- [ ] **TASK-06**: Webhook/event ingestion endpoint accepts inbound events from external systems to create tasks

### Approvals & Governance

- [ ] **APRV-01**: Risky agent actions create approval requests that pause execution
- [ ] **APRV-02**: Admin can approve or reject gated actions from approvals page
- [ ] **APRV-03**: Risk-tiered approval routing: low-risk auto-run, medium-risk async review, high-risk synchronous approval
- [ ] **APRV-04**: Policy rules gate irreversible actions (spending money, deleting data, changing integrations, modifying production)
- [ ] **APRV-05**: Agent confidence thresholds trigger escalation to human when uncertainty is high
- [ ] **APRV-06**: Escalation paths defined: agent → manager → admin → owner
- [ ] **APRV-07**: All approval decisions logged in audit_logs with full context

### Security

- [x] **SECR-01**: Secrets stored encrypted, never plaintext in database or config files
- [x] **SECR-02**: Per-tenant credential isolation — one business cannot access another's secrets
- [ ] **SECR-03**: Agent execution sandboxed — no host filesystem access, no elevated exec, restricted mounts
- [ ] **SECR-04**: Tool access validated against tenant-scoped allowlists before execution
- [ ] **SECR-05**: Agents never run with service_role credentials
- [ ] **SECR-06**: Emergency controls: freeze agent, revoke tools, disable tenant — all take effect immediately

### Tenant Operations

- [ ] **TOPS-01**: Per-tenant health dashboard showing agent status, error rates, task throughput, and deployment state
- [ ] **TOPS-02**: All logs, metrics, and traces tagged with business_id and filterable per tenant
- [ ] **TOPS-03**: Audit log viewer shows full action history per business (searchable, filterable by actor/event type)
- [ ] **TOPS-04**: Internal usage metering tracks token consumption and cost per tenant per agent
- [ ] **TOPS-05**: Tenant kill switch disables business without affecting other tenants

### Dashboard & UI

- [x] **DASH-01**: Sign-in page
- [x] **DASH-02**: Businesses list page showing all businesses with status badges
- [x] **DASH-03**: Create business wizard (multi-step: name/industry → departments → integrations → deploy target)
- [x] **DASH-04**: Business overview dashboard (health, active agents, pending approvals, recent activity, deployment status, quick links)
- [x] **DASH-05**: Departments setup page per business
- [x] **DASH-06**: Agents list page per business
- [x] **DASH-07**: Agent detail page (config, status, activity, conversations)
- [ ] **DASH-08**: Deployment center page per business
- [ ] **DASH-09**: Tasks and approvals page per business
- [ ] **DASH-10**: Command center chat interface with routing to agents via orchestrator
- [ ] **DASH-11**: Conversation log viewer with transcript history and tool call traces

### Communication

- [ ] **COMM-01**: Command center chat routes messages to appropriate agent via orchestrator
- [ ] **COMM-02**: Conversation transcripts stored per agent with full tool call traces
- [ ] **COMM-03**: Conversation log viewer shows history filterable by agent, department, and date

### Builder & Automation

- [ ] **BLDR-01**: Builder service generates agent configs (system prompt, tool profile, model profile) from templates via Claude API
- [ ] **BLDR-02**: Builder service generates deployment artifacts (docker-compose, .env, runtime configs) from tenant state
- [ ] **BLDR-03**: Template improvements can be rolled out to future tenants automatically
- [ ] **BLDR-04**: Prompt/config versioning tracks changes across deployments with diff capability
- [ ] **BLDR-05**: Generated configs validated against security allowlists before deployment

### Integrations

- [x] **INTG-01**: Integration model supports provider, credentials_ref, and status per business
- [x] **INTG-02**: Mock/stub adapters for CRM, email, helpdesk, calendar, and messaging in MVP
- [x] **INTG-03**: Integration adapter interface designed for swappable real connectors later
- [x] **INTG-04**: Integration credentials scoped per tenant and stored encrypted

## v2 Requirements

### Advanced Auth

- **AUTH-V2-01**: OAuth/social login (Google, GitHub, Microsoft) via Supabase
- **AUTH-V2-02**: SSO/SAML for enterprise customers
- **AUTH-V2-03**: MFA/2FA support

### Advanced Operations

- **OPS-V2-01**: Customer-facing billing with per-tenant usage-based pricing
- **OPS-V2-02**: Tenant migration tools (export/import business data)
- **OPS-V2-03**: Multi-region deployment support
- **OPS-V2-04**: Agent evaluation tooling (A/B testing prompts, quality scoring)

### Advanced Agents

- **AGNT-V2-01**: Dynamic agent spawning by end users (after permissions/rollback mature)
- **AGNT-V2-02**: Custom department creation by end users
- **AGNT-V2-03**: Agent-to-agent communication within a department
- **AGNT-V2-04**: Agent memory/context persistence across conversations

### Advanced Integrations

- **INTG-V2-01**: Real OAuth2-based integration connectors (CRM, email, helpdesk, calendar)
- **INTG-V2-02**: Webhook outbound notifications for external system events
- **INTG-V2-03**: Knowledge base management per department

## Out of Scope

| Feature | Reason |
|---------|--------|
| Dynamic agent spawning by end users | Wait until logs, permissions, and rollback are solid |
| Visual workflow / flow builder | Massive engineering effort, not core to agent management |
| Per-agent customer-facing billing | Premature before product-market fit |
| Mobile app | Web-first command center |
| Multi-LLM model marketplace | Complexity without proven demand; default Claude Sonnet |
| Real-time WebSocket everything | Server Actions and polling sufficient for admin operations |
| Custom department creation by end users | Fragments template ecosystem; admin-only via templates |
| Multi-region deployment | Single VPS with Docker for MVP |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| ISOL-01 | Phase 1 | Complete |
| ISOL-02 | Phase 1 | Complete |
| ISOL-03 | Phase 1 | Complete |
| ISOL-04 | Phase 1 | Complete |
| ISOL-05 | Phase 1 | Complete |
| PROV-01 | Phase 1 | Complete |
| PROV-02 | Phase 1 | Complete |
| PROV-03 | Phase 1 | Complete |
| PROV-04 | Phase 1 | Complete |
| PROV-05 | Phase 1 | Complete |
| PROV-06 | Phase 1 | Complete |
| DASH-01 | Phase 1 | Complete |
| DASH-02 | Phase 1 | Complete |
| DASH-03 | Phase 1 | Complete |
| DASH-04 | Phase 1 | Complete |
| DASH-05 | Phase 1 | Complete |
| AGNT-01 | Phase 2 | Complete |
| AGNT-02 | Phase 2 | Complete |
| AGNT-03 | Phase 2 | Complete |
| AGNT-04 | Phase 2 | Complete |
| AGNT-05 | Phase 2 | Complete |
| AGNT-06 | Phase 2 | Complete |
| DASH-06 | Phase 2 | Complete |
| DASH-07 | Phase 2 | Complete |
| DEPL-01 | Phase 3 | Pending |
| DEPL-02 | Phase 3 | Pending |
| DEPL-03 | Phase 3 | Complete |
| DEPL-04 | Phase 3 | Complete |
| DEPL-05 | Phase 3 | Complete |
| DEPL-06 | Phase 3 | Complete |
| DEPL-07 | Phase 3 | Pending |
| DEPL-08 | Phase 3 | Pending |
| DEPL-09 | Phase 3 | Pending |
| DEPL-10 | Phase 3 | Pending |
| DASH-08 | Phase 3 | Pending |
| SECR-01 | Phase 3 | Complete |
| SECR-02 | Phase 3 | Complete |
| INTG-01 | Phase 3 | Complete |
| INTG-02 | Phase 3 | Complete |
| INTG-03 | Phase 3 | Complete |
| INTG-04 | Phase 3 | Complete |
| TASK-01 | Phase 4 | Pending |
| TASK-02 | Phase 4 | Pending |
| TASK-03 | Phase 4 | Pending |
| TASK-04 | Phase 4 | Pending |
| TASK-05 | Phase 4 | Pending |
| TASK-06 | Phase 4 | Pending |
| APRV-01 | Phase 4 | Pending |
| APRV-02 | Phase 4 | Pending |
| APRV-03 | Phase 4 | Pending |
| APRV-04 | Phase 4 | Pending |
| APRV-05 | Phase 4 | Pending |
| APRV-06 | Phase 4 | Pending |
| APRV-07 | Phase 4 | Pending |
| DASH-09 | Phase 4 | Pending |
| SECR-03 | Phase 4 | Pending |
| SECR-04 | Phase 4 | Pending |
| SECR-05 | Phase 4 | Pending |
| TOPS-04 | Phase 4 | Pending |
| TOPS-01 | Phase 5 | Pending |
| TOPS-02 | Phase 5 | Pending |
| TOPS-03 | Phase 5 | Pending |
| TOPS-05 | Phase 5 | Pending |
| COMM-01 | Phase 5 | Pending |
| COMM-02 | Phase 5 | Pending |
| COMM-03 | Phase 5 | Pending |
| DASH-10 | Phase 5 | Pending |
| DASH-11 | Phase 5 | Pending |
| SECR-06 | Phase 5 | Pending |
| BLDR-01 | Phase 6 | Pending |
| BLDR-02 | Phase 6 | Pending |
| BLDR-03 | Phase 6 | Pending |
| BLDR-04 | Phase 6 | Pending |
| BLDR-05 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 78 total
- Mapped to phases: 78
- Unmapped: 0

---
*Requirements defined: 2026-03-25*
*Last updated: 2026-03-25 after roadmap creation*
