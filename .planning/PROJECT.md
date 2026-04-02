# Fleet Factory

## What This Is

A single-operator control panel for deploying and managing AI agent swarms across dedicated VPS instances. This is TJ's personal tool — not a multi-tenant SaaS product, not a customer-facing platform. Each business client gets their own VPS with Docker-containerized agents, Claude Code OAuth authentication, and Slack as the sole interaction channel.

## Core Value

One admin panel (Vercel/Next.js) that lets a single operator spin up a full AI agent team for any client business — each on its own isolated VPS — and manage it all from one place. The operator configures agents, triggers deployments, and monitors activity. Clients interact with their agents exclusively through Slack.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- [x] Auth and user management via Supabase
- [x] Create business with name, slug, industry, owner
- [x] Seed default departments per business
- [x] Create agents from templates per department
- [x] Business creation wizard (6-step: Details → Departments → API Keys → Deployment Target → Subdomain → Review & Deploy)
- [x] RLS isolation on all operational tables via `is_business_member()` helper
- [x] Business overview dashboard with deployment status, agents, approvals, activity
- [x] Deployment lifecycle: queued → building → deploying → verifying → live
- [x] CEO-first Docker container deployment with cascading department head flow
- [x] SSH-based VPS deployment pipeline
- [x] Per-container OpenClaw instance on unique ports (19001+)
- [x] VPS proxy on :3100 routing chat/tasks to per-agent containers
- [x] Slack-first chat with department channels and per-channel conversations

### Active

<!-- Current scope. Building toward these. -->

- [ ] Claude Code OAuth per VPS — replace per-business Anthropic API key with OAuth tokens
- [ ] Single-agent hot-add deployment (add one agent to a live VPS without full redeploy)
- [ ] Live config sync — push updated agent configs to running containers without restart
- [ ] Agent configure wizard — step-by-step UI to configure an individual agent before deploying it
- [ ] Deploy progress UI — polling or live-stream feedback during VPS deployment
- [ ] Password-based SSH auth support (`VPS_SSH_PASSWORD` fallback alongside key auth)
- [ ] Port registry sync — keep `port-registry.json` on VPS consistent with DB agent records
- [ ] Agent status dashboard — per-container health, uptime, last activity per business
- [ ] Deployment history view with per-step logs

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Multi-tenant SaaS — this is a single-operator personal tool, not a product sold to customers
- Customer portal — clients never log in; they use Slack only
- Per-business Anthropic API keys — replaced by Claude Code OAuth per VPS
- WhatsApp or web chat — Slack is the only interaction channel
- R&D Council department — not part of default department pack
- CRM integration (Twenty or otherwise) — defer indefinitely
- Billing and metering — no monetization layer needed
- Dynamic agent spawning by clients — operator controls all agent creation
- Mobile app — web-first admin panel only
- Multi-region VPS — single VPS per business, one region at a time

## Context

### Architecture

```
Admin Panel (Vercel/Next.js)
        |
        v
Supabase (Postgres + Auth + RLS)
        |
        v (SSH per business)
VPS per Business
  ├── VPS Proxy (:3100)  — chat routing, task routing, Slack integration, health, rate limiting
  ├── Agent Container: CEO (:19001)  — OpenClaw + Claude Code OAuth
  ├── Agent Container: Sales Head (:19002)  — OpenClaw + Claude Code OAuth
  ├── Agent Container: Support Head (:19003)  — OpenClaw + Claude Code OAuth
  ├── Agent Container: Ops Head (:19004)  — OpenClaw + Claude Code OAuth
  └── port-registry.json  — tracks container-to-port mapping
```

The admin panel never routes requests through a shared API gateway. Each business has its own VPS reachable only via SSH from the admin backend.

### Business Model

One business = one VPS = one isolated agent workspace. The operator manages all businesses from a single admin panel. Businesses never share infrastructure, containers, secrets, or agent configurations.

### Agent Lifecycle

