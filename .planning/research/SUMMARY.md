# Project Research Summary

**Project:** Agency Factory
**Domain:** Multi-tenant AI agent deployment and management platform (SaaS)
**Researched:** 2026-03-25
**Confidence:** HIGH

## Executive Summary

Agency Factory is a multi-tenant SaaS platform that provisions and manages AI agent teams for small and medium businesses. Research across stack, features, architecture, and pitfalls confirms the product operates at the intersection of three hard technical domains simultaneously: multi-tenant SaaS isolation, AI agent orchestration, and container-based deployment pipelines. Building any one of these correctly requires care; building all three in a coherent, integrated system is the primary engineering challenge. The good news is that the planned technology choices (Supabase for RLS-enforced isolation, AI SDK 6 for orchestration, Docker Compose for deployment) are well-matched to the problem and benefit from documented patterns with high source confidence.

The recommended approach is a layered build order driven by strict data dependencies: database schema and RLS policies first, then admin UI and tenant provisioning, then agent management, then deployment pipeline, then live agent operations (orchestrator and worker runtime), and finally the intelligence layer (builder agent and command center). This sequence is not arbitrary -- each layer is a prerequisite for the next and the research confirms that violating this order creates rework that is expensive to undo. The atomic tenant provisioning flow (a single Postgres RPC that creates business, membership, departments, agents, and queues a deployment job) is both the core user value proposition and the single most critical piece of infrastructure to get right.

The dominant risks are security in nature: incomplete RLS allows cross-tenant data leakage, prompt injection can weaponize agents against other tenants, and credential sprawl can compromise client systems. All three are Phase 1 and Phase 2 concerns -- they cannot be deferred to a "hardening pass" because retrofitting them after data and agents exist is an order of magnitude harder. Budget controls (per-tenant token limits to prevent runaway LLM costs) are a non-negotiable Phase 2 requirement before any agent runs in production. The architecture's clean separation of Orchestrator (Paperclip), Worker (OpenClaw), and Builder as distinct services provides the isolation boundaries needed to address these risks systematically.

## Key Findings

### Recommended Stack

The full stack is a modern TypeScript monorepo built on Turborepo (pnpm workspaces) with Next.js 15.5.x App Router as the admin panel. Supabase handles auth, Postgres with RLS, durable job queues (pgmq), and vector storage (pgvector) -- eliminating the need for Redis, a separate vector database, or a separate auth service. AI agent orchestration uses two complementary SDKs: AI SDK 6 (for streaming UI, ToolLoopAgent orchestration, and the orchestrator-worker pattern) paired with `@anthropic-ai/sdk` directly (for the Builder service where fine-grained control over structured output and prompt caching is needed). Zod v4 serves as the single schema language across validation, tool definitions, and config parsing. Tailwind CSS v4 with shadcn/ui CLI v4 handles styling. Docker Compose on a single VPS is the deployment target with Traefik for container routing.

The key version constraints are: Next.js 15.5.x (NOT 16 -- breaking changes not worth MVP risk), React 19.2.x (required by Next.js 15), TypeScript 5.5+ with strict mode (required by Zod v4), and AI SDK 6.x with `@ai-sdk/anthropic` 3.x (provider version must match SDK major). Drizzle ORM is explicitly deferred to Phase 2+ -- use the Supabase client for MVP because its RLS integration is simpler. LangChain, Prisma, Redis, Kubernetes, tRPC, and NextAuth are explicitly out of scope for all phases.

**Core technologies:**
- **Next.js 15.5.x + React 19.2.x**: Admin panel with App Router, Server Components, Server Actions -- the entire UI layer; avoid version 16
- **Supabase (supabase-js 2.99.x)**: Auth, Postgres with RLS for tenant isolation, pgmq queues, pgvector embeddings -- single infrastructure dependency
- **AI SDK 6 + @ai-sdk/anthropic 3.x**: Orchestrator-worker agent patterns, streaming UI, provider-agnostic LLM interface
- **@anthropic-ai/sdk 0.80.x**: Direct Claude API access for Builder service (structured output, prompt caching, batch API)
- **Zod 4.3.x**: Universal schema language for validation, tool definitions, and config parsing across all services
- **Turborepo 2.8.x + pnpm 9.x**: Monorepo orchestration for the 6-package structure (apps/web, packages/db, packages/core, packages/ui, packages/runtime, services/worker)
- **Docker Compose V2 + Traefik**: Per-tenant container deployment on single VPS with auto-discovery routing
- **Tailwind CSS 4.2.x + shadcn/ui CLI v4**: Utility-first styling with accessible component primitives

