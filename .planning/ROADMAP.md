# Roadmap: Agency Factory

## Overview

Agency Factory delivers a multi-tenant SaaS platform for deploying and managing AI agent stacks for client businesses. The admin web app deploys to Vercel; agent runtime runs on a Hostinger VPS via Claude Code + OpenClaw. The roadmap follows a strict dependency chain: tenant isolation and provisioning first (the foundation everything builds on), then agent management (what gets deployed), then the deployment pipeline (how it gets deployed), then live operations with task execution and approvals (agents doing real work), then observability and the command center (seeing and directing what agents do), then OpenClaw-native VPS deployment with live routing (making agents real), then RAG knowledge bases (making agents smart), and finally role definition and prompt generation (making agent setup easy). Each phase delivers a complete, verifiable capability that unlocks the next.

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
- [ ] **Phase 6: OpenClaw Deployment & Live VPS Runtime** - OpenClaw-native artifacts, VPS deployment via Claude Code, live task/chat routing to real agents
- [ ] **Phase 7: RAG Knowledge Base** - pgvector, document upload/embedding, two-tier knowledge (global + per-agent), runtime retrieval
- [ ] **Phase 8: Role Definition & Prompt Generation** - Plain-language role definition, Claude-powered prompt generation, wizard update

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
- [x] 03-05: UAT gap closure -- UNIQUE constraint, error handling fixes, and Supabase migration application

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
**Plans**: 3 plans

Plans:
- [ ] 05-01: Schema migrations (conversations, messages), health service, enhanced dashboard with agent grid and auto-refresh polling, nav updates
- [ ] 05-02: Emergency service, type-to-confirm dialog, audit log viewer (timeline/table), conversation log viewer, emergency controls on dashboard, tenant kill switch
- [ ] 05-03: Chat service with stub responses, Slack-like chat UI with department channels, message routing, typing indicator, file upload

### Phase 6: OpenClaw Deployment & Live VPS Runtime
**Goal**: Admin app deploys OpenClaw-native agent workspaces to a Hostinger VPS via Claude Code, and all tasks/chat from the admin app route to real agents running on the VPS
**Depends on**: Phase 3, Phase 4, Phase 5
**Requirements**: DEPL-VPS-01, DEPL-VPS-02, DEPL-VPS-03, DEPL-VPS-04, DEPL-VPS-05, DEPL-VPS-06, DEPL-VPS-07, DEPL-VPS-08, DEPL-VPS-09, DEPL-VPS-10, LIVE-01, LIVE-02, LIVE-03, LIVE-04, LIVE-05
**Success Criteria** (what must be TRUE):
  1. Deployment pipeline generates OpenClaw-native workspace artifacts and pushes them to VPS via REST API
  2. Claude Code on VPS receives packages, optimizes workspace files, deploys agent containers, and reports back a diff of what it changed
  3. Each agent runs in its own isolated always-on Docker container with persistent memory across redeployments
  4. Tasks created in admin app execute on real VPS agents and results flow back to Supabase
  5. Chat messages from admin app reach real VPS agents and responses flow back in real-time
  6. VPS health check visible in admin dashboard, graceful degradation when VPS unreachable
**Plans**: 4 plans

Plans:
- [ ] 06-01: OpenClaw workspace generators, VPS client module, and database schema (AGENTS.md, SOUL.md, openclaw.json, VPS types, HTTP client, health check, vps_status + agent_vps_status tables)
- [ ] 06-02: VPS deployment pipeline, health checks, and deployment UI (push to VPS, post-deploy verification, rollback, per-agent deploy, status indicator, progress stream, diff viewer)
- [ ] 06-03: Live task/chat routing to VPS agents (replace mock execution and stub responses, WebSocket chat streaming, graceful degradation, inter-agent messaging)
- [ ] 06-04: VPS API proxy server, bootstrap prompt, and infrastructure scripts (Express proxy, route handlers, Claude Code bootstrap, setup script, Docker Compose)

