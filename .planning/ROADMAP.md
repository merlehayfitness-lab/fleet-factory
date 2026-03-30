# Roadmap: Agency Factory

## Overview

Agency Factory delivers a multi-tenant SaaS platform for deploying and managing AI agent stacks for client businesses. The admin web app deploys to Vercel; agent runtime runs on a Hostinger VPS via Claude Code + OpenClaw. The roadmap follows a strict dependency chain: tenant isolation and provisioning first (the foundation everything builds on), then agent management (what gets deployed), then the deployment pipeline (how it gets deployed), then live operations with task execution and approvals (agents doing real work), then observability and the command center (seeing and directing what agents do), then OpenClaw-native VPS deployment with live routing (making agents real), then RAG knowledge bases (making agents smart), and finally role definition and prompt generation (making agent setup easy). Each phase delivers a complete, verifiable capability that unlocks the next.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation and Tenant Provisioning** - Auth, RLS isolation, atomic business provisioning, and core admin screens (completed 2026-03-25)
- [x] **Phase 2: Agent Management** - Template-based agent lifecycle with list and detail views (completed 2026-03-25)
- [x] **Phase 3: Deployment Pipeline** - Config generation, deployment execution, secrets, and integration adapters (completed 2026-03-26)
- [x] **Phase 4: Task Execution and Approvals** - Orchestrator routing, worker execution, approval gates, and security controls (completed 2026-03-26)
- [x] **Phase 5: Observability and Command Center** - Tenant health monitoring, audit viewer, chat interface, and emergency controls (completed 2026-03-27)
- [x] **Phase 6: OpenClaw Deployment & Live VPS Runtime** - OpenClaw-native artifacts, VPS deployment via Claude Code, live task/chat routing to real agents (completed 2026-03-27)
- [x] **Phase 7: RAG Knowledge Base** - pgvector, document upload/embedding, two-tier knowledge (global + per-agent), runtime retrieval (completed 2026-03-27)
- [x] **Phase 8: Role Definition & Prompt Generation** - Plain-language role definition, Claude-powered prompt/SKILL.md generation, multi-agent departments, wizard update (completed 2026-03-27)
- [x] **Phase 9: Skill Management & Deployment** - Skill editor UI, GitHub repo import, department-level skills, skill template library (completed 2026-03-28)
- [x] **Phase 10: Template Profiles & Model Configuration** - Tool/Model Profile JSON on templates, model dropdown on agent config (completed 2026-03-29)
- [x] **Phase 11: Sub-Agent Management** - Sub-agent creation under departments, visual hierarchy tree UI (completed 2026-03-30)
- [x] **Phase 12: Integrations Catalog & Setup** - Integration catalog with add button, department/agent assignment, AI-generated setup guides (completed 2026-03-29)
- [x] **Phase 13: Secrets Management UX** - Integration-first secrets flow, dynamic credential fields, grouped secrets page (completed 2026-03-30)
- [ ] **Phase 14: Slack Integration & Chat Replacement** - Slack API routing, embedded feed in admin panel, replace custom chat
- [ ] **Phase 15: AITMPL Template Catalog** - Wizard suggestions for Skills/Agents/Commands/Settings/Hooks/MCPs/Plugins from AITMPL
- [x] **Phase 16: Tenant Disable Fix & Dashboard Freeze** - Fix 404 on disable, frozen dashboard banner, stop VPS activity (completed 2026-03-30)
- [ ] **Phase 17: VPS Activation & Embedded Terminal** - First real VPS deployment, gear icon to terminal page, embedded SSH terminal

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
- [x] 06-01: OpenClaw workspace generators, VPS client module, and database schema (AGENTS.md, SOUL.md, openclaw.json, VPS types, HTTP client, health check, vps_status + agent_vps_status tables)
- [x] 06-02: VPS deployment pipeline, health checks, and deployment UI (push to VPS, post-deploy verification, rollback, per-agent deploy, status indicator, progress stream, diff viewer)
- [x] 06-03: Live task/chat routing to VPS agents (replace mock execution and stub responses, WebSocket chat streaming, graceful degradation, inter-agent messaging)
- [x] 06-04: VPS API proxy server, bootstrap prompt, and infrastructure scripts (Express proxy, route handlers, Claude Code bootstrap, setup script, Docker Compose)

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
**Goal**: Admin describes agent roles in plain language, Claude generates production-quality system prompts AND SKILL.md files, departments support multiple agents with parent-child hierarchy, and an updated setup wizard includes knowledge upload
**Depends on**: Phase 7
**Requirements**: ROLE-01, ROLE-02, ROLE-03, ROLE-04, ROLE-05, ROLE-06
**Success Criteria** (what must be TRUE):
  1. Role Definition card on agent config accepts plain-language description, tone, and focus
  2. Claude generates system prompt AND SKILL.md from role definition and previews both before saving
  3. Agent setup wizard includes knowledge upload step with agent-specific zones
  4. Role Definition and System Prompt cards work together (generate -> preview -> edit -> save)
  5. Departments support multiple agents with parent-child hierarchy (lead + sub-agents with role field)
  6. SKILL.md stored on agent record and deployable to VPS as workspace artifact