1. **Wizard deploys CEO only** — full container setup, OpenClaw running, Claude Code OAuth authenticated
2. **Department heads seeded as `ready_to_configure`** — records exist in DB, no containers yet
3. **Operator configures each agent** — admin wizard sets system prompt, tools, Slack channel mapping
4. **Operator deploys individually** — single-agent SSH deploy spins up container on next available port
5. **Live config sync** — operator pushes config changes to running containers without restart
6. **Hot-add at any time** — new agents can be added to a live VPS as the business grows

### Core Database Tables

| Table | Key Fields | Purpose |
|-------|-----------|---------|
| businesses | id, name, slug, industry, status, owner_user_id, vps_config | One client business per deployment target |
| business_users | id, business_id, user_id, role | Operator access control (operator-only in practice) |
| departments | id, business_id, name, type, status | CEO, Sales, Support, Operations |
| agent_templates | id, name, department_type, system_prompt, tool_profile, model_profile | Reusable role blueprints |
| agents | id, business_id, department_id, template_id, name, runtime_type, status, container_port | Live agent instances per business |
| tool_profiles | id, name, config_json, permission_level | Bundles of allowed tools per role |
| integrations | id, business_id, provider, credentials_ref, status | Slack, calendar, helpdesk per business |
| deployments | id, business_id, version, environment, status, started_at, finished_at | VPS deployment history |
| tasks | id, business_id, assigned_agent_id, title, payload_json, priority, status | Work queue for agents |
| approvals | id, business_id, task_id, requested_by_agent_id, action_type, status | Human gate for risky agent actions |
| conversations | id, business_id, agent_id, channel, transcript_ref, started_at | Slack message threads and agent context |
| audit_logs | id, business_id, actor_type, actor_id, event_type, metadata_json, created_at | Full action history |

### API Routes (v1)

| Method | Route | Purpose |
|--------|-------|---------|
| POST | /api/auth/sign-in | Operator login |
| POST | /api/businesses | Create a new business and queue deployment |
| GET | /api/businesses/:id | Load business overview |
| POST | /api/businesses/:id/deploy | Trigger full VPS deployment |
| POST | /api/businesses/:id/agents/:agentId/deploy | Deploy a single agent container |
| POST | /api/businesses/:id/agents/:agentId/sync | Push config changes to running container |
| GET | /api/deployments/:id | Check deployment progress and logs |
| POST | /api/agents/:id/tasks | Send work to a specific agent |
| GET | /api/businesses/:id/tasks | List all tasks across departments |
| POST | /api/approvals/:id/approve | Approve a gated action |
| POST | /api/approvals/:id/reject | Reject a gated action |
| GET | /api/businesses/:id/conversations | Load Slack conversation logs |
| GET | /api/businesses/:id/audit-logs | Load activity history |

### Admin Screens (in priority order)

1. Sign in
2. Businesses list
3. Create business wizard (6 steps)
4. Business overview dashboard
5. Agents list with per-agent status and deploy/configure actions
6. Agent configure wizard (set prompt, tools, Slack channel)
7. Deployment center with progress and history
8. Tasks and approvals queue
9. Slack conversation logs

### Three Core Flows

**Flow 1 — Business Provisioning:** Operator runs wizard → chooses departments and VPS target → submits. Creates DB records, generates OpenClaw configs, SSH-deploys CEO container, seeds remaining agents as `ready_to_configure`.

**Flow 2 — Agent Activation:** Operator opens agent configure wizard → sets system prompt and tools → clicks deploy. SSH-deploys single container on next available port, registers in port-registry, updates agent status to `live`.

**Flow 3 — Live Operation:** Slack message arrives in department channel → VPS proxy routes to correct container port → agent executes with tools → risky actions request approval via admin panel → operator approves/rejects → agent continues.

### Default Department Pack

