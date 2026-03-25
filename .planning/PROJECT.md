# Agency Factory

## What This Is

A multi-tenant SaaS platform for deploying and managing AI agent stacks for client businesses. Each business gets its own command center with department-specific agents, deployment records, approvals, tasks, and logs. The platform provisions isolated tenant workspaces where AI agents handle department work — sales, support, operations — with human approval gates for risky actions.

## Core Value

One-click tenant provisioning that creates an isolated business workspace with department agents, deployment pipeline, and a command center to manage it all — so any client business can have their own AI operations team without mixing data, credentials, or agent configurations.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. -->

- [ ] Auth and user management via Supabase
- [ ] Create business tenant with name, slug, industry, owner
- [ ] Seed 4 default departments per business (Owner, Sales, Support, Operations)
- [ ] Create starter agents from templates per department
- [ ] Provision business tenant in one atomic flow (business → membership → departments → agents → deployment job)
- [ ] RLS tenant isolation on all operational tables via `is_business_member()` helper
- [ ] Business overview dashboard showing health, active agents, pending approvals, latest conversations, deployment status
- [ ] Create business wizard (name, industry, departments, integrations, deployment target)
- [ ] Departments setup page
- [ ] Agents list and agent detail pages
- [ ] Deployment center with deploy/redeploy capability
- [ ] Tasks page showing work queue across departments
- [ ] Approvals page with approve/reject for gated agent actions
- [ ] Command center chat plus conversation logs
- [ ] Audit log viewer for full action history
- [ ] Orchestrator service (Paperclip-style): company structure, task routing, roles, tickets, budget/governance
- [ ] Worker service (OpenClaw-style): execute department work through tools and plugins
- [ ] Builder service (Claude-powered): generate agent configs, prompts, and deployment artifacts
- [ ] Deployment runner generates tenant-config.json, docker-compose.generated.yml, .env.generated, and per-agent runtime configs
- [ ] Template-only agent creation (no dynamic spawning by end users in MVP)
- [ ] Builder agent can update prompts/tools/configs from templates and roll out across tenants

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Dynamic agent spawning by end users — wait until logs, permissions, and rollback are solid
- Real-time chat/WebSockets — polling or server actions sufficient for MVP
- OAuth/social login — email/password via Supabase Auth is enough for MVP
- Mobile app — web-first command center
- Multi-region deployment — single VPS target for MVP
- Per-agent billing/metering — defer until post-MVP monetization
- Custom department creation by end users — admin-only via templates

## Context

### Architecture (5 Layers)

| Layer | What It Does | MVP Choice |
|-------|-------------|------------|
| Admin App | Business onboarding, department setup, approvals, logs, command center | Custom Next.js web app |
| Orchestrator | Company structure, task routing, roles, tickets, budget/governance | Paperclip (built from scratch) |
| Worker Agents | Execute department work through tools and plugins | OpenClaw (built from scratch) |
| Builder Agent | Creates agent configs, prompts, repos, and deployment files | Claude-powered service |
| Infrastructure | Runs tenant workspaces and services on VPS | Docker on VPS |

Paperclip and OpenClaw are being **built from scratch** as internal services, not integrated from external products.

### Tenant Model

One business = one Paperclip company = one isolated workspace = one secret scope = one set of department agents. Each client gets their own command center. Never mix prompts, logs, channels, or credentials across businesses.

### Core Database Tables

| Table | Key Fields | Purpose |
|-------|-----------|---------|
| businesses | id, name, slug, industry, status, owner_user_id | One client company per tenant |
| business_users | id, business_id, user_id, role | Users assigned to a business command center |
| departments | id, business_id, name, type, status | Sales, Support, Ops, Owner |
| agent_templates | id, name, department_type, system_prompt, tool_profile, model_profile | Reusable role blueprints |
| agents | id, business_id, department_id, template_id, name, runtime_type, status | Live agent instances per tenant |
| tool_profiles | id, name, config_json, permission_level | Bundles of allowed tools per role |
| integrations | id, business_id, provider, credentials_ref, status | CRM, email, Slack, calendar, helpdesk |
| deployments | id, business_id, version, environment, status, started_at, finished_at | Tracks provisioning and releases |
| tasks | id, business_id, assigned_agent_id, title, payload_json, priority, status | Work queue for agents |
| approvals | id, business_id, task_id, requested_by_agent_id, action_type, status | Human approval gate for risky actions |
| conversations | id, business_id, agent_id, channel, transcript_ref, started_at | Message history and agent context |
| audit_logs | id, business_id, actor_type, actor_id, event_type, metadata_json, created_at | Full action history |

### API Routes (v1)

