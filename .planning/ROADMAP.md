# Roadmap: Fleet Factory

## Overview

Fleet Factory is TJ's single-operator control panel for deploying AI agent swarms across dedicated VPS instances for client businesses. The admin web app deploys to Vercel; each business gets its own VPS with Docker containers per agent, Claude Code OAuth, and OpenClaw runtime.

**Milestone 1 (v1 — Phases 1-17):** Foundation through operational MVP — auth, agents, deployment, observability, integrations, and live VPS runtime. Complete.

**Milestone 2 (v2 — Phases 18-27):** Fleet deployment — enhanced wizard, SSH provisioning, VPS auto-setup with Claude Code OAuth, per-agent config & deploy, Slack-only pivot, live config sync, and consolidated overview.

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
- [x] **Phase 14: Slack Integration & Chat Replacement** - Slack API routing, embedded feed in admin panel, replace custom chat (completed 2026-03-30)
- [x] **Phase 15: AITMPL Template Catalog** - Wizard suggestions for Skills/Agents/Commands/Settings/Hooks/MCPs/Plugins from AITMPL (completed 2026-03-30)
- [x] **Phase 16: Tenant Disable Fix & Dashboard Freeze** - Fix 404 on disable, frozen dashboard banner, stop VPS activity (completed 2026-03-30)
- [x] **Phase 17: VPS Activation & Embedded Terminal** - First real VPS deployment, gear icon to terminal page, embedded SSH terminal (completed 2026-03-30)

### Milestone 2: Fleet Deployment
- [x] **Phase 18: Enhanced Business Wizard & Agent Hierarchy** - Subdomain routing, API key collection, hierarchical department tree (completed 2026-03-31)
- [x] **Phase 19: Rate Limiting & API Cost Tracking** - Concurrency control, priority queue, per-model cost calculation (completed 2026-03-31)
- [x] **Phase 20: SSH Deployment & Automated Provisioning** - SSH-based deployment, idempotent provisioning, port allocation (completed 2026-03-31)
- [x] **Phase 21: Command Center & RevOps Dashboard** - Cross-tenant C-suite overview, per-business RevOps with budget tracking (completed 2026-03-31)
- [x] **Phase 22: Rebrand to Fleet Factory** - Rename all occurrences across codebase, update docs and planning (completed 2026-04-02)
- [ ] **Phase 23: Wizard Overhaul + VPS Auto-Provisioning** - 4-step wizard, auto-provision VPS, Claude Code OAuth, CEO-only deploy
- [ ] **Phase 24: Agent Config, MCP Tools & Deploy One-by-One** - Per-agent config wizard with MCP tools, individual deploy
- [ ] **Phase 25: Slack-Only Pivot** - Remove web chat/tasks/approvals pages, Slack Block Kit approvals, @mention tasks
- [ ] **Phase 26: Live Sync (Admin <-> VPS)** - Bidirectional config sync: VPS->Admin (bootstrap pull), Admin->VPS (ongoing push)
- [ ] **Phase 27: Business Overview / RevOps Consolidation** - Single dashboard with agent status, RevOps metrics, activity feed
- [ ] **Phase 31: Horizontal Scaling** - Multi-VPS strategy, load balancing, tenant migration
- [ ] **Phase 32: Industry Templates & Marketplace** - Vertical template packs, real integrations, community marketplace

## Phase Details

### Milestone 1: MVP

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
**Plans**: 4 plans (3 original + 1 gap closure)

Plans:
- [x] 15-01: Catalog service, search/import actions, and AITMPL type definitions
- [x] 15-02: AITMPL catalog browser dialog, target picker, and agent detail integration
- [x] 15-03: AITMPL suggestion banner and Skill Template Browser integration
- [ ] 15-04: UAT gap closure -- Banner dismiss persistence fix and target picker friendly names

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

## Milestone 2 (v2): Fleet Deployment

**Prerequisite**: Milestone 1 (Phases 1-17) complete.

Milestone 2 pivots Fleet Factory from multi-tenant SaaS to a single-operator tool: simplified wizard with VPS auto-provisioning, Claude Code OAuth, per-agent config & deploy, Slack-only interaction, and live config sync.