**Plans**: TBD

Plans:
- [ ] 08-01: Role Definition card, Claude prompt generator, and Config Tab UI
- [ ] 08-02: Multi-agent departments (parent-child hierarchy, role field, UI updates)
- [ ] 08-03: Agent setup wizard with knowledge upload, SKILL.md generation, and sub-agent support

### Phase 9: Skill Management & Deployment
**Goal**: Admin can create, edit, import, and assign skills to agents and departments through a dedicated skill management interface
**Depends on**: Phase 8
**Requirements**: SKILL-01, SKILL-02, SKILL-03, SKILL-04
**Success Criteria** (what must be TRUE):
  1. Skill editor UI allows creating and editing SKILL.md files with structured sections
  2. Skills can be imported from GitHub repository URLs
  3. Department-level skills can be assigned and inherited by all agents in that department
  4. Skill template library provides curated starter skills per department/role type
**Plans**: 3 plans

Plans:
- [ ] 09-01: Schema, skill service, skill compiler, GitHub import service, deployment pipeline integration
- [ ] 09-02: Skill editor UI, assignment list, Skills tab on agent detail, skill count badge
- [ ] 09-03: Template library browser, GitHub import dialog, standalone library page, department skills panel, sidebar nav

### Phase 10: Template Profiles & Model Configuration
**Goal**: Agent templates have editable Tool Profile and Model Profile (optional JSONB), and the Model Profile on agent config is changeable via dropdown instead of static display
**Depends on**: Phase 9
**Requirements**: TMPL-01, TMPL-02, TMPL-03, TMPL-04
**Success Criteria** (what must be TRUE):
  1. Agent templates store optional tool_profile (JSONB) defining available tools and MCP configurations
  2. Agent templates store optional model_profile (JSONB) defining model selection and parameters (temperature, max tokens, etc.)
  3. Model Profile on agent config page is changeable via dropdown with available models (Opus, Sonnet, Haiku, etc.)
  4. Tool/Model Profile JSON is editable via structured form or raw JSON editor on template and agent config pages
**Plans**: TBD

Plans:
- [ ] 10-01: TBD

### Phase 11: Sub-Agent Management
**Goal**: Departments clearly support adding and managing sub-agents with a visual hierarchy tree (e.g., Owner > CEO, Sales > Paid Ads, Support > HR)
**Depends on**: Phase 10
**Requirements**: SUBAG-01, SUBAG-02, SUBAG-03
**Success Criteria** (what must be TRUE):
  1. Sub-agents can be created under any department lead agent with named roles
  2. Agent tree UI visualizes parent-child hierarchy within departments on the agents page
  3. Agent list and detail pages show hierarchy grouping with collapsible department sections
**Plans**: 3 plans (2 original + 1 gap closure)

Plans:
- [x] 11-01: Reparent service, tree data components, SVG lines, agents page and wizard updates
- [x] 11-02: Sidebar panel, drag-and-drop reparenting, responsive mobile fallback
- [x] 11-03: UAT gap closure -- Unified org chart layout, box nodes, elbow connectors, DnD hydration fix

