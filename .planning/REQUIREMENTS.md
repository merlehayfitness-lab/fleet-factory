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

- [x] **DEPL-01**: Deployment center shows current version, status, and deployment history per business
- [x] **DEPL-02**: Admin can trigger deploy and redeploy from deployment center
- [x] **DEPL-03**: Deployment runner generates tenant-config.json per business
- [x] **DEPL-04**: Deployment runner generates docker-compose.generated.yml per business
- [x] **DEPL-05**: Deployment runner generates .env.generated per business
- [x] **DEPL-06**: Deployment runner generates one runtime config file per agent (prompt, tools, model)
- [x] **DEPL-07**: Deployment status tracked (queued, building, deploying, live, failed)
- [x] **DEPL-08**: Failed deployments can be retried
- [x] **DEPL-09**: Deployments support rollback to last working version
- [x] **DEPL-10**: Agent configs are versioned — each deployment creates a new version snapshot

### Task Execution

- [x] **TASK-01**: Tasks can be created via admin panel or API with title, payload, priority, and target agent/department
- [x] **TASK-02**: Orchestrator service (Paperclip) routes tasks to appropriate department agent based on type and priority
- [x] **TASK-03**: Worker service (OpenClaw) executes agent tasks with allowed tools from tool_profile
- [x] **TASK-04**: Tasks track status (queued, assigned, in_progress, completed, failed)
- [x] **TASK-05**: Tasks page shows work queue across all departments for a business
- [x] **TASK-06**: Webhook/event ingestion endpoint accepts inbound events from external systems to create tasks

### Approvals & Governance

- [x] **APRV-01**: Risky agent actions create approval requests that pause execution
- [x] **APRV-02**: Admin can approve or reject gated actions from approvals page
- [x] **APRV-03**: Risk-tiered approval routing: low-risk auto-run, medium-risk async review, high-risk synchronous approval
- [x] **APRV-04**: Policy rules gate irreversible actions (spending money, deleting data, changing integrations, modifying production)
- [x] **APRV-05**: Agent confidence thresholds trigger escalation to human when uncertainty is high
- [x] **APRV-06**: Escalation paths defined: agent → manager → admin → owner
- [x] **APRV-07**: All approval decisions logged in audit_logs with full context

### Security

- [x] **SECR-01**: Secrets stored encrypted, never plaintext in database or config files
- [x] **SECR-02**: Per-tenant credential isolation — one business cannot access another's secrets
- [x] **SECR-03**: Agent execution sandboxed — no host filesystem access, no elevated exec, restricted mounts
- [x] **SECR-04**: Tool access validated against tenant-scoped allowlists before execution
- [x] **SECR-05**: Agents never run with service_role credentials
- [x] **SECR-06**: Emergency controls: freeze agent, revoke tools, disable tenant — all take effect immediately

### Tenant Operations

- [x] **TOPS-01**: Per-tenant health dashboard showing agent status, error rates, task throughput, and deployment state
- [x] **TOPS-02**: All logs, metrics, and traces tagged with business_id and filterable per tenant
- [x] **TOPS-03**: Audit log viewer shows full action history per business (searchable, filterable by actor/event type)
- [x] **TOPS-04**: Internal usage metering tracks token consumption and cost per tenant per agent
- [x] **TOPS-05**: Tenant kill switch disables business without affecting other tenants

### Dashboard & UI

- [x] **DASH-01**: Sign-in page
- [x] **DASH-02**: Businesses list page showing all businesses with status badges
- [x] **DASH-03**: Create business wizard (multi-step: name/industry → departments → integrations → deploy target)
- [x] **DASH-04**: Business overview dashboard (health, active agents, pending approvals, recent activity, deployment status, quick links)
- [x] **DASH-05**: Departments setup page per business
- [x] **DASH-06**: Agents list page per business
- [x] **DASH-07**: Agent detail page (config, status, activity, conversations)
- [x] **DASH-08**: Deployment center page per business
- [x] **DASH-09**: Tasks and approvals page per business
- [x] **DASH-10**: Command center chat interface with routing to agents via orchestrator
- [x] **DASH-11**: Conversation log viewer with transcript history and tool call traces

### Communication

- [x] **COMM-01**: Command center chat routes messages to appropriate agent via orchestrator
- [x] **COMM-02**: Conversation transcripts stored per agent with full tool call traces
- [x] **COMM-03**: Conversation log viewer shows history filterable by agent, department, and date

### OpenClaw Deployment & VPS Runtime

