# Roadmap: Agency Factory

## Overview

Agency Factory delivers a multi-tenant SaaS platform for deploying and managing AI agent stacks for client businesses. The roadmap follows a strict dependency chain: tenant isolation and provisioning first (the foundation everything builds on), then agent management (what gets deployed), then the deployment pipeline (how it gets deployed), then live operations with task execution and approvals (agents doing real work), then observability and the command center (seeing and directing what agents do), and finally the builder service (automating agent configuration at scale). Each phase delivers a complete, verifiable capability that unlocks the next.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation and Tenant Provisioning** - Auth, RLS isolation, atomic business provisioning, and core admin screens
- [x] **Phase 2: Agent Management** - Template-based agent lifecycle with list and detail views (completed 2026-03-25)
- [x] **Phase 3: Deployment Pipeline** - Config generation, deployment execution, secrets, and integration adapters (completed 2026-03-26)
- [ ] **Phase 4: Task Execution and Approvals** - Orchestrator routing, worker execution, approval gates, and security controls
- [ ] **Phase 5: Observability and Command Center** - Tenant health monitoring, audit viewer, chat interface, and emergency controls
- [ ] **Phase 6: Builder and Automation** - Claude-powered config generation, cross-tenant template rollout, and versioning

## Phase Details

### Phase 1: Foundation and Tenant Provisioning
**Goal**: Admin can sign in, create a business tenant in one atomic flow, and see the provisioned workspace with departments -- all scoped by RLS so tenants never see each other's data
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, ISOL-01, ISOL-02, ISOL-03, ISOL-04, ISOL-05, PROV-01, PROV-02, PROV-03, PROV-04, PROV-05, PROV-06, DASH-01, DASH-02, DASH-03, DASH-04, DASH-05
**Success Criteria** (what must be TRUE):
  1. User can sign in with email/password, stay signed in across browser refresh, sign out, and unauthenticated users are redirected to sign-in
  2. Creating a business through the wizard atomically provisions the business, owner membership, 4 default departments, starter agents from templates, and a queued deployment job -- with no partial state on failure
  3. A user belonging to Business A sees zero rows from Business B across all operational tables (RLS enforced via is_business_member)
  4. Admin can view the businesses list, business overview dashboard with health indicators, and departments setup page for any business they belong to
  5. Re-running provisioning for the same business does not create duplicate records (idempotent-safe)
**Plans**: TBD

Plans:
- [ ] 01-01: Monorepo scaffold, database schema, and RLS policies
- [ ] 01-02: Supabase Auth setup, sign-in page, and route protection
- [ ] 01-03: Atomic provisioning RPC and create business wizard
- [ ] 01-04: Admin shell with businesses list, overview dashboard, and departments page

### Phase 2: Agent Management
**Goal**: Admin can view and manage the full lifecycle of template-based agents across departments within a business
**Depends on**: Phase 1
**Requirements**: AGNT-01, AGNT-02, AGNT-03, AGNT-04, AGNT-05, AGNT-06, DASH-06, DASH-07
**Success Criteria** (what must be TRUE):
  1. Agent templates exist with system_prompt, tool_profile, and model_profile per department_type, and agents can only be created from these templates
  2. Admin can view the agents list page showing all agents for a business with status, department, and template info
  3. Admin can view an agent detail page showing config, lifecycle status, recent activity, and conversation history
  4. Admin can freeze an agent immediately, which stops its execution and revokes tool access
**Plans**: TBD

Plans:
- [ ] 02-01: Agent templates, agent service, and lifecycle status management
- [ ] 02-02: Agents list page and agent detail page

### Phase 3: Deployment Pipeline
**Goal**: Admin can deploy a business's agent stack and the system generates all required artifacts (tenant config, docker-compose, env file, per-agent runtime configs) with versioning, retry, and rollback
**Depends on**: Phase 2
**Requirements**: DEPL-01, DEPL-02, DEPL-03, DEPL-04, DEPL-05, DEPL-06, DEPL-07, DEPL-08, DEPL-09, DEPL-10, DASH-08, SECR-01, SECR-02, INTG-01, INTG-02, INTG-03, INTG-04
**Success Criteria** (what must be TRUE):
  1. Admin can trigger deploy and redeploy from the deployment center and see status progress through queued, building, deploying, live, or failed
  2. Each deployment generates four artifact types: tenant-config.json, docker-compose.generated.yml, .env.generated, and one runtime config per agent
  3. Failed deployments can be retried, and any deployment can be rolled back to the last working version
  4. Each deployment creates a versioned snapshot of all agent configs, and deployment history is visible in the deployment center
  5. Secrets are stored encrypted (never plaintext), integration credentials are scoped per tenant, and mock adapters exist for CRM, email, helpdesk, calendar, and messaging with a swappable adapter interface