### Phase 7: RAG Knowledge Base
**Goal**: Agents become business-specific domain experts through two-tier knowledge: global business-wide docs and per-agent role-specific docs, with document upload, embedding, and automatic retrieval at runtime
**Depends on**: Phase 6
**Requirements**: RAG-01, RAG-02, RAG-03, RAG-04, RAG-05, RAG-06, RAG-07
**Success Criteria** (what must be TRUE):
  1. pgvector enabled with knowledge_documents, knowledge_chunks, and knowledge_retrievals tables with RLS
  2. Admin can upload documents globally (business-wide) or per-agent, with async chunking and embedding pipeline
  3. Semantic similarity search retrieves relevant chunks scoped by business_id and agent_id
  4. Knowledge synced from Supabase to VPS for fast local retrieval
  5. Retrieved context automatically prepended to agent system prompt before model call
  6. Knowledge Base UI on agent config tab shows global inherited docs + agent-specific upload zones with indexing status
**Plans**: TBD

Plans:
- [ ] 07-01: pgvector schema, embedding pipeline, and retrieval service
- [ ] 07-02: Knowledge Base UI (upload zones, indexing status, agent config integration)
- [ ] 07-03: VPS knowledge sync and runtime injection

### Phase 8: Role Definition & Prompt Generation
**Goal**: Admin describes agent roles in plain language and Claude generates production-quality system prompts, with an updated setup wizard that includes knowledge upload
**Depends on**: Phase 7
**Requirements**: ROLE-01, ROLE-02, ROLE-03, ROLE-04
**Success Criteria** (what must be TRUE):
  1. Role Definition card on agent config accepts plain-language description, tone, and focus
  2. Claude generates system prompt from role definition and previews it before saving
  3. Agent setup wizard includes knowledge upload step with global + per-agent zones
  4. Role Definition and System Prompt cards work together (generate → preview → edit → save)
**Plans**: TBD

Plans:
- [ ] 08-01: Role Definition card, Claude prompt generator, and wizard update

---

## Milestone 2 (v2): Scale & Self-Serve

**Prerequisite**: Phases 1-8 (MVP) complete and deployed.

These are post-MVP capabilities identified during the Phase 1-8 build. They are listed here for planning purposes — scoping and phase breakdown will happen when v2 begins.

### v2 Themes

**Theme A: Client-Facing Portal**
- Self-serve business onboarding wizard (business owners sign up and provision their own workspace)
- Simplified business owner view (read-only dashboard, task submission, conversation access — not the full admin panel)
- Per-business branding/white-label options

**Theme B: Billing & Monetization**
- Stripe integration for subscription billing
- Usage-based billing tied to existing metering (Phase 4)
- Plan tiers (free trial, starter, pro, enterprise)
- Per-tenant API key provisioning and rotation UI

**Theme C: Hardening & Governance**
- OAuth/social login + MFA/2FA
- SSO/SAML for enterprise tenants
- Advanced SLOs, regression testing, and compliance tooling
- Per-business role overrides for approval risk policies

**Theme D: Horizontal Scaling**
- Multi-VPS strategy (what happens when one Hostinger VPS hits capacity)
- Tenant-to-VPS assignment and migration
- Load balancing across VPS fleet
- Per-tenant dedicated VPS option for enterprise

**Theme E: Vertical Expansion**
- Industry-specific template packs (lawn care, real estate, e-commerce, etc.)
- Deep third-party integrations (replace mock adapters with real CRM, email, helpdesk connectors)
- Marketplace for community-contributed agent templates

---

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation and Tenant Provisioning | 0/4 | Not started | - |
| 2. Agent Management | 0/2 | Complete    | 2026-03-25 |
| 3. Deployment Pipeline | 5/5 | Complete | 2026-03-26 |
| 4. Task Execution and Approvals | 0/4 | Not started | - |
| 5. Observability and Command Center | 0/3 | Not started | - |
| 6. OpenClaw Deployment & Live VPS Runtime | 0/4 | Not started | - |
| 7. RAG Knowledge Base | 0/3 | Not started | - |
| 8. Role Definition & Prompt Generation | 0/1 | Not started | - |