### Expected Features

Research confirms the market expectation and the competitive gap: no competitor delivers one-click full-stack tenant provisioning (business + departments + agents + deployment artifacts) as a core product feature. This is Agency Factory's genuine whitespace. Competitors like Kore.ai and Composio require significant manual configuration; Mission Control (closest architectural comparison) is developer-facing, not business-owner-facing.

**Must have (table stakes) -- v1:**
- **Tenant isolation via RLS** -- non-negotiable; data leakage destroys trust and the platform immediately
- **Auth + RBAC** -- no B2B SaaS works without role-scoped access; Supabase Auth handles this
- **Business creation + provisioning wizard** -- core value proposition; one atomic flow creates business, membership, departments, agents, deployment job
- **Default department seeding (4 types: Owner, Sales, Support, Operations)** -- organizational abstraction that maps to how SMBs think
- **Agent lifecycle management from templates** -- agents must exist and have state transitions (provisioning, active, paused, error, retired)
- **Business overview dashboard** -- home screen showing health at a glance (agent status, pending approvals, deployment status, error count)
- **Deployment center (deploy/redeploy with status tracking)** -- proves the provisioning-to-deployment pipeline end-to-end
- **Audit logging** -- required for B2B compliance; every agent action, human decision, config change logged with tenant scoping

**Should have (competitive differentiators) -- v1.x:**
- **Task routing and execution via orchestrator (Paperclip)** -- add once deployment pipeline is stable; the core agent work loop
- **Human approval gates with rich context** -- risk-tiered: low-risk auto-approve, high-risk pause for human sign-off with full action payload shown
- **Command center chat (unified agent interface)** -- single pane of glass routed by orchestrator; differentiates from per-agent interfaces
- **Observability dashboard (token usage, error rates, cost tracking)** -- requires real agents generating real data; add in v1.x
- **Integration connectors (real, not mock)** -- CRM, email, helpdesk, calendar; add when first paying customers need them
- **Deployment history + rollback** -- add when deployments happen frequently enough to need versioning

**Defer (v2+):**
- Builder agent (Claude-powered config generation) -- requires stable, versioned templates and multiple proven tenants
- Cross-tenant template rollout -- requires multiple tenants and template versioning infrastructure
- Risk-based approval routing (ML scoring) -- requires approval data to train on
- Dynamic agent spawning by end users -- requires mature permissions, logging, and rollback first
- Visual workflow builder -- only if product pivots toward workflow automation; massive engineering effort
- Per-agent billing/metering -- post-PMF investment; track internally but don't expose as billing
- Multi-region deployment -- only when geographic distribution is customer-required
- OAuth/social login -- quick add via Supabase when customer demand justifies it

**Anti-features to avoid building:**
- Real-time WebSocket everything (polling and Server Actions are sufficient for MVP admin operations)
- Multi-LLM model marketplace (multiplies testing and error handling complexity; default Claude Sonnet for all agents)
- Custom department creation by end users (fragments the template ecosystem; admin-only, add new types as templates mature)

### Architecture Approach

The recommended architecture is a strict 5-layer separation: Presentation (Next.js App Router with thin Server Actions as entry points), Service Layer (`packages/core` with pure TypeScript domain functions), Agent Runtime Services (Orchestrator/Paperclip, Worker/OpenClaw, Builder as distinct processes), Data Layer (Supabase Postgres with RLS, Auth, Storage), and Infrastructure (Docker Compose on VPS with Traefik). The monorepo splits into `apps/web` (admin panel), `packages/db` (schema, types, RLS helpers), `packages/core` (domain logic), `packages/ui` (shadcn components), `packages/runtime` (pure config generation functions), and `services/worker` and `services/builder` (independently deployable long-running processes). The critical pattern is that Server Actions are 5-15 line wrappers -- all business logic lives in `packages/core` as framework-independent, testable TypeScript.