**V2 Phase Overview:**
- [x] **Phase 18: Enhanced Business Wizard & Agent Hierarchy** - Subdomain routing, API key collection, hierarchical department tree (completed 2026-03-31)
- [x] **Phase 19: Rate Limiting & API Cost Tracking** - Concurrency control, priority queue, per-model cost calculation (completed 2026-03-31)
- [x] **Phase 20: SSH Deployment & Automated Provisioning** - Direct SSH deployment, idempotent provisioning, port allocation (completed 2026-03-31)
- [x] **Phase 21: Command Center & RevOps Dashboard** - Cross-business command center with KPIs; per-business RevOps with budget tracking (completed 2026-03-31)
- [x] **Phase 22: Rebrand to Fleet Factory** - Rename all occurrences across codebase, update docs and planning (completed 2026-04-02)
- [ ] **Phase 23: Wizard Overhaul + VPS Auto-Provisioning** - 4-step wizard, auto-provision VPS, Claude Code OAuth, CEO-only deploy
- [ ] **Phase 24: Agent Config, MCP Tools & Deploy One-by-One** - Per-agent config wizard with MCP tools, individual deploy
- [ ] **Phase 25: Slack-Only Pivot** - Remove web chat/tasks/approvals pages, Slack Block Kit approvals, @mention tasks
- [ ] **Phase 26: Live Sync (Admin <-> VPS)** - Bidirectional config sync: VPS->Admin (bootstrap pull), Admin->VPS (ongoing push)
- [ ] **Phase 27: Business Overview / RevOps Consolidation** - Single dashboard with agent status, RevOps metrics, activity feed

## V2 Phase Details

### Phase 18: Enhanced Business Wizard & Agent Hierarchy
**Goal**: Business creation wizard collects subdomain, API keys, and lets the admin select from a hierarchical department tree with role levels, reporting chains, and token budgets per agent
**Depends on**: Phase 17
**Requirements**: WIZ-01, WIZ-02, WIZ-03, HIER-01, HIER-02, HIER-03
**Success Criteria** (what must be TRUE):
  1. Wizard includes subdomain step with availability checking and preview (subdomain.fleetfactory.ai)
  2. Wizard includes API keys step collecting Anthropic (required), OpenAI, Google, and Mistral keys with secure storage
  3. Department tree selector shows hierarchical structure (CEO > Department Heads > Specialists) with expand/collapse and cascade selection
  4. Agent templates store role_level (0=C-suite, 1=dept head, 2=specialist), reporting_chain, token_budget, and parent_template_id
  5. Business subdomain is unique across all tenants (UNIQUE constraint enforced)
**Key files**: `wizard-subdomain-step.tsx`, `wizard-api-keys-step.tsx`, `department-tree-select.tsx`, `create-business-wizard.tsx`, migrations 042/043/048/049
**Plans**: 2 plans

Plans:
- [ ] 18-01-PLAN.md -- Server-side validation (subdomain check, API key validation) and template-aware V2 provisioning
- [ ] 18-02-PLAN.md -- Wizard UX polish (hover tooltips, dynamic provider list, inline review editing, hierarchy enforcement)

### Phase 19: Rate Limiting & API Cost Tracking
**Goal**: API calls are rate-limited with plan-tier concurrency control, queued when capacity is exceeded, all usage logged with per-model cost calculation, budget enforcement at agent and business level, and a dedicated usage analytics page
**Depends on**: Phase 17, Phase 18
**Requirements**: RATE-01, RATE-02, RATE-03, USAGE-01, USAGE-02, TIER-01, BUDGET-01, BUDGET-02, BUDGET-03, DASH-01, DASH-02, VPS-01, CLEAN-01, QUEUE-UX-01
**Success Criteria** (what must be TRUE):
  1. Rate limiter enforces plan-tier concurrency limits (Trial:1, Starter:3, Pro:5, Enterprise:10) with 2-second stagger using DB-backed slot tracking
  2. Overflow requests queued in api_call_queue with priority + FIFO ordering, self-draining on slot release
  3. All API calls logged in api_usage with model, provider, prompt/completion tokens, cost, latency, status, and key_source (platform vs business)
  4. Per-model pricing for Claude/GPT-4/Gemini/Mistral/DeepSeek in extracted constants file
  5. Per-agent token budget (monthly, COALESCE with template) with soft limit at 80% (banner + Slack DM) and hard stop at 100%
  6. Business-level plan token cap enforced as hard stop (block all agents + red banner)
  7. Command Center shows full cost breakdown (today/week/month, by provider, by model)
  8. Dedicated /businesses/[id]/usage page with Recharts time-series, model/provider/agent breakdowns, time filters (24h/7d/30d/MTD/YTD)
  9. VPS proxy returns real token counts from OpenClaw response; chat UI shows queue position when rate-limited
  10. Old usage_records table dropped, metering.ts deleted, tool-runner.ts migrated to logApiUsage()
**Key files**: `packages/core/rate-limit/`, `packages/core/dashboard/`, `apps/web/app/(dashboard)/businesses/[id]/usage/`, migration 045, 051
**Plans**: 4 plans