- [x] **DEPL-VPS-01**: Deployment pipeline generates OpenClaw-native workspace artifacts (AGENTS.md, SOUL.md, openclaw.json, per-agent workspace directories)
- [x] **DEPL-VPS-02**: Admin app communicates with VPS via OpenClaw REST gateway API over HTTPS with API key auth
- [x] **DEPL-VPS-03**: Claude Code on VPS receives deployment packages, reviews/optimizes workspace files, and deploys agent containers
- [x] **DEPL-VPS-04**: Real-time deployment progress streamed to admin app via WebSocket with expandable detail log
- [x] **DEPL-VPS-05**: Each agent runs in its own isolated Docker container with persistent always-on runtime
- [x] **DEPL-VPS-06**: VPS health check endpoint visible in admin dashboard (online/offline/degraded)
- [x] **DEPL-VPS-07**: Rollback restores exact workspace snapshot from previous successful deployment
- [x] **DEPL-VPS-08**: Both full-tenant and per-agent deployment supported
- [x] **DEPL-VPS-09**: Automated post-deploy health check verifies each agent is responding
- [x] **DEPL-VPS-10**: Deployment artifacts stored in both Supabase (history/audit) and VPS (runtime)

### Live VPS Routing

- [x] **LIVE-01**: Tasks created in admin app are routed to real OpenClaw agents on VPS for execution (replaces mock tool execution)
- [x] **LIVE-02**: Chat messages from admin app are routed to real OpenClaw agents on VPS (replaces stub responses)
- [x] **LIVE-03**: Agent responses from VPS flow back to admin app and update tasks/messages in Supabase
- [x] **LIVE-04**: Graceful degradation when VPS is unreachable (tasks queue, chat shows "Agent offline")
- [x] **LIVE-05**: Inter-agent messaging enabled within the same business tenant on VPS

### RAG Knowledge Base

- [x] **RAG-01**: pgvector extension enabled with knowledge_documents, knowledge_chunks, and knowledge_retrievals tables
- [x] **RAG-02**: Document upload pipeline: file upload → chunking → embedding → storage in Supabase
- [x] **RAG-03**: Two-tier knowledge scoping: global (business-wide) + per-agent, with RLS isolation
- [x] **RAG-04**: Semantic similarity retrieval function scoped by business_id and optional agent_id
- [x] **RAG-05**: Knowledge Base UI on agent config tab with global inherited docs + agent-specific upload zones
- [x] **RAG-06**: Knowledge synced to VPS for fast local retrieval by agents at runtime
- [x] **RAG-07**: Retrieved context prepended to agent system prompt automatically before model call

### Role Definition & Prompt Generation

- [x] **ROLE-01**: Role Definition card on agent config with plain-language description, tone, and focus inputs
- [x] **ROLE-02**: Claude-powered system prompt AND SKILL.md generation from role definition
- [x] **ROLE-03**: Generated prompt previews in System Prompt card before saving
- [x] **ROLE-04**: Agent setup wizard with knowledge upload step, SKILL.md generation, and sub-agent support
- [x] **ROLE-05**: Departments support multiple agents with parent-child hierarchy (lead + sub-agents with role field)
- [x] **ROLE-06**: SKILL.md stored on agent record and deployable to VPS as workspace artifact

### Skill Management

- [x] **SKILL-01**: Skill editor UI allows creating and editing SKILL.md files with structured sections
- [x] **SKILL-02**: Skills can be imported from GitHub repository URLs
- [x] **SKILL-03**: Department-level skills can be assigned and inherited by all agents in that department
- [x] **SKILL-04**: Skill template library provides curated starter skills per department/role type

### Integrations

- [x] **INTG-01**: Integration model supports provider, credentials_ref, and status per business
- [x] **INTG-02**: Mock/stub adapters for CRM, email, helpdesk, calendar, and messaging in MVP
- [x] **INTG-03**: Integration adapter interface designed for swappable real connectors later
- [x] **INTG-04**: Integration credentials scoped per tenant and stored encrypted

### Template Profiles & Model Configuration

- [x] **TMPL-01**: Agent templates store optional tool_profile (JSONB) defining available tools and MCP configurations
- [x] **TMPL-02**: Agent templates store optional model_profile (JSONB) defining model selection and parameters
- [x] **TMPL-03**: Model Profile on agent config page is changeable via dropdown with available models
- [x] **TMPL-04**: Tool/Model Profile JSON editable via structured form or raw JSON editor

### Sub-Agent Management

- [x] **SUBAG-01**: Sub-agents can be created under department lead agents with named roles
- [x] **SUBAG-02**: Agent tree UI visualizes parent-child hierarchy within departments
- [x] **SUBAG-03**: Agent list and detail pages show hierarchy grouping with collapsible department sections

### Integrations Catalog & Setup