**Major components:**
1. **Presentation Layer (apps/web)** -- Next.js App Router pages, Server Actions as thin entry points; no business logic; route protection via middleware + Server Action auth checks
2. **Tenant Service** -- `provisionBusinessTenant()` as a Postgres RPC function ensuring atomicity; seeds departments, creates agents from templates, queues deployment job
3. **Agent Service** -- Template-based agent lifecycle (create, configure, status transitions); templates drive cross-tenant consistency
4. **Deploy Service** -- Config generation as pure data transformation (pure function: tenant data in, deployment artifacts out); artifact versioning for rollback; async execution via pgmq queue
5. **Orchestrator (Paperclip)** -- Task decomposition, department-based routing, approval gate evaluation; communicates with Worker via function calls in MVP, message queue at scale
6. **Worker Runtime (OpenClaw)** -- Tool execution with least-privilege permissions per department role; sandbox execution; result reporting
7. **Builder Agent** -- Claude API-powered config generation from templates; validate all outputs before deployment; human review gate before production rollout
8. **Data Layer (packages/db)** -- All queries routed through this package; RLS enforced via `is_business_member(business_id)` on every operational table; typed query functions via generated Supabase types
9. **Infrastructure (infra/)** -- Per-tenant Docker Compose artifacts generated by Deploy Service; Traefik for routing; resource limits in every generated compose file

### Critical Pitfalls

Research (HIGH confidence, corroborated by OWASP, AWS, Microsoft, and real CVEs) identifies seven critical pitfalls with explicit phase assignments:

1. **Cross-tenant data leakage via incomplete RLS** -- Phase 1 concern. RLS is disabled by default on every new Supabase table. One missed policy = data breach. Prevention: implement `is_business_member(business_id)` function on all operational tables; add a CI check that queries `pg_class` to verify all tables have `relrowsecurity = true`; test RLS from the SDK client (never the SQL Editor, which bypasses RLS); write cross-tenant integration tests.

2. **Partial provisioning failure leaving orphaned tenants** -- Phase 1 concern. `supabase-js` does NOT support transactions (each insert is an independent HTTP call). A failure at step 3 of 5 leaves a broken tenant. Prevention: implement the entire provisioning flow as a single Postgres RPC function (`supabase.rpc('provision_business_tenant', {...})`); add `provisioning_status` field with states `pending / provisioning / active / failed`; make the function idempotent.

3. **Prompt injection leading to cross-tenant data exfiltration** -- Phase 2 concern. Agents with tool access become attack vectors. Indirect injection via processed emails or documents is particularly dangerous in multi-tenant systems. Prevention: strict per-tenant credential scoping (agents never use `service_role` key); input sanitization before LLM context; output validation against allowlist of permitted operations; log every tool invocation with full input/output.

4. **Runaway LLM costs (Denial of Wallet)** -- Phase 2 requirement before any agent runs in production. Agent loops without hard iteration limits can spike API bills 10x-100x in hours. Prevention: hard iteration limits on all agent loops (e.g., max 10 tool calls per task); per-tenant token budgets tracked in database and checked before every LLM call; real-time cost alerting when tenant exceeds 80% of daily budget.

5. **Noisy neighbor degradation on single VPS** -- Phase 2 concern. Docker containers share host kernel resources. One tenant's bursty workload can starve all others. Prevention: Docker resource limits (`deploy.resources.limits.cpus/memory`) in every generated compose file; per-tenant concurrency limits in task queue; fair-queuing across tenants (round-robin, not FIFO from shared queue).

6. **Credential and secret sprawl across tenants** -- Phase 1 (schema design) and Phase 3 (vault integration). Raw integration credentials in the database expose all client systems if RLS is misconfigured. Prevention: `credentials_ref` as vault pointer (never raw credentials in `config_json`); scrubbing layer that redacts API key patterns from agent transcripts before persistence; never give agents the `service_role` key.

7. **Approval gates becoming rubber stamps** -- Phase 2 concern. Approvers get fatigued when context is poor or volume is high. Prevention: risk-tiered routing (low/medium/high), not approve-everything; rich approval UI showing full action payload and agent reasoning chain; SLA-based escalation (never auto-approve on timeout); track approval metrics (rate > 98% signals rubber-stamping).

## Implications for Roadmap

Research strongly confirms a 6-phase build order based on strict dependency chains. The architecture research explicitly maps this order; feature dependencies confirm it; pitfall phase assignments validate when each risk must be addressed.

### Phase 1: Foundation and Tenant Isolation

**Rationale:** Everything else depends on this. RLS policies must exist before any data is written. The provisioning RPC must be atomic before any UI exists. If this foundation is wrong, fixing it after tenants exist is catastrophic. The two most severe pitfalls (RLS data leakage, partial provisioning failure) are Phase 1 problems.

**Delivers:** Monorepo structure, database schema with RLS on all tables, Supabase Auth setup, `is_business_member()` function, CI RLS verification check, `provision_business_tenant()` Postgres RPC function with idempotency and `provisioning_status` tracking, `packages/db` with generated types and query helpers.

