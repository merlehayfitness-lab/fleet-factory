# Feature Research

**Domain:** Multi-tenant AI agent deployment and management platform (SaaS)
**Researched:** 2026-03-25
**Confidence:** MEDIUM-HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Tenant isolation (data + credentials)** | Every multi-tenant SaaS must guarantee zero data leakage between tenants. Without this, platform is DOA for any business customer. | HIGH | Supabase RLS with `is_business_member()` is the right approach. Must cover all operational tables, agent configs, conversation logs, and credential stores. Industry standard is namespace isolation with mandatory tenant ID filtering on every query. |
| **Auth and RBAC** | Users expect login, role-based permissions, and scoped access. No business will use a platform where anyone can see everything. | MEDIUM | Supabase Auth handles the auth layer. Roles (owner, admin, manager, viewer) gate write operations. This is non-negotiable for B2B SaaS. |
| **Tenant provisioning / onboarding wizard** | Competing platforms offer one-click or guided setup. Manual provisioning kills adoption. | MEDIUM | The "create business" wizard (name, industry, departments, integrations, deployment target) maps directly to what competitors offer. Must be atomic -- partial provisioning = broken tenant. |
| **Agent lifecycle management** | Every competitor (Kore.ai, Composio, Decagon) provides create/configure/deploy/pause/retire workflows for agents. | MEDIUM | Template-based creation in MVP is the right constraint. Must include status tracking (provisioning, active, paused, error, retired), config editing, and restart/redeploy. |
| **Task routing and execution** | The core value loop. Tasks come in, get assigned to agents, agents execute. Without this working, the platform is a dashboard with no engine. | HIGH | Orchestrator (Paperclip) routes to worker agents (OpenClaw). Must support priority queuing, department-scoped assignment, and status tracking (queued, assigned, in_progress, completed, failed). |
| **Human approval gates** | Industry standard for production AI agents. Gartner, Deloitte, and every enterprise platform requires human-in-the-loop for risky actions. 2026 trend is "human-on-the-loop" (supervise, not approve everything). | MEDIUM | Approval queue with approve/reject per action. Risk-based routing: low-risk auto-approve, high-risk require human sign-off. Start with explicit approval gates, evolve toward risk scoring. |
| **Audit logging** | Every enterprise platform (Kore.ai, Composio, Merge) provides full audit trails. Compliance requirement for B2B. | MEDIUM | Log every agent action, human decision, config change, and deployment event. Must be tenant-scoped, searchable, and exportable. The `audit_logs` table design is correct. |
| **Agent observability / monitoring** | Braintrust, Maxim, Sentry all offer agent-specific observability. Users need to see what agents are doing, what's failing, and what's costing money. | HIGH | Dashboard showing agent status, recent actions, error rates, and execution logs. Per-tenant views. Conversation transcripts with tool call traces. Token usage and cost tracking per agent and per tenant. |
| **Deployment management** | Users expect deploy/redeploy capability with status tracking and rollback. Every platform from Docker to Kubernetes to Vercel provides deployment pipelines. | HIGH | Deployment center showing current version, deployment history, status (queued, building, deploying, live, failed). Config generation (docker-compose, env files, tenant configs) is the right approach for single-VPS MVP. |
| **Integration connectors** | Every competing platform (Kore.ai has 250+, Composio, Merge) provides pre-built integrations. Without connections to CRM, email, helpdesk, and calendar, agents can't do real work. | HIGH | Start with mock/stub adapters for MVP (project constraint). But the integration model (provider, credentials_ref, status) must be designed for real connectors. Priority integrations: email, CRM, helpdesk, calendar, Slack/messaging. |
| **Business overview dashboard** | Every SaaS product needs a home screen showing health at a glance. Mission Control, Kore.ai governance dashboard, and Sentry's AI dashboard all provide this. | MEDIUM | Health indicators, active agent count, pending approvals, recent conversations, deployment status, error count. This is screen #4 in the MVP build order -- correctly prioritized. |
| **Department / team organization** | Competitors use organizational metaphors (Kore.ai: business units, CrewAI: crews with roles, Decagon: agent operating procedures). Businesses think in departments. | LOW | Four default departments (Owner, Sales, Support, Operations) is the right MVP scope. The organizational metaphor maps to how SMBs actually think about their operations. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **One-click full-stack tenant provisioning** | Most platforms require manual setup across multiple systems. Agency Factory provisions business + departments + agents + deployment in one atomic flow. This is the core value prop and genuinely rare in the market. | HIGH | The `provisionBusinessTenant()` atomic flow (business record, membership, departments, agents, deployment job) is the killer feature. Competitors like Kore.ai and Composio require significant manual configuration per tenant. |
| **Builder agent (Claude-powered config generation)** | Agents that build other agents. Most platforms require manual prompt engineering and config writing. Having an AI service that generates agent configs, prompts, and deployment artifacts from templates is a meaningful differentiator. | HIGH | This is Phase 3 in the delivery plan. The builder-service generates configs from templates and rolls improvements across tenants. Competitors offer templates but rarely automated generation and rollout. |
| **Department-as-a-unit abstraction** | Competitors organize by individual agents or flat lists. Grouping agents into departments with shared context, tools, and permissions mirrors how real businesses operate. Easier mental model for non-technical business owners. | MEDIUM | The department model (Sales, Support, Operations, Owner) with per-department tool profiles and agent templates is a genuinely useful abstraction. It reduces cognitive load compared to managing 10+ individual agents. |
| **Template-based agent creation with cross-tenant rollout** | When a template improves, all future tenants get the improvement. Existing tenants can opt-in to updates. This creates a flywheel: more tenants = more feedback = better templates = more value per tenant. | MEDIUM | Agent templates with `department_type` mapping + builder service for rollout. This is the operational flywheel that makes the SaaS model work long-term. Requires versioning on templates. |
| **Command center chat (unified agent interface)** | Instead of switching between department-specific interfaces, one chat interface routes to the right agent. Like having a receptionist for your AI team. | MEDIUM | Screen #10 in MVP. Conversation logs per agent with full transcript history. The orchestrator handles routing, so the UI can be a single pane of glass. Differentiates from platforms that require per-agent interaction. |
| **Per-tenant deployment artifacts** | Each tenant gets generated docker-compose.yml, .env, and runtime configs. This is unusual -- most SaaS platforms are shared-infrastructure. Agency Factory generates actual deployable artifacts per tenant. | HIGH | The deployment runner generating tenant-config.json, docker-compose.generated.yml, .env.generated, and per-agent runtime configs is architecturally distinctive. Enables future self-hosted/on-prem options. |
| **Risk-based approval routing** | Instead of approve-everything or approve-nothing, score actions by risk and only gate high-risk ones. Low-risk actions auto-execute, medium-risk get logged, high-risk pause for human approval. | MEDIUM | Not in MVP scope yet, but a natural evolution of the approval system. Start with explicit approval gates (table stakes), evolve toward risk scoring (differentiator). The industry is moving from "human-in-the-loop" to "human-on-the-loop". |
| **Tool profiles with permission levels** | Bundled tool permissions per role, not per agent. Change the Sales tool profile and all Sales agents across all tenants update. Centralized control that scales. | LOW | The `tool_profiles` table with `permission_level` enables this. Most competitors configure tools per-agent, which doesn't scale across tenants. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Dynamic agent spawning by end users** | "Let users create their own agents!" Seems empowering. | Without solid logging, permissions, and rollback, user-created agents become ungovernable. Gartner warns 40%+ of agentic AI projects get cancelled due to unexpected complexity and risk. One rogue user-created agent can consume budget, leak data, or take harmful actions. | Template-only creation in MVP. Users choose from curated templates. Dynamic spawning only after audit logs, permissions, and rollback are battle-tested. This is already the project decision -- it's correct. |
| **Real-time WebSocket everything** | "Make it real-time!" Feels modern and responsive. | WebSocket complexity (connection management, reconnection, state sync) is massive for multi-tenant. Every tenant needs their own channel. Server Actions and polling are simpler, cheaper, and sufficient for admin operations that aren't latency-critical. | Polling or Server Actions for MVP. SSE (Server-Sent Events) for deployment status and task updates if needed. WebSockets only for the command center chat if polling latency becomes a problem. Already an out-of-scope decision -- correct. |
| **Multi-LLM model marketplace** | "Let users pick from 20 models!" Sounds flexible. | Each model has different capabilities, token limits, pricing, and failure modes. Supporting many models multiplies testing, error handling, and cost tracking complexity. Most users don't know or care which model their agent uses. | Default to Claude Sonnet for all agents. Allow model override at the template level only (admin control). Add model flexibility only when there's proven demand from paying customers. |
| **Visual workflow / flow builder** | "Drag-and-drop agent workflows!" Competitors like n8n and Cognigy have them. | Visual builders are enormous engineering efforts (custom canvas, node system, serialization, validation, execution engine). They're table stakes for workflow-automation platforms, not for agent-management platforms. Agency Factory's value is in provisioning and managing agent teams, not in visual programming. | Template-based agent configuration with YAML/JSON. The builder service generates configs programmatically. Visual builders are a v3+ consideration if the product pivots toward workflow automation. |
| **Per-agent billing / metering** | "Charge per agent action!" Seems like natural SaaS pricing. | Requires complex metering infrastructure, usage aggregation, billing integration, and dispute handling. Premature before product-market fit. | Flat per-tenant pricing for MVP. Track token usage and costs internally for analytics, but don't expose as billing. Metering infrastructure is a post-PMF investment. Already out of scope -- correct. |
| **Custom department creation by end users** | "Let businesses define their own departments!" | Departments are tied to agent templates, tool profiles, and workflows. Custom departments without matching templates are empty shells. Permitting arbitrary departments fragments the template ecosystem and makes cross-tenant improvements impossible. | Admin-only department creation via templates. Four defaults cover most SMBs. Add new department types (Marketing, Finance, Legal, HR) as templates mature. Already an out-of-scope decision -- correct. |
| **OAuth / social login** | "Support Google, GitHub, Microsoft login!" | Adds OAuth provider configuration, token refresh handling, and multiple auth flows. Supabase supports this but it's configuration overhead that doesn't drive core value. | Email/password via Supabase Auth for MVP. OAuth is a quick add later (Supabase makes it easy) but not worth the distraction now. Already out of scope -- correct. |
| **Multi-region deployment** | "Deploy to AWS, GCP, Azure, and multiple regions!" | Multi-region adds enormous infrastructure complexity: data replication, latency routing, compliance per jurisdiction, and cost multiplication. | Single VPS with Docker for MVP. The per-tenant deployment artifact model makes multi-region possible later without re-architecting. Already out of scope -- correct. |