Plans:
- [ ] 19-01-PLAN.md -- Schema (plan_tier, agent token_budget, key_source), model pricing constants, DB-backed rate limiter, budget service, delete metering.ts
- [ ] 19-02-PLAN.md -- VPS proxy token passthrough, vps-chat parsing, executeWithRateLimit in chat-service, chat queue UX
- [ ] 19-03-PLAN.md -- Dashboard cost wiring, RevOps real budgets, Usage Analytics page with Recharts, sidebar nav
- [ ] 19-04-PLAN.md -- Budget banners (agent detail + business overview), Slack DM at 80%, audit log events

### Phase 20: SSH Deployment & Automated Provisioning
**Goal**: VPS deployment uses direct SSH instead of REST API, with idempotent provisioning scripts, port allocation for multi-tenant isolation, and real-time progress reporting
**Depends on**: Phase 17
**Requirements**: SSHD-01, SSHD-02, SSHD-03, PORT-01, PORT-02
**Success Criteria** (what must be TRUE):
  1. SSH client connects to VPS via node-ssh with reusable connection pooling and progress callbacks
  2. `sshDeployBusiness()` uploads workspace files, executes provision-tenant.sh, and deploys agents with CEO first then sub-agents (2s stagger)
  3. `provision-tenant.sh` is idempotent — safe to re-run, preserves memory directories across redeploys, validates config before starting
  4. Port allocator assigns contiguous port ranges per business and prevents collisions across tenants
  5. Agent statuses are updated in database after deployment with real-time progress logging
**Key files**: `packages/core/vps/ssh-client.ts`, `ssh-deploy.ts`, `infra/vps/provision-tenant.sh`, `provision-designer.sh`, `packages/core/deployment/port-allocator.ts`, migration 044
**Plans**: TBD

### Phase 21: Command Center & RevOps Dashboard
**Goal**: Cross-tenant command center gives C-suite visibility into all businesses with KPIs, bottleneck detection, and live activity feed; per-business RevOps dashboard tracks token usage, agent performance, and budget utilization
**Depends on**: Phase 19
**Requirements**: CMDC-01, CMDC-02, CMDC-03, REVOPS-01, REVOPS-02, REVOPS-03
**Success Criteria** (what must be TRUE):
  1. Command center shows KPI cards: total businesses, active agents ratio, pending tasks (with alert threshold), tokens consumed today
  2. All businesses listed with agent count, task count, status badge, and quick-link navigation
  3. Bottleneck detection flags businesses with >10 pending tasks or <50% agents active
  4. Live activity feed shows 15 most recent audit log entries across all tenants
  5. RevOps dashboard shows per-agent token usage vs budget with color-coded utilization bars (green <50%, amber 50-80%, red >80%)
  6. Flagged agents section highlights low-utilization agents (<50% of budget)
**Key files**: `apps/web/app/(dashboard)/command-center/`, `apps/web/app/(dashboard)/businesses/[id]/revops/`, `packages/core/dashboard/`
**Plans**: TBD

### Phase 22: Rebrand to Fleet Factory
**Goal**: Rename all "Agency Factory" references to "Fleet Factory" across the entire codebase
**Depends on**: Phase 21
**Success Criteria** (what must be TRUE):
  1. Zero occurrences of "agency-factory" or "Agency Factory" in source files
  2. Package names updated to `@fleet-factory/*`
  3. Docker image renamed to `fleet-factory/agent:latest`
  4. VPS paths updated to `/opt/fleet-factory/`
  5. `pnpm build` passes cleanly
**Status**: Complete (2026-04-02)

### Phase 23: Wizard Overhaul + VPS Auto-Provisioning
**Goal**: Simplify wizard to 4 steps. Auto-provision VPS with Docker + Claude Code + OpenClaw. Claude Code OAuth replaces per-business API keys.
**Depends on**: Phase 22
**New wizard steps**:
  1. Business Details (unchanged)
  2. Departments (unchanged)
  3. VPS Setup — auto-provisions Docker, Claude Code, OpenClaw; displays OAuth URL for auth
  4. Deploy CEO — deploys CEO container only, redirects to dashboard
**Success Criteria** (what must be TRUE):
  1. 4-step wizard creates business with VPS auto-provisioning
  2. VPS provisioned with Docker, Claude Code (OAuth), and OpenClaw
  3. OAuth URL displayed in wizard for TJ to authenticate
  4. Claude Code bootstrapped with OpenClaw expertise
  5. CEO deployed and healthy; all other agents seeded as `ready_to_configure`
**Key files**: `create-business-wizard.tsx`, `wizard-vps-step.tsx`, `packages/core/vps/vps-provision.ts`, `ssh-deploy.ts`
**Plans**: TBD