**Addresses features:** Tenant isolation (RLS), Auth + RBAC foundation, `credentials_ref` schema pattern for integrations

**Avoids pitfalls:** Cross-tenant data leakage (RLS from day one); partial provisioning failure (Postgres RPC from day one); credential sprawl (schema pattern established)

**Research flag:** Standard patterns -- well-documented Supabase RLS setup; no additional research needed.

### Phase 2: Admin Shell and Business Provisioning

**Rationale:** With data layer in place, build the UI and the tenant provisioning wizard. This is the first deliverable that validates the core value proposition: one-click business creation that seeds departments, agents, and queues deployment. Audit logging must go in here as the observability foundation for everything that follows.

**Delivers:** Next.js App Router shell with auth pages, business CRUD + creation wizard, business overview dashboard, department list, agent list + detail pages, `packages/core/tenant`, `packages/core/audit`, basic audit log viewer.

**Addresses features:** Business creation wizard, department seeding (4 types), agent creation from templates, business overview dashboard, audit logging, agent list/detail pages

**Avoids pitfalls:** Next.js middleware bypass CVE (authorization enforced in Server Actions + RLS, not just middleware); partial provisioning UX (show step-by-step provisioning progress, not blank dashboard)

**Research flag:** Standard patterns -- Next.js App Router + Supabase Auth is well-documented.

### Phase 3: Deployment Pipeline

**Rationale:** Deployment is architecturally isolated as a pure data transformation concern (artifact generation) plus an async execution concern (Docker Compose on VPS). This can be built once agents exist in the database from Phase 2 provisioning. The deployment center proves the provisioning-to-deployment loop end-to-end, which is the MVP validation milestone.

**Delivers:** `packages/runtime` (pure config generation functions), `packages/core/deployment` (job queue, status tracking), deployment center UI (deploy/redeploy, status, history), generated docker-compose artifacts with resource limits per container, Traefik routing configuration, `infra/` Docker configs and deployment scripts.

**Addresses features:** Deployment center (deploy/redeploy), deployment status tracking, per-tenant Docker artifacts

**Avoids pitfalls:** Noisy neighbor (resource limits in all generated compose files from day one); credential sprawl (generated `.env` files never logged, secrets marked `[REDACTED]`); shared mutable config anti-pattern (immutable versioned artifacts)

**Research flag:** Likely needs `/gsd:research-phase` for Docker Compose resource limit configuration and Traefik label-based routing specifics for per-tenant container naming.

### Phase 4: Live Agent Operations (Orchestrator + Worker)

**Rationale:** This is the engine of the platform -- the Orchestrator (Paperclip) routes tasks and the Worker (OpenClaw) executes them. Must come after deployment pipeline is stable because agents must be running before tasks can be executed. This phase has the most new risk surface (prompt injection, runaway costs, noisy neighbor at runtime) so pitfall mitigations must be built concurrently, not deferred.

**Delivers:** `packages/orchestrator` (Paperclip: task routing, decomposition, approval gate evaluation), `services/worker` (OpenClaw: tool execution with least-privilege per department, sandbox), `packages/core/task` (work queue management, pgmq integration), `packages/core/approval` (approval request lifecycle, timeout escalation), tasks page, approvals page with rich context UI, per-tenant token budget tracking and enforcement, structured agent logging with credential scrubbing.

**Addresses features:** Task routing and execution, human approval gates, task status tracking (queued/assigned/in_progress/completed/failed), approval queue with approve/reject

**Avoids pitfalls:** Prompt injection (input sanitization, tool call allowlist validation, per-tenant credential scoping); runaway LLM costs (hard iteration limits, per-tenant budget enforcement, real-time cost alerting); approval rubber-stamping (rich context UI, SLA escalation, approval rate metrics); noisy neighbor at runtime (per-tenant concurrency limits in task queue, fair queuing)

**Research flag:** Needs `/gsd:research-phase` for AI SDK 6 ToolLoopAgent pattern specifics, pgmq polling patterns with backoff, and tool plugin architecture for OpenClaw.

### Phase 5: Observability and Integrations

**Rationale:** Once real agents are running and generating real data, build the observability layer and real integration connectors. Observability requires actual usage data to be meaningful; integrations require real agents to use them. This phase validates that the platform delivers business value beyond the deployment pipeline.

**Delivers:** Observability dashboard (token usage, error rates, cost tracking per agent and tenant), conversation transcripts with tool call traces, deployment history + rollback, integration connectors (real CRM/email/helpdesk/calendar adapters replacing mock stubs), command center chat (unified agent interface via orchestrator routing).