- [x] **INTG-ENH-01**: "Add Integration" button opens browsable catalog of available integrations
- [x] **INTG-ENH-02**: Adding an integration assigns it to a specific department or agent
- [x] **INTG-ENH-03**: AI-generated setup instructions based on integration type
- [x] **INTG-ENH-04**: Category field auto-populates based on integration selection

### Secrets Management UX

- [x] **SECR-ENH-01**: Integration-first secrets flow (pick integration, category auto-fills, relevant fields appear)
- [x] **SECR-ENH-02**: Secrets accessible from business settings page via link to dedicated secrets page
- [x] **SECR-ENH-03**: Dynamic credential fields adapt to integration type (API key, OAuth, username/password, etc.)
- [x] **SECR-ENH-04**: Secrets page displays credentials grouped by integration

### Slack Integration

- [x] **SLACK-01**: Slack API integration routes messages to/from department agents
- [x] **SLACK-02**: Embedded Slack feed view in admin panel per department/agent
- [x] **SLACK-03**: Messages viewable both in admin panel and directly in Slack
- [x] **SLACK-04**: Custom chat page replaced with Slack-powered interface

### AITMPL Template Catalog

- [ ] **AITMPL-01**: Browse and select from AITMPL catalog within business setup wizard
- [ ] **AITMPL-02**: Wizard suggests skills, agents, commands based on department/industry
- [ ] **AITMPL-03**: Import tool configurations from AITMPL agent-tool-builder for tool_profile JSON
- [ ] **AITMPL-04**: Catalog covers Skills, Agents, Commands, Settings, Hooks, MCPs, Plugins

### Tenant Disable Fix

- [x] **TFIX-01**: Disabled tenant shows frozen dashboard with "Suspended" banner instead of 404
- [x] **TFIX-02**: Disabling tenant stops all VPS activity (pause containers, halt deployments)
- [x] **TFIX-03**: Admin panel blocks interaction with VPS when tenant disabled
- [x] **TFIX-04**: Admin can still view business in read-only frozen state

### VPS Activation & Embedded Terminal

- [ ] **VPS-TERM-01**: First real department/agent deployed and running on Hostinger VPS
- [ ] **VPS-TERM-02**: Gear icon next to VPS status badge links to standalone terminal page
- [ ] **VPS-TERM-03**: Embedded real-time SSH terminal for direct VPS access from admin panel
- [ ] **VPS-TERM-04**: Admin can access deployed agents and Docker containers from embedded terminal
- [ ] **VPS-TERM-05**: End-to-end VPS deployment pipeline verified with real agents

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
- **AGNT-V2-03**: ~~Agent-to-agent communication within a department~~ → Moved to v1 as LIVE-05 (Phase 6)
- **AGNT-V2-04**: ~~Agent memory/context persistence across conversations~~ → Covered by Phase 6 OpenClaw workspace (memory persists across deploys)

### Advanced Integrations