### Phase 24: Agent Config, MCP Tools & Deploy One-by-One
**Goal**: After wizard deploys CEO, other agents show as "Ready to Configure". Configure via agent wizard (including MCP tool selection), then deploy individually.
**Depends on**: Phase 23
**Agent statuses**: `ready_to_configure` -> `configured` -> `deploying` -> `active`
**Success Criteria** (what must be TRUE):
  1. Agents list shows "Configure" button for `ready_to_configure` agents
  2. Agent config wizard includes MCP server selection step
  3. "Deploy" button for `configured` agents triggers SSH hot-add
  4. Container starts on VPS with correct MCP servers, agent goes active
**Key files**: `agents-list.tsx`, `agent-card.tsx`, `agent-setup-wizard.tsx`, `ssh-deploy.ts`
**Plans**: TBD

### Phase 25: Slack-Only Pivot
**Goal**: Slack is the sole interface for agent interaction. Remove web chat, tasks, approvals pages. Enhance Slack for task creation and approval workflows.
**Depends on**: Phase 24
**Success Criteria** (what must be TRUE):
  1. Web chat, standalone tasks, approvals, revops, and usage pages deleted
  2. @mention in Slack creates task and triggers agent execution
  3. Approval requests posted as Block Kit messages with approve/reject buttons
  4. Sidebar nav reduced to 10 items: Overview, Departments, Agents, Templates, Skills, Deployments, Integrations, Knowledge Base, Settings, Logs
  5. DB tables (tasks, approvals, conversations, messages) kept for audit trail
**Plans**: TBD

### Phase 26: Live Sync (Admin <-> VPS)
**Goal**: Bidirectional config sync between VPS and admin panel.
**Depends on**: Phase 24
**Success Criteria** (what must be TRUE):
  1. After VPS bootstrap: admin panel shows VPS-generated configs (not locally generated ones)
  2. After agent deploy: admin reflects actual VPS config for that agent
  3. Edit agent config in admin -> change appears in VPS workspace within seconds
  4. "Pull from VPS" button available on agent config UI
**Key files**: `packages/core/vps/live-sync.ts`
**Plans**: TBD

### Phase 27: Business Overview / RevOps Consolidation
**Goal**: Business overview becomes the single dashboard: agent status + RevOps + activity feed.
**Depends on**: Phase 25
**Success Criteria** (what must be TRUE):
  1. Overview shows active containers and Slack status
  2. RevOps metrics (cost today/month/budget) inline on overview
  3. Activity feed shows recent tasks and approvals from Slack
  4. No standalone RevOps or Usage pages
**Plans**: TBD

---

## Progress

**Execution Order:**

**Milestone 1 (v1):** 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11 -> 12 -> 13 -> 14 -> 15 -> 16 -> 17

**Milestone 2 (v2):** 18 -> 19 -> 20 -> 21 -> 22 -> 23 -> 24 -> [25 + 26] -> 27

### Milestone 1: MVP (Complete)

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
| 10. Template Profiles & Model Configuration | 3/3 | Complete | 2026-03-29 |
| 11. Sub-Agent Management | 3/3 | Complete | 2026-03-30 |
| 12. Integrations Catalog & Setup | 2/2 | Complete | 2026-03-29 |
| 13. Secrets Management UX | 3/3 | Complete | 2026-03-30 |
| 14. Slack Integration & Chat Replacement | 3/3 | Complete | 2026-03-30 |
| 15. AITMPL Template Catalog | 4/4 | Complete | 2026-03-30 |
| 16. Tenant Disable Fix & Dashboard Freeze | 3/3 | Complete | 2026-03-30 |
| 17. VPS Activation & Embedded Terminal | 3/3 | Complete | 2026-03-30 |

### Milestone 2: Fleet Deployment

| Phase | Status | Completed |
|-------|--------|-----------|
| 18. Enhanced Business Wizard & Agent Hierarchy | Complete | 2026-04-01 |
| 19. Rate Limiting & API Cost Tracking | Complete | 2026-04-01 |
| 20. SSH Deployment & Automated Provisioning | Complete | 2026-03-31 |
| 21. Command Center & RevOps Dashboard | Complete | 2026-03-31 |
| 22. Rebrand to Fleet Factory | Complete | 2026-04-02 |
| 23. Wizard Overhaul + VPS Auto-Provisioning | Planned | — |
| 24. Agent Config, MCP Tools & Deploy One-by-One | Planned | — |
| 25. Slack-Only Pivot | Planned | — |
| 26. Live Sync (Admin <-> VPS) | Planned | — |
| 27. Business Overview / RevOps Consolidation | Planned | — |