### Phase 12: Integrations Catalog & Setup
**Goal**: Admin can add integrations from a browsable catalog, assign them to specific departments or agents, and get AI-generated setup instructions
**Depends on**: Phase 11
**Requirements**: INTG-ENH-01, INTG-ENH-02, INTG-ENH-03, INTG-ENH-04
**Success Criteria** (what must be TRUE):
  1. "Add Integration" button at top of integrations page opens a browsable catalog of available integrations (Slack, Stripe, HubSpot, etc.)
  2. Adding an integration assigns it to a specific department or individual agent
  3. AI-generated setup instructions appear based on selected integration type and quick research
  4. Category field auto-populates based on integration selection
**Plans**: TBD

Plans:
- [ ] 12-01: TBD

### Phase 13: Secrets Management UX
**Goal**: Integration-first secrets flow where choosing the integration determines what credential fields are needed, accessible from both the dedicated secrets page and business settings
**Depends on**: Phase 12
**Requirements**: SECR-ENH-01, SECR-ENH-02, SECR-ENH-03, SECR-ENH-04
**Success Criteria** (what must be TRUE):
  1. Secrets flow starts with integration selection — category auto-fills, relevant credential fields appear dynamically
  2. Secrets accessible from business settings page (near emergency controls) via link to dedicated secrets page
  3. Dynamic credential fields adapt to integration type (API key only, API key + secret, username + password, OAuth token, etc.)
  4. Secrets page displays credentials grouped by integration with clear labeling
**Plans**: 3 plans

Plans:
- [ ] 13-01-PLAN.md -- Schema migrations (provider_credential_fields, secrets provider column), extended secrets service, test connection, server actions
- [ ] 13-02-PLAN.md -- Settings page with Emergency Controls + Secrets sections, provider-grouped secrets UI, eye toggle reveal, nav updates
- [ ] 13-03-PLAN.md -- Credential side drawer on Integrations page, Configure button, dynamic credential form

### Phase 14: Slack Integration & Chat Replacement
**Goal**: Replace custom chat page with Slack API integration so messages route between admin panel agents and Slack, viewable in both places
**Depends on**: Phase 13
**Requirements**: SLACK-01, SLACK-02, SLACK-03, SLACK-04
**Success Criteria** (what must be TRUE):
  1. Slack API integration routes messages to/from department agents
  2. Embedded Slack feed view in admin panel shows conversations per department/agent
  3. Messages are viewable both in the admin panel and directly in Slack
  4. Custom chat page replaced with Slack-powered interface (no duplicate chat infrastructure)
**Plans**: TBD

Plans:
- [ ] 14-01: TBD

### Phase 15: AITMPL Template Catalog
**Goal**: Business setup wizard and template management suggest Skills, Agents, Commands, Settings, Hooks, MCPs, and Plugins from the AITMPL catalog (aitmpl.com)
**Depends on**: Phase 14
**Requirements**: AITMPL-01, AITMPL-02, AITMPL-03, AITMPL-04
**Success Criteria** (what must be TRUE):
  1. Users can browse and select items from AITMPL catalog within the business setup wizard
  2. Wizard suggests relevant skills, agents, and commands based on department type and industry
  3. Tool configurations can be imported from AITMPL agent-tool-builder to populate tool_profile JSON
  4. Catalog covers all AITMPL categories: Skills, Agents, Commands, Settings, Hooks, MCPs, Plugins
**Plans**: TBD

Plans:
- [ ] 15-01: TBD

### Phase 16: Tenant Disable Fix & Dashboard Freeze
**Goal**: Disabling a tenant freezes the dashboard with a suspended banner and stops all VPS activity instead of showing a 404 error
**Depends on**: Phase 15
**Requirements**: TFIX-01, TFIX-02, TFIX-03, TFIX-04
**Success Criteria** (what must be TRUE):
  1. Disabled tenant shows a frozen dashboard with "Suspended" banner instead of 404 error
  2. Disabling a tenant stops all VPS activity (pauses containers, halts deployments)
  3. Admin panel blocks all interaction with VPS resources when tenant is disabled
  4. Admin can still view the business in a read-only frozen state (no edits, no deploys, no tasks)