| Method | Route | Purpose |
|--------|-------|---------|
| POST | /api/auth/sign-in | User login |
| POST | /api/businesses | Create a new business tenant |
| GET | /api/businesses/:id | Load business overview |
| POST | /api/businesses/:id/departments | Add default or custom departments |
| GET | /api/businesses/:id/agents | List agents for a tenant |
| POST | /api/businesses/:id/deploy | Trigger initial deployment job |
| GET | /api/deployments/:id | Check deployment progress |
| POST | /api/agents/:id/tasks | Send work to a specific agent |
| GET | /api/businesses/:id/tasks | List all tasks across departments |
| POST | /api/approvals/:id/approve | Approve a gated action |
| POST | /api/approvals/:id/reject | Reject a gated action |
| GET | /api/businesses/:id/conversations | Load command-center transcripts |
| GET | /api/businesses/:id/audit-logs | Load activity history |
| POST | /api/builder/generate-agent | Generate prompt/config/package for a new role |
| POST | /api/integrations/:provider/connect | Save integration config and kickoff validation |

Three internal services behind routes: orchestrator-service, worker-service, builder-service.

### MVP Screens (in build order)

1. Sign in
2. Businesses list
3. Create business wizard
4. Business overview dashboard
5. Departments setup
6. Agents list
7. Agent detail page
8. Deployment center
9. Tasks and approvals
10. Command center chat plus logs

### Three Core Flows

**Flow 1 — Tenant Provisioning:** Admin creates business → chooses template → selects departments → clicks deploy. Creates tenant records, Paperclip company, clones role templates, generates OpenClaw configs, attaches tool permissions, creates deployment job for VPS.

**Flow 2 — Live Operation:** Tasks enter through admin panel or connected channel → orchestrator assigns work → department agent executes with allowed tools → risky actions pause for approval.

**Flow 3 — Iteration:** Claude-powered builder agent updates prompts, tools, or agent definitions from templates → improvements roll out across future tenants.

### Default Department Pack

| Department | Agent | Tools | Model |
|-----------|-------|-------|-------|
| Owner | Owner Agent | dashboard_read, approvals, reporting | claude-sonnet |
| Sales | Sales Agent | crm, email, calendar, messaging | claude-sonnet |
| Support | Support Agent | helpdesk, kb_search, email, messaging | claude-sonnet |
| Operations | Operations Agent | task_queue, calendar, messaging, reporting | claude-sonnet |

### RLS Strategy

Every operational table uses `is_business_member(business_id)` to scope access. Roles (owner, admin, manager) gate write operations. The `business_users` table is the membership check for all tenant-scoped queries.

### Provisioning Flow

`provisionBusinessTenant()` does five things atomically:
1. Create business record
2. Create owner membership in business_users
3. Seed 4 default departments
4. Create agents from matching templates (status: 'provisioning', runtime: 'openclaw')
5. Create deployment job (status: 'queued')

### Delivery Phases

- **Phase 1:** Auth, business creation, tenant scoping, default templates, first 6 screens
- **Phase 2:** Deployment jobs, Paperclip company creation, OpenClaw worker registration, approvals
- **Phase 3:** Builder-agent automation, reusable role templates, integration connectors

### Demo Target

Full loop: provision a business → send a task to an agent → see it execute with approval flow → builder agent updates configs and rolls changes out.

### Tech Stack

- Next.js 14+ App Router
- TypeScript (strict)
- Tailwind CSS + shadcn/ui
- Supabase (Auth, Postgres, RLS)
- Server Actions where useful
- Docker for VPS deployment artifacts

### Repo Structure

- apps/web = admin panel
- packages/db = schema, SQL, types, helpers
- packages/core = shared domain logic
- packages/ui = shared UI components
- packages/runtime = runtime builders, config generation, deployment helpers
- apps/worker or packages/worker = async deployment jobs
- infra = docker, scripts, deployment helpers
- templates = department agent templates

## Constraints

- **Tech stack**: Next.js 14+ App Router, TypeScript strict, Supabase, shadcn/ui — already decided
- **Tenant isolation**: All operational data must be scoped by business_id with RLS enforced
- **Agent creation**: Template-only in MVP — no dynamic spawning by end users
- **Infrastructure**: Single VPS with Docker for MVP deployment target
- **External integrations**: Use safe stubs or mock adapters — don't block MVP on real integrations
- **File size**: Keep files under 200 lines, prefer composable functions over deep abstractions

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build Paperclip/OpenClaw from scratch | Full control over orchestration and runtime layers | — Pending |
| Supabase for auth + database + RLS | Fastest path to tenant-isolated Postgres with auth | — Pending |
| Template-only agents for MVP | Need logs, permissions, rollback before dynamic spawning | — Pending |
| Claude-powered builder service (not Claude Code) | Builder uses programmable agent stack, not CLI | — Pending |
| Server Actions for mutations | Simpler than API routes for admin panel operations | — Pending |
| 4 default departments | Owner, Sales, Support, Operations covers most small businesses | — Pending |

---
*Last updated: 2026-03-25 after initialization*