| Department | Agent | Role Level | Tools |
|-----------|-------|-----------|-------|
| CEO | CEO Agent | 0 | dashboard_read, approvals, reporting, task_delegation |
| Sales | Sales Head | 1 | email, calendar, messaging |
| Support | Support Head | 1 | helpdesk, kb_search, email, messaging |
| Operations | Ops Head | 1 | task_queue, calendar, messaging, reporting |

Deploy order: CEO first (role_level 0), then department heads (role_level 1). CEO container is committed as base image template before heads spin up.

### RLS Strategy

Every operational table uses `is_business_member(business_id)` to scope access. In practice the operator is the sole user, but the RLS layer keeps data isolated per business and provides a clean foundation if the tool ever grows a team. The `business_users` table is the membership check for all business-scoped queries.

### Provisioning Flow

`provisionBusinessTenant()` does five things:
1. Create business record with VPS config
2. Create operator membership in business_users
3. Seed 4 default departments
4. Create agents from templates (CEO: `queued`, rest: `ready_to_configure`)
5. Create deployment job (status: `queued`)

### Delivery Phases

- **Phase 20:** SSH deployment + Docker container-per-agent + CEO-first flow (in progress)
- **Phase 21:** Claude Code OAuth per VPS — remove per-business API keys
- **Phase 22:** Single-agent hot-add + live config sync
- **Phase 23:** Deploy progress UI + deployment log streaming
- **Phase 24:** Agent configure wizard in admin panel

### Tech Stack

- Next.js 14+ App Router
- TypeScript (strict)
- Tailwind CSS + shadcn/ui
- Supabase (Auth, Postgres, RLS)
- Server Actions for mutations
- Docker for per-agent VPS containers
- OpenClaw per container for Claude access
- Claude Code OAuth for VPS-level authentication
- SSH for all VPS operations (password or key auth)

### Repo Structure

- apps/web = admin panel
- packages/db = schema, SQL, types, helpers
- packages/core = shared domain logic
- packages/ui = shared UI components
- packages/runtime = runtime builders, OpenClaw config generation, deployment helpers
- infra = docker, scripts, VPS entrypoints
- templates = department agent templates

## Constraints

- **Tech stack**: Next.js 14+ App Router, TypeScript strict, Supabase, shadcn/ui — already decided
- **Business isolation**: All operational data scoped by business_id with RLS enforced; each business on its own VPS
- **Interaction channel**: Slack only — no web chat, no WhatsApp, no customer portal
- **Authentication**: Claude Code OAuth per VPS — no per-business Anthropic API keys
- **Agent creation**: Operator-controlled only — no dynamic spawning by clients
- **Infrastructure**: One VPS per business with Docker containers for each agent
- **File size**: Keep files under 200 lines, prefer composable functions over deep abstractions

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single-operator tool, not SaaS | TJ's personal operations tool; no customer auth, portals, or billing needed | Confirmed |
| One VPS per business | Full isolation of infra, secrets, containers, and Slack routing per client | Confirmed |
| Slack-only interaction | Simplest reliable channel; avoids web chat complexity; clients already use Slack | Confirmed |
| Claude Code OAuth per VPS | Replaces per-business API keys; cleaner auth model; no key management per tenant | Decided |
| CEO-first deployment | CEO container is base image; heads inherit from it; reduces image build time | Confirmed |
| OpenClaw per container | Each agent container runs its own OpenClaw instance on a unique port | Confirmed |
| VPS proxy routes via port registry | Proxy maps Slack channels to container ports via port-registry.json on each VPS | Confirmed |
| SSH for all VPS ops | No REST API on VPS for deployment; SSH gives full control, simpler security model | Confirmed |
| Supabase for auth + DB + RLS | Fastest path to isolated Postgres with auth; RLS enforces business boundaries | Confirmed |
| Server Actions for mutations | Simpler than separate API routes for admin panel operations | Confirmed |
| 4 default departments | CEO, Sales, Support, Operations covers core ops for most small businesses | Confirmed |

---
*Last updated: 2026-04-02 — Fleet Factory rebrand and architecture pivot*