## Feature Dependencies

```
[Auth + RBAC]
    |
    +--requires--> [Tenant Isolation (RLS)]
    |                   |
    |                   +--requires--> [Business/Tenant Records]
    |                                       |
    |                                       +--requires--> [Tenant Provisioning Wizard]
    |                                       |                   |
    |                                       |                   +--creates--> [Departments]
    |                                       |                   |                 |
    |                                       |                   |                 +--creates--> [Agents from Templates]
    |                                       |                   |                                    |
    |                                       |                   |                                    +--triggers--> [Deployment Job]
    |                                       |                   |
    |                                       |                   +--creates--> [Owner Membership]
    |                                       |
    |                                       +--enables--> [Business Dashboard]
    |
    +--enables--> [Audit Logging]

[Agent Templates]
    |
    +--enables--> [Agent Lifecycle Management]
    |                 |
    |                 +--enables--> [Task Routing + Execution]
    |                                   |
    |                                   +--enables--> [Human Approval Gates]
    |                                   |
    |                                   +--enables--> [Command Center Chat]
    |
    +--enables--> [Builder Agent (config generation)]
                      |
                      +--enables--> [Cross-Tenant Template Rollout]

[Deployment Management]
    |
    +--requires--> [Tenant Records + Agent Configs]
    |
    +--generates--> [Per-Tenant Deployment Artifacts]

[Integration Connectors]
    |
    +--requires--> [Tenant Isolation (credential scoping)]
    |
    +--enhances--> [Agent Execution (tool access)]

[Observability / Monitoring]
    |
    +--requires--> [Audit Logging]
    |
    +--enhances--> [Business Dashboard]
    |
    +--enhances--> [Deployment Management]
```