- **INTG-V2-01**: Real OAuth2-based integration connectors (CRM, email, helpdesk, calendar)
- **INTG-V2-02**: Webhook outbound notifications for external system events
- **INTG-V2-03**: ~~Knowledge base management per department~~ → Moved to v1 as RAG-03/RAG-05 (Phase 7)

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
| DEPL-01 | Phase 3 | Complete |
| DEPL-02 | Phase 3 | Complete |
| DEPL-03 | Phase 3 | Complete |
| DEPL-04 | Phase 3 | Complete |
| DEPL-05 | Phase 3 | Complete |
| DEPL-06 | Phase 3 | Complete |
| DEPL-07 | Phase 3 | Complete |
| DEPL-08 | Phase 3 | Complete |
| DEPL-09 | Phase 3 | Complete |
| DEPL-10 | Phase 3 | Complete |
| DASH-08 | Phase 3 | Complete |
| SECR-01 | Phase 3 | Complete |
| SECR-02 | Phase 3 | Complete |
| INTG-01 | Phase 3 | Complete |
| INTG-02 | Phase 3 | Complete |
| INTG-03 | Phase 3 | Complete |
| INTG-04 | Phase 3 | Complete |
| TASK-01 | Phase 4 | Complete |
| TASK-02 | Phase 4 | Complete |
| TASK-03 | Phase 4 | Complete |
| TASK-04 | Phase 4 | Complete |
| TASK-05 | Phase 4 | Complete |
| TASK-06 | Phase 4 | Complete |
| APRV-01 | Phase 4 | Complete |
| APRV-02 | Phase 4 | Complete |
| APRV-03 | Phase 4 | Complete |
| APRV-04 | Phase 4 | Complete |
| APRV-05 | Phase 4 | Complete |
| APRV-06 | Phase 4 | Complete |
| APRV-07 | Phase 4 | Complete |
| DASH-09 | Phase 4 | Complete |
| SECR-03 | Phase 4 | Complete |
| SECR-04 | Phase 4 | Complete |
| SECR-05 | Phase 4 | Complete |
| TOPS-04 | Phase 4 | Complete |
| TOPS-01 | Phase 5 | Complete |
| TOPS-02 | Phase 5 | Complete |
| TOPS-03 | Phase 5 | Complete |
| TOPS-05 | Phase 5 | Complete |
| COMM-01 | Phase 5 | Complete |
| COMM-02 | Phase 5 | Complete |
| COMM-03 | Phase 5 | Complete |
| DASH-10 | Phase 5 | Complete |
| DASH-11 | Phase 5 | Complete |
| SECR-06 | Phase 5 | Complete |
| DEPL-VPS-01 | Phase 6 | Complete |
| DEPL-VPS-02 | Phase 6 | Complete |
| DEPL-VPS-03 | Phase 6 | Complete |
| DEPL-VPS-04 | Phase 6 | Complete |
| DEPL-VPS-05 | Phase 6 | Complete |
| DEPL-VPS-06 | Phase 6 | Complete |
| DEPL-VPS-07 | Phase 6 | Complete |
| DEPL-VPS-08 | Phase 6 | Complete |
| DEPL-VPS-09 | Phase 6 | Complete |
| DEPL-VPS-10 | Phase 6 | Complete |
| LIVE-01 | Phase 6 | Complete |
| LIVE-02 | Phase 6 | Complete |
| LIVE-03 | Phase 6 | Complete |
| LIVE-04 | Phase 6 | Complete |
| LIVE-05 | Phase 6 | Complete |
| RAG-01 | Phase 7 | Complete |
| RAG-02 | Phase 7 | Complete |
| RAG-03 | Phase 7 | Complete |
| RAG-04 | Phase 7 | Complete |
| RAG-05 | Phase 7 | Complete |
| RAG-06 | Phase 7 | Complete |
| RAG-07 | Phase 7 | Complete |
| ROLE-01 | Phase 8 | Complete |
| ROLE-02 | Phase 8 | Complete |
| ROLE-03 | Phase 8 | Complete |
| ROLE-04 | Phase 8 | Complete |
| ROLE-05 | Phase 8 | Complete |
| ROLE-06 | Phase 8 | Complete |
| SKILL-01 | Phase 9 | Complete |
| SKILL-02 | Phase 9 | Complete |
| SKILL-03 | Phase 9 | Complete |
| SKILL-04 | Phase 9 | Complete |
| TMPL-01 | Phase 10 | Complete |
| TMPL-02 | Phase 10 | Complete |
| TMPL-03 | Phase 10 | Complete |
| TMPL-04 | Phase 10 | Complete |
| SUBAG-01 | Phase 11 | Complete |
| SUBAG-02 | Phase 11 | Complete |
| SUBAG-03 | Phase 11 | Complete |
| INTG-ENH-01 | Phase 12 | Not started |
| INTG-ENH-02 | Phase 12 | Not started |
| INTG-ENH-03 | Phase 12 | Not started |
| INTG-ENH-04 | Phase 12 | Not started |
| SECR-ENH-01 | Phase 13 | Not started |
| SECR-ENH-02 | Phase 13 | Not started |
| SECR-ENH-03 | Phase 13 | Not started |
| SECR-ENH-04 | Phase 13 | Not started |
| SLACK-01 | Phase 14 | Not started |
| SLACK-02 | Phase 14 | Not started |
| SLACK-03 | Phase 14 | Not started |
| SLACK-04 | Phase 14 | Not started |
| AITMPL-01 | Phase 15 | Not started |
| AITMPL-02 | Phase 15 | Not started |
| AITMPL-03 | Phase 15 | Not started |
| AITMPL-04 | Phase 15 | Not started |
| TFIX-01 | Phase 16 | Not started |
| TFIX-02 | Phase 16 | Not started |
| TFIX-03 | Phase 16 | Not started |
| TFIX-04 | Phase 16 | Not started |
| VPS-TERM-01 | Phase 17 | Not started |
| VPS-TERM-02 | Phase 17 | Not started |
| VPS-TERM-03 | Phase 17 | Not started |
| VPS-TERM-04 | Phase 17 | Not started |
| VPS-TERM-05 | Phase 17 | Not started |

**Coverage:**
- v1 requirements: 141 total
- Mapped to phases: 141
- Unmapped: 0

---
*Requirements defined: 2026-03-25*
*Last updated: 2026-03-27 after Phase 8 scope expansion and Phase 9 addition*