**Plans**: 3 plans

Plans:
- [ ] 16-01-PLAN.md — VPS lifecycle, emergency service extension, guard function, context/banner components
- [ ] 16-02-PLAN.md — Add requireActiveBusiness guard to all mutation Server Actions
- [ ] 16-03-PLAN.md — Layout integration, client component disabled state, VPS warning indicator

### Phase 17: VPS Activation & Embedded Terminal
**Goal**: Deploy the first real department/agent to the Hostinger VPS and provide an embedded SSH terminal accessible from the business overview page for direct VPS access
**Depends on**: Phase 16
**Requirements**: VPS-TERM-01, VPS-TERM-02, VPS-TERM-03, VPS-TERM-04, VPS-TERM-05
**Success Criteria** (what must be TRUE):
  1. First real department/agent successfully deployed and running on Hostinger VPS
  2. Gear/settings icon next to VPS status badge on business overview links to a standalone terminal page
  3. Embedded real-time SSH terminal allows direct connection to the VPS from the admin panel
  4. Admin can access and interact with deployed agents and Docker containers from the embedded terminal
  5. End-to-end VPS deployment pipeline verified with real agents responding to tasks and chat
**Plans**: TBD

Plans:
- [ ] 17-01: TBD

---

## Milestone 2 (v2): Scale & Self-Serve

**Prerequisite**: Phases 1-9 (MVP) complete and deployed.

These are post-MVP capabilities identified during the Phase 1-8 build. They are listed here for planning purposes — scoping and phase breakdown will happen when v2 begins.

### v2 Themes

**Theme 0: VPS Activation (Phase 6 Intentional Gap)**
- Remove TODO stubs in `infra/vps/api-routes.ts` — Claude Code optimization (Step 3), container management (Step 4), real chat/task routing
- Run `infra/vps/setup.sh` on Hostinger VPS, configure OpenClaw, start systemd service
- Bootstrap Claude Code with `infra/vps/bootstrap-prompt.md` so agents run in real Docker containers
- Sync `infra/vps/api-types.ts` with `packages/core/vps/vps-types.ts` if either has drifted
- End state: admin app deploys to real VPS agents, chat/tasks hit live OpenClaw containers instead of stubs

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
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11 -> 12 -> 13 -> 14 -> 15 -> 16 -> 17

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation and Tenant Provisioning | 4/4 | Complete | 2026-03-25 |
| 2. Agent Management | 2/2 | Complete | 2026-03-25 |
| 3. Deployment Pipeline | 5/5 | Complete | 2026-03-26 |
| 4. Task Execution and Approvals | 5/5 | Complete | 2026-03-26 |
| 5. Observability and Command Center | 3/3 | Complete | 2026-03-27 |
| 6. OpenClaw Deployment & Live VPS Runtime | 4/4 | Complete | 2026-03-27 |
| 7. RAG Knowledge Base | 3/3 | Complete | 2026-03-27 |
| 8. Role Definition & Prompt Generation | 3/3 | Complete | 2026-03-27 |
| 9. Skill Management & Deployment | 4/4 | Complete | 2026-03-28 |
| 10. Template Profiles & Model Configuration | 3/3 | Complete    | 2026-03-29 |
| 11. Sub-Agent Management | 3/3 | Complete    | 2026-03-30 |
| 12. Integrations Catalog & Setup | 2/2 | Complete    | 2026-03-29 |
| 13. Secrets Management UX | 3/3 | Complete    | 2026-03-30 |
| 14. Slack Integration & Chat Replacement | 2/3 | In Progress|  |
| 15. AITMPL Template Catalog | 0/? | Not started | - |
| 16. Tenant Disable Fix & Dashboard Freeze | 3/3 | Complete    | 2026-03-30 |
| 17. VPS Activation & Embedded Terminal | 0/? | Not started | - |