**Addresses features:** Observability dashboard, integration connectors (real), command center chat, deployment rollback, conversation log viewer

**Avoids pitfalls:** Credential sprawl in integrations (vault integration for `credentials_ref` -- Phase 3 deferred, now implemented); approval rubber-stamping continued mitigation (approval metrics surfaced in observability); audit log usability (filterable/searchable views, not raw event stream)

**Research flag:** Needs `/gsd:research-phase` for integration connector OAuth2 patterns, token refresh handling, and real CRM/email API specifics when first paying customers define which integrations are required.

### Phase 6: Intelligence Layer

**Rationale:** The Builder agent (Claude-powered config generation and cross-tenant template rollout) requires stable, versioned templates and proven deployment pipeline. The template flywheel (more tenants = better templates = more value per tenant) only works if the underlying infrastructure is battle-tested. This is explicitly a v2+ feature per feature research.

**Delivers:** `services/builder` (Claude-powered prompt/config generation from templates), template versioning system, cross-tenant template rollout with opt-in for existing tenants, builder-generated config validation against allowlist, human review gate before production deployment, audit trail for template changes and affected tenants.

**Addresses features:** Builder agent, cross-tenant template rollout, risk-based approval routing (natural evolution once approval data exists)

**Avoids pitfalls:** Builder service generating unsafe configs (config validation against strict allowlist; sandbox testing; human review gate before production rollout)

**Research flag:** Needs `/gsd:research-phase` for Claude API structured output patterns at scale, template versioning strategies, and safe config validation approaches.

### Phase Ordering Rationale

- **RLS and provisioning atomicity must be Phase 1:** These cannot be retrofitted. Data that exists before RLS is properly implemented is already potentially leaked. A provisioning flow that runs before the RPC exists will create orphaned records.
- **UI before engine:** The admin shell (Phase 2) provides the scaffolding that makes agent management visible. Building the orchestrator before you can see what you built is debugging in the dark.
- **Deployment before live operations:** Agents cannot run tasks if they are not deployed. The deployment pipeline is the physical prerequisite for the orchestrator.
- **Observability after data exists:** Dashboards showing token usage and error rates require actual usage data. Building them before Phase 4 produces empty charts that create false confidence.
- **Builder last:** The template flywheel requires proven templates. Building the builder before templates are validated by real tenants inverts the learning loop.

### Research Flags

**Phases needing `/gsd:research-phase` during planning:**
- **Phase 3 (Deployment Pipeline):** Docker Compose resource limit syntax for CPU/memory caps, Traefik label configuration for per-tenant container routing, Docker SDK vs. shell exec trade-offs for the Deploy Service
- **Phase 4 (Live Agent Operations):** AI SDK 6 ToolLoopAgent implementation patterns, pgmq polling with exponential backoff, least-privilege tool permission implementation in OpenClaw, AI SDK streaming to Next.js App Router for task status updates
- **Phase 5 (Observability + Integrations):** OAuth2 token management for real integration connectors (specific to whichever integrations first paying customers need)
- **Phase 6 (Intelligence Layer):** Claude API structured output at scale for builder service, template versioning strategies, config validation allowlist design

**Phases with standard patterns (can skip research-phase):**
- **Phase 1 (Foundation):** Supabase RLS setup, Postgres function creation, TypeScript monorepo with Turborepo + pnpm -- all well-documented with official sources
- **Phase 2 (Admin Shell):** Next.js 15 App Router + Supabase Auth + shadcn/ui -- mature, well-documented stack with multiple production examples

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official documentation for all core technologies; version compatibility matrix verified; clear "avoid" list with documented rationale |
| Features | MEDIUM-HIGH | Competitor analysis is solid but from vendor-produced content; market research (Gartner, Deloitte) is high confidence; specific feature prioritization is well-reasoned but product-market fit is unproven |
| Architecture | MEDIUM-HIGH | Official Microsoft, AWS, and Supabase documentation; patterns are well-established; RLS + Next.js App Router architecture is proven at scale; specific service boundaries are architectural judgment calls |
| Pitfalls | HIGH | OWASP, real CVEs (CVE-2025-48757, CVE-2025-29927), AWS prescriptive guidance, multiple post-mortems; security pitfalls especially well-documented |

**Overall confidence:** HIGH for implementation approach; MEDIUM for product-market fit validation

### Gaps to Address