### Dependency Notes

- **Auth + RBAC requires Tenant Isolation:** Cannot enforce per-tenant access without RLS and business membership checks. Must be built first.
- **Tenant Provisioning requires Business Records + Templates:** The atomic provisioning flow creates business, membership, departments, and agents from templates in one transaction. Templates must exist before provisioning works.
- **Task Routing requires Agents:** Cannot route tasks without deployed, active agents. Agent lifecycle management must precede task execution.
- **Human Approval Gates require Task Routing:** Approvals are checkpoints within task execution. The task system must exist first.
- **Builder Agent requires Templates:** The builder generates configs from templates. Templates must be versioned and stable before the builder can modify and roll out changes.
- **Command Center Chat requires Task Routing:** Chat sends messages that become tasks routed to agents. The orchestrator must be functional first.
- **Integration Connectors enhance Agent Execution:** Agents without tool access can only process text. Real value requires CRM, email, helpdesk connections -- but mock adapters suffice for MVP.
- **Observability enhances everything:** Monitoring is valuable at every stage but requires audit logging infrastructure as a foundation.

## MVP Definition

### Launch With (v1)

Minimum viable product -- what's needed to validate the concept.

- [ ] **Auth + RBAC** -- Cannot use the platform without login and role-based access
- [ ] **Tenant isolation via RLS** -- Non-negotiable for multi-tenant. Data leakage = trust destruction
- [ ] **Business creation + provisioning wizard** -- Core value prop: one-click tenant setup
- [ ] **Default department seeding (4 departments)** -- Organizational structure that makes agents manageable
- [ ] **Agent creation from templates** -- Agents must exist for the platform to have purpose
- [ ] **Business overview dashboard** -- Users need a home screen showing tenant health
- [ ] **Agent list + detail pages** -- Users need to see and configure their agents
- [ ] **Deployment center (deploy/redeploy)** -- Must be able to deploy agents to prove the pipeline works
- [ ] **Basic audit logging** -- Record what happened, when, and by whom