**Plans**: 5 plans (4 original + 1 gap closure)

Plans:
- [ ] 03-01: Schema migrations (secrets, integrations), encryption helpers, integration adapters, and packages/runtime config generators
- [ ] 03-02: Deployment state machine, deploy/retry/rollback service, config snapshots, and Server Actions
- [ ] 03-03: Deployment center UI (split-view, stepper, artifact viewer), secrets page, and nav updates
- [ ] 03-04: Per-agent Integrations tab on agent detail page and business-wide integrations overview page
- [ ] 03-05: UAT gap closure — UNIQUE constraint, error handling fixes, and Supabase migration application

### Phase 4: Task Execution and Approvals
**Goal**: Tasks flow through the orchestrator to department agents, agents execute with sandboxed tool access, and risky actions pause for human approval with risk-tiered routing
**Depends on**: Phase 3
**Requirements**: TASK-01, TASK-02, TASK-03, TASK-04, TASK-05, TASK-06, APRV-01, APRV-02, APRV-03, APRV-04, APRV-05, APRV-06, APRV-07, DASH-09, SECR-03, SECR-04, SECR-05, TOPS-04
**Success Criteria** (what must be TRUE):
  1. Admin can create a task via the admin panel or API, and the orchestrator routes it to the appropriate department agent based on type and priority
  2. Agents execute tasks with sandboxed tool access (no host filesystem, restricted mounts) validated against tenant-scoped allowlists, and agents never run with service_role credentials
  3. Risky agent actions pause execution and create approval requests with risk-tiered routing (low auto-run, medium async review, high synchronous approval)
  4. Admin can approve or reject gated actions from the tasks and approvals page, with all decisions logged in audit_logs with full context
  5. Tasks track status through queued, assigned, in_progress, completed, and failed -- and token consumption and cost are metered per tenant per agent
**Plans**: TBD

Plans:
- [ ] 04-01: Orchestrator service (Paperclip) with task routing and decomposition
- [ ] 04-02: Worker service (OpenClaw) with sandboxed tool execution
- [ ] 04-03: Approval gates, policy rules, escalation, and tasks/approvals page
- [ ] 04-04: Usage metering and security hardening

### Phase 5: Observability and Command Center
**Goal**: Admin has full operational visibility into tenant health, agent activity, and conversation history, and can interact with agents through a unified chat interface with emergency controls
**Depends on**: Phase 4
**Requirements**: TOPS-01, TOPS-02, TOPS-03, TOPS-05, COMM-01, COMM-02, COMM-03, DASH-10, DASH-11, SECR-06
**Success Criteria** (what must be TRUE):
  1. Per-tenant health dashboard shows agent status, error rates, task throughput, and deployment state with all logs and metrics tagged and filterable by business_id
  2. Audit log viewer shows full action history per business, searchable and filterable by actor and event type
  3. Command center chat routes messages to the appropriate agent via the orchestrator, and conversation transcripts are stored with full tool call traces
  4. Conversation log viewer shows history filterable by agent, department, and date
  5. Emergency controls (freeze agent, revoke tools, disable tenant) take effect immediately without affecting other tenants
**Plans**: TBD

Plans:
- [ ] 05-01: Per-tenant health dashboard and observability infrastructure
- [ ] 05-02: Audit log viewer and tenant kill switch
- [ ] 05-03: Command center chat, conversation storage, and log viewer

### Phase 6: Builder and Automation
**Goal**: A Claude-powered builder service generates agent configs and deployment artifacts from templates, with version tracking, security validation, and the ability to roll improvements out to future tenants
**Depends on**: Phase 3, Phase 4
**Requirements**: BLDR-01, BLDR-02, BLDR-03, BLDR-04, BLDR-05
**Success Criteria** (what must be TRUE):
  1. Builder service generates agent configs (system prompt, tool profile, model profile) from templates via Claude API
  2. Builder service generates deployment artifacts (docker-compose, env, runtime configs) from tenant state
  3. Template improvements roll out to future tenants automatically, with prompt/config versioning tracking changes across deployments with diff capability
  4. All generated configs are validated against security allowlists before deployment
**Plans**: TBD

Plans:
- [ ] 06-01: Builder service with Claude-powered config and artifact generation
- [ ] 06-02: Template versioning, cross-tenant rollout, and security validation

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation and Tenant Provisioning | 0/4 | Not started | - |
| 2. Agent Management | 0/2 | Complete    | 2026-03-25 |
| 3. Deployment Pipeline | 4/5 | UAT gap closure | - |
| 4. Task Execution and Approvals | 0/4 | Not started | - |
| 5. Observability and Command Center | 0/3 | Not started | - |
| 6. Builder and Automation | 0/2 | Not started | - |