- **Agent container density on single VPS:** Research notes agents sharing a worker process pool rather than individual containers is better for MVP, but the architecture describes per-tenant container stacks. This tension needs resolution in Phase 3: decide whether MVP uses shared worker pool or per-tenant containers, accepting the ~10-20 tenant container density limit.
- **Mock integration adapter design:** The integration adapter interface (provider, credentials_ref, status) must be designed in Phase 1/2 even though real connectors come in Phase 5. The adapter contract needs to be stable. Research does not specify the exact interface -- this needs a design decision during Phase 2.
- **Orchestrator-Worker communication in MVP:** Research recommends function calls in MVP (co-located), message queue at scale. The decision point for when to split is undefined. Add a monitoring threshold (e.g., >5 concurrent tenants with active tasks) as the trigger.
- **pgmq polling vs. pg_notify:** Research mentions polling for task pickup but notes pg_notify for near-real-time. The Phase 4 decision between these needs explicit research as the first performance-sensitive implementation decision.
- **Approval SLA values:** Research recommends SLA-based escalation for approvals but does not specify default SLA values. These should be configurable per-tenant and seeded with sensible defaults during Phase 4 design.

## Sources

### Primary (HIGH confidence)

- [Next.js releases + upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16) -- version strategy, breaking changes
- [AI SDK 6 announcement + docs](https://vercel.com/blog/ai-sdk-6) -- agent abstraction, ToolLoopAgent, streaming
- [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security) -- RLS policies, `auth.uid()` behavior
- [Supabase Queues (pgmq)](https://supabase.com/docs/guides/queues) -- durable queue patterns
- [shadcn/ui CLI v4 changelog](https://ui.shadcn.com/docs/changelog/2026-03-cli-v4) -- Tailwind v4 compatibility
- [Zod v4](https://zod.dev/v4) -- performance, TypeScript 5.5+ requirements
- [OWASP AI Agent Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html) -- injection, tool security
- [CVE-2025-48757](https://byteiota.com/supabase-security-flaw-170-apps-exposed-by-missing-rls/) -- RLS misconfiguration consequences
- [CVE-2025-29927: Next.js Middleware Bypass](https://vercel.com/blog/postmortem-on-next-js-middleware-bypass) -- defense in depth requirement
- [AWS: Building Multi-tenant Architectures for Agentic AI](https://docs.aws.amazon.com/pdfs/prescriptive-guidance/latest/agentic-ai-multitenant/agentic-ai-multitenant.pdf) -- multi-tenant agent patterns
- [Microsoft: AI Agent Orchestration Patterns](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns) -- orchestrator-worker architecture
- [Gartner: 40% of Enterprise Apps Will Feature AI Agents by 2026](https://www.gartner.com/en/newsroom/press-releases/2025-08-26-gartner-predicts-40-percent-of-enterprise-apps-will-feature-task-specific-ai-agents-by-2026-up-from-less-than-5-percent-in-2025) -- market context
- [Supabase Database Transactions Discussion](https://github.com/orgs/supabase/discussions/526) -- supabase-js transaction limitations

### Secondary (MEDIUM confidence)

- [Turborepo npm](https://www.npmjs.com/package/turbo) -- version 2.8.20
- [Tailwind CSS v4](https://tailwindcss.com/blog/tailwindcss-v4) -- CSS-only config, performance
- [Supabase RLS best practices (MakerKit)](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) -- multi-tenant patterns
- [Mission Control GitHub](https://github.com/builderz-labs/mission-control) -- closest competitor architecture
- [Deloitte: SaaS meets AI agents](https://www.deloitte.com/us/en/insights/industry/technology/technology-media-and-telecom-predictions/2026/saas-ai-agents.html) -- industry direction
- [Inngest: Multi-tenant queueing problems](https://www.inngest.com/blog/fixing-multi-tenant-queueing-concurrency-problems) -- fair queuing patterns
- [Microsoft: Secure Agentic AI End-to-End](https://www.microsoft.com/en-us/security/blog/2026/03/20/secure-agentic-ai-end-to-end/) -- credential and injection security

### Tertiary (LOW confidence)

- [Turborepo vs Nx 2026](https://www.pkgpulse.com/blog/turborepo-vs-nx-monorepo-2026) -- monorepo comparison (community post)
- [Docker Compose for AI agents](https://www.docker.com/blog/build-ai-agents-with-docker-compose/) -- deployment patterns (vendor blog)

---
*Research completed: 2026-03-25*
*Ready for roadmap: yes*