### Add After Validation (v1.x)

Features to add once core provisioning-to-deployment loop is proven.

- [ ] **Task routing and execution via orchestrator** -- Add when deployment pipeline is stable and agents are running
- [ ] **Human approval gates** -- Add when task execution is working; gate risky actions
- [ ] **Command center chat + conversation logs** -- Add when task routing proves agents can respond
- [ ] **Observability dashboard (token usage, error rates, cost tracking)** -- Add when there are real agents generating real data to observe
- [ ] **Integration connectors (real, not mock)** -- Add when first paying customers need CRM/email access
- [ ] **Deployment history + rollback** -- Add when deployments are happening frequently enough to need versioning

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Builder agent (Claude-powered config generation)** -- Requires stable templates and proven template model
- [ ] **Cross-tenant template rollout** -- Requires multiple tenants and versioned templates
- [ ] **Risk-based approval routing** -- Requires approval data to train risk scoring
- [ ] **Dynamic agent spawning** -- Requires mature permissions, logging, and rollback
- [ ] **Visual workflow builder** -- Only if product pivots toward workflow automation
- [ ] **Per-agent billing/metering** -- Only after pricing model is validated with paying customers
- [ ] **Multi-region deployment** -- Only when customer base requires geographic distribution
- [ ] **OAuth / social login** -- Quick add via Supabase when customer demand justifies it

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Auth + RBAC | HIGH | MEDIUM | P1 |
| Tenant isolation (RLS) | HIGH | MEDIUM | P1 |
| Business provisioning wizard | HIGH | MEDIUM | P1 |
| Department seeding | HIGH | LOW | P1 |
| Agent creation from templates | HIGH | MEDIUM | P1 |
| Business overview dashboard | HIGH | MEDIUM | P1 |
| Agent list + detail pages | MEDIUM | MEDIUM | P1 |
| Deployment center | HIGH | HIGH | P1 |
| Audit logging | MEDIUM | MEDIUM | P1 |
| Task routing + execution | HIGH | HIGH | P2 |
| Human approval gates | HIGH | MEDIUM | P2 |
| Command center chat | HIGH | MEDIUM | P2 |
| Observability dashboard | MEDIUM | HIGH | P2 |
| Integration connectors (real) | HIGH | HIGH | P2 |
| Deployment rollback | MEDIUM | MEDIUM | P2 |
| Builder agent | HIGH | HIGH | P3 |
| Cross-tenant template rollout | MEDIUM | MEDIUM | P3 |
| Risk-based approval routing | MEDIUM | MEDIUM | P3 |
| Dynamic agent spawning | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch (proves the provisioning-to-deployment loop)
- P2: Should have, add when core loop is validated (proves agents can do real work)
- P3: Nice to have, future consideration (scales the platform)

## Competitor Feature Analysis

| Feature | Kore.ai | Composio | Mission Control | Decagon | Agency Factory Approach |
|---------|---------|----------|-----------------|---------|------------------------|
| **Multi-tenant isolation** | Enterprise-grade, cloud-agnostic | Auth-scoped per-user | Multi-workspace with `/api/super/*` | Per-customer isolation | RLS via Supabase, business_id scoping on all tables |
| **Agent creation** | 300+ marketplace templates | SDK-based, developer-first | Auto-discovery from filesystem | Natural language AOPs | Template-based from curated department blueprints |
| **Orchestration** | Multi-agent coordination engine | Tool-level orchestration | Kanban task routing | Single-agent per customer | Paperclip orchestrator: company structure, task routing, department assignment |
| **Approval gates** | Governance dashboard with RBAC | Role-based access control | Aegis quality gate system | Embedded in agent procedures | Explicit approve/reject on gated actions, evolving to risk-based routing |
| **Observability** | Full decision tracing + governance dashboard | Tool call logs with timestamps | Real-time activity feed, cost tracking, session analysis | Watchtower analytics | Audit logs, agent status, token/cost tracking, conversation transcripts |
| **Deployment** | Cloud/on-prem/hybrid | Cloud-managed | Docker zero-config, local-first | Cloud-managed SaaS | Per-tenant Docker artifacts (compose, env, configs) on single VPS |
| **Integrations** | 250+ plug-and-play | OAuth2 managed auth, 1000+ tools | GitHub sync, webhooks | System-specific deep integration | Mock adapters for MVP, real connectors for CRM/email/helpdesk/calendar post-MVP |
| **Pricing model** | Enterprise licensing | Usage-based | Open source (free) | Outcome-based | Per-tenant flat pricing for MVP |
| **Builder / automation** | Low-code agent builder | SDK + API | SOUL personality system | Natural language procedures | Claude-powered builder service generating configs from templates |

### Key Competitive Insights

1. **Kore.ai** is the enterprise heavyweight with 300+ templates and 250+ integrations. Agency Factory cannot compete on breadth -- it competes on the provisioning simplicity and department abstraction.

2. **Composio** targets developers with SDK-first approach. Agency Factory targets business owners/operators with a managed admin panel.

3. **Mission Control** (open source) is the closest architectural comparison with its multi-workspace, task kanban, and agent fleet management. But it's developer-facing, not business-facing.

4. **Decagon's "Agent Operating Procedures"** (natural language behavior specs) is a strong concept. Agency Factory's template system serves a similar purpose but is more structured.

5. **No competitor does one-click full-stack provisioning** (business + departments + agents + deployment artifacts) as a core product feature. This is Agency Factory's genuine whitespace.

## Sources

- [3 AI Agent Management Platforms to Consider in 2026 (Merge.dev)](https://www.merge.dev/blog/ai-agent-management-platform) -- MEDIUM confidence
- [7 Best Agentic AI Platforms in 2026 (Kore.ai)](https://www.kore.ai/blog/7-best-agentic-ai-platforms) -- MEDIUM confidence
- [Mission Control - GitHub](https://github.com/builderz-labs/mission-control) -- HIGH confidence (primary source)
- [AI Agent Guardrails: Production Guide for 2026](https://authoritypartners.com/insights/ai-agent-guardrails-production-guide-for-2026/) -- MEDIUM confidence
- [Enterprise AI in 2026 (Cloud Wars)](https://cloudwars.com/ai/enterprise-ai-in-2026-scaling-ai-agents-with-autonomy-orchestration-and-accountability/) -- MEDIUM confidence
- [Gartner: 40% of Enterprise Apps Will Feature AI Agents by 2026](https://www.gartner.com/en/newsroom/press-releases/2025-08-26-gartner-predicts-40-percent-of-enterprise-apps-will-feature-task-specific-ai-agents-by-2026-up-from-less-than-5-percent-in-2025) -- HIGH confidence (Gartner)
- [Deloitte: SaaS meets AI agents](https://www.deloitte.com/us/en/insights/industry/technology/technology-media-and-telecom-predictions/2026/saas-ai-agents.html) -- HIGH confidence (Deloitte)
- [AI Observability Tools Buyer's Guide 2026 (Braintrust)](https://www.braintrust.dev/articles/best-ai-observability-tools-2026) -- MEDIUM confidence
- [How to Sandbox AI Agents in 2026 (Northflank)](https://northflank.com/blog/how-to-sandbox-ai-agents) -- MEDIUM confidence
- [Multi-Tenant AI Agent Architecture (Fast.io)](https://fast.io/resources/ai-agent-multi-tenant-architecture/) -- MEDIUM confidence
- [AWS Multi-Tenant Generative AI Platform](https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/multi-tenant-generative-ai-platform-scenario.html) -- HIGH confidence (AWS official)
- [Composio AI Agent Integration Platforms Comparison](https://composio.dev/content/ai-agent-integration-platforms) -- MEDIUM confidence

---
*Feature research for: Multi-tenant AI agent deployment and management platform*
*Researched: 2026-03-25*
