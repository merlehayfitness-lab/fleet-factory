# Phase 6: OpenClaw Deployment & Live VPS Runtime — Research

**Researched:** 2026-03-26
**Phase Goal:** Replace mock/stub execution with real VPS deployment and live agent routing. Admin app deploys OpenClaw-native workspaces to a Hostinger VPS via Claude Code, tasks and chat route to real agents running on the VPS.

## 1. Existing Code That Must Change

### Stubs and Mocks to Replace

**`packages/core/chat/chat-stub.ts`** — `generateStubResponse()` returns keyword-matched canned responses per department. Called from `chat-service.ts` `routeAndRespond()`. Must be replaced with a VPS client that sends the message to the real OpenClaw agent and streams the response back.

**`packages/core/worker/tool-runner.ts`** — `getMockResult()` returns simulated tool outputs. Called from `runTool()` and `runAgentTask()`. Must be replaced with a VPS client that sends the task payload to the real OpenClaw agent and returns the actual execution result.

**`packages/core/deployment/service.ts`** — `triggerDeployment()` line 273 says "For MVP: no actual Docker deployment. Transition to 'live'." The deploying-to-live transition currently skips any real infrastructure work. Must be replaced with: generate OpenClaw workspace artifacts, push to VPS, wait for Claude Code to review/optimize/deploy, then transition to live on confirmed health check.

### Existing Generators to Evolve

**`packages/runtime/generators/`** contains four pure-function generators:
- `tenant-config.ts` — generates `tenant-config.json` (business metadata, departments, agents)
- `docker-compose.ts` — generates `docker-compose.generated.yml` (one service per agent)
- `env-file.ts` — generates `.env.generated` (business ID, secrets)
- `agent-runtime.ts` — generates `agent-{id}.json` (system_prompt, tool_profile, model_profile)

These generate the current artifact format. Phase 6 needs **new generators** for OpenClaw-native workspace files (AGENTS.md, SOUL.md, IDENTITY.md, openclaw.json, TOOLS.md) while keeping the old generators for backward compatibility / Supabase snapshot storage.

### Integration Points in Orchestrator

**`packages/core/orchestrator/executor.ts`** — `executeTask()` calls `runAgentTask()` from the worker. For VPS routing, executor needs a conditional path: if VPS is online, send to VPS via REST; if VPS is offline, queue the task and return graceful degradation status.

**`packages/core/chat/chat-service.ts`** — `routeAndRespond()` calls `generateStubResponse()`. Must be replaced with VPS chat routing that sends message to OpenClaw agent and streams response back.

### Database Schema — What Exists

**`deployments` table** — id, business_id, version, status (6 states), config_snapshot (jsonb), error_message, started_at, completed_at, triggered_by, rolled_back_to. The config_snapshot already stores generated artifacts. Phase 6 needs to extend this to also store the Claude Code optimization diff report.

**`agents` table** — has system_prompt, tool_profile (jsonb), model_profile (jsonb), department_id, status. These fields map to OpenClaw workspace generation inputs.

**`conversations` and `messages` tables** — already store chat history with tool_calls jsonb. VPS responses will write to these same tables.

## 2. OpenClaw Platform Architecture (Researched)

### Workspace File Structure

Each OpenClaw agent operates from a workspace directory (`~/.openclaw/workspace` or per-agent workspace). Core files injected into every session:

| File | Purpose | Maps To |
|------|---------|---------|
| `AGENTS.md` | Operational rules, routing policies, scope boundaries | agent.system_prompt + tool_profile rules |
| `SOUL.md` | Personality, tone, communication style | department-specific persona generation |
| `IDENTITY.md` | Agent name, avatar, emoji (3-5 lines) | agent.name + department metadata |
| `USER.md` | User identity, timezone, preferences | business context (industry, brand) |
| `TOOLS.md` | Environment-specific details (API endpoints, SSH hosts) | integration config, tool endpoints |
| `MEMORY.md` | Learned patterns, user preferences, project history | persists across redeployments |
| `HEARTBEAT.md` | Periodic task checklist for cron operations | optional for always-on agents |
| `BOOT.md` | Startup sequence on gateway restart | agent initialization routine |
| `BOOTSTRAP.md` | One-time initialization (deleted after use) | first-deploy setup |

Configuration lives separately in `~/.openclaw/openclaw.json`:
```json
{
  "agent": {
    "model": "anthropic/claude-opus-4-6",
    "workspace": "~/.openclaw/workspace"
  }
}
```

### Multi-Agent Configuration

OpenClaw supports multiple agents via `agents.list` in `openclaw.json`:
```json
{
  "agents": {
    "list": [
      { "id": "sales", "workspace": "~/.openclaw/workspace-sales", "model": "anthropic/claude-sonnet-4" },
      { "id": "support", "workspace": "~/.openclaw/workspace-support", "model": "anthropic/claude-sonnet-4" },
      { "id": "owner", "workspace": "~/.openclaw/workspace-owner", "model": "anthropic/claude-opus-4-6" }
    ]
  }
}
```

Each agent gets:
- Own workspace directory with its own AGENTS.md, SOUL.md, etc.
- Own state directory (`~/.openclaw/agents/<agentId>/`)
- Own session store (`~/.openclaw/agents/<agentId>/sessions`)
- Optional per-agent model and provider

### Inter-Agent Communication

Three tools enable cross-agent coordination:
- `sessions_list` — discover active sessions and metadata
- `sessions_history` — fetch transcript logs for another session
- `sessions_send` — message another session (supports reply-back loop)

Requires explicit opt-in: `tools.agentToAgent: { enabled: true, allow: ["agent1", "agent2"] }`

Max ping-pong turns controlled by `session.agentToAgent.maxPingPongTurns` (0-5, default 5).

### Docker Sandbox Configuration

OpenClaw runs tool execution in isolated Docker containers:
- Default image: `openclaw-sandbox:bookworm-slim`
- Common image: `openclaw-sandbox-common:bookworm-slim` (includes Node.js, Python, curl, jq, git)
- Scope options: `session` (one container per session), `agent` (one per agent), `shared`
- Mode: `off`, `non-main`, `all`
- Custom bind mounts via `agents.defaults.sandbox.docker.binds` (format: `host:container:mode`)
- Network isolation: containers default to no network; must explicitly configure
- Workspace access: `none` (default), `ro`, `rw`

### Gateway API Access

The OpenClaw gateway exposes:
- **WebSocket control plane**: `ws://127.0.0.1:18789` — primary communication
- **POST /v1/chat/completions**: OpenAI-compatible endpoint (disabled by default, must enable)
- **POST /tools/invoke**: Direct tool execution without LLM
- **POST /v1/responses**: Structured data extraction
- **GET /healthz**: Liveness probe (unauthenticated)
- **GET /readyz**: Readiness probe (unauthenticated)
- **Authentication**: Bearer token required for all endpoints

### Channel Routing

Inbound messages route to agents via binding rules:
1. `peer` (exact DM/group/channel ID)
2. `accountId` match
3. Channel-level fallback
4. Default agent

For our use case, the admin app will use the HTTP `/v1/chat/completions` endpoint or WebSocket to send messages directly to specific agents by ID.

## 3. Architecture Decisions

### VPS Communication Layer

**Admin App (Vercel) to VPS communication** requires a new `packages/core/vps/` module:

```
packages/core/vps/
  vps-client.ts       — HTTP/WebSocket client for VPS communication
  vps-types.ts        — Request/response types for VPS API
  vps-health.ts       — Health check polling and status tracking
  vps-config.ts       — VPS connection configuration (URL, API key)
```

**Protocol design:**
- HTTPS REST for deployment commands, task submission, agent status queries
- WebSocket for real-time deployment progress streaming and chat message streaming
- API key auth via shared secret in `X-API-Key` header
- All requests include `business_id` for tenant scoping on VPS side

**VPS-side API surface** (what the admin app calls):
- `POST /api/deploy` — send deployment package
- `POST /api/deploy/:id/cancel` — cancel in-progress deployment
- `GET /api/deploy/:id/status` — poll deployment status
- `POST /api/agents/:agentId/chat` — send chat message to agent
- `POST /api/agents/:agentId/task` — submit task to agent
- `GET /api/agents/:agentId/health` — check agent health
- `GET /api/health` — VPS overall health
- `WS /ws/deploy/:id` — stream deployment progress
- `WS /ws/chat/:conversationId` — stream chat responses

**Key decision:** The VPS needs a lightweight Express/Fastify API server that translates admin app requests into OpenClaw gateway commands. This is a thin proxy layer — it receives structured commands from the admin app, translates them into OpenClaw CLI commands or gateway WebSocket calls, and streams results back.

### OpenClaw Workspace Generator

New generators needed in `packages/runtime/generators/`:

```
packages/runtime/generators/
  openclaw-workspace.ts    — orchestrates full workspace generation
  openclaw-agents-md.ts    — generates AGENTS.md from system_prompt + tool_profile
  openclaw-soul-md.ts      — generates SOUL.md from department type + agent persona
  openclaw-identity-md.ts  — generates IDENTITY.md from agent name + department
  openclaw-tools-md.ts     — generates TOOLS.md from integration config
  openclaw-config.ts       — generates openclaw.json with agents.list and sandbox config
  openclaw-user-md.ts      — generates USER.md from business context
```

**Generation approach (hybrid per CONTEXT):**
1. Admin app generates base workspace files using these generators
2. Files are packaged as a deployment payload (JSON with file contents)
3. Payload is sent to VPS via `POST /api/deploy`
4. Claude Code on VPS receives the package, reviews/optimizes files
5. Claude Code sends back a structured diff report
6. Admin app stores both original and optimized versions in deployment snapshot

### Deployment Pipeline Evolution

Current flow (Phase 3):
```
trigger → queued → building (generate artifacts) → deploying (no-op) → live
```

New flow (Phase 6):
```
trigger → queued → building (generate OpenClaw workspace + legacy artifacts)
  → deploying (push to VPS via REST API)
  → VPS receives package
  → Claude Code reviews/optimizes workspace files
  → Claude Code deploys agent containers
  → VPS reports deployment status events via WebSocket
  → Admin app receives success/partial-failure/failure
  → Post-deploy health check (ping each agent)
  → live (all agents verified) | degraded (some agents failed) | failed
```

**New deployment statuses needed:** The existing lifecycle has `queued | building | deploying | live | failed | rolled_back`. Phase 6 adds `verifying` (post-deploy health check) and the concept of `degraded` (partial failure where some agents are live and some failed).

### Live Task Routing

Current flow (Phase 4):
```
task created → orchestrator routes to agent → runAgentTask() with mock tools → result stored
```

New flow (Phase 6):
```
task created → orchestrator routes to agent → check VPS health
  → if VPS online: POST /api/agents/:agentId/task → real agent executes → result flows back → stored in Supabase
  → if VPS offline: queue task, set status to "queued_offline", return graceful degradation
```

The orchestrator (router.ts, executor.ts) remains the decision-maker for WHICH agent handles a task. The VPS handles HOW the agent executes.

### Live Chat Routing

Current flow (Phase 5):
```
user sends message → routeAndRespond() → selectAgent() → generateStubResponse() → store in messages table
```

New flow (Phase 6):
```
user sends message → store user message → check VPS health
  → if VPS online: POST /api/agents/:agentId/chat or WS stream → real agent responds → store agent message
  → if VPS offline: store system message "Agent offline — message queued"
```

Chat responses should stream via WebSocket for a real-time typing experience. The admin app opens a WebSocket connection per active chat, and agent response tokens stream in as they're generated.

### VPS Bootstrap Strategy

One-time manual setup on Hostinger VPS:
1. SSH into VPS, install Node.js 24+, Docker, OpenClaw
2. Run `openclaw onboard --install-daemon`
3. Configure gateway to bind to LAN (for API access)
4. Enable `/v1/chat/completions` endpoint
5. Configure sandbox with `openclaw-sandbox-common` image
6. Set up the thin API proxy server (Express app)
7. Run a bootstrap prompt to teach Claude Code the Agency Factory system

**Bootstrap prompt** teaches Claude Code:
- The tenant workspace structure it will manage
- How deployment packages arrive and what to do with them
- How to create/update OpenClaw agent workspaces from deployment packages
- How to use Docker containers for agent sandboxing
- How to report status back via the API

After bootstrap, the admin app manages everything via the API. Re-bootstrap is available via admin command.

### Shared Business Directory

Per CONTEXT: "Shared read-only business directory — all agents in a business can read shared docs."

Implementation: Docker bind mount a shared directory per business:
```
/data/tenants/{business_slug}/shared/ → mounted as /shared:ro in each agent container
```

Contains: brand guidelines, product info, FAQs, and any business-wide documents. Updated via deployment or separate file sync.

### Agent Memory Persistence

Per CONTEXT: "Agent memory persists across redeployments."

OpenClaw stores memory in `memory/YYYY-MM-DD.md` files and `MEMORY.md`. During redeployment:
- Back up existing workspace memory files before overwriting workspace
- Restore memory files after deploying new workspace config
- This means deployment must NOT wipe the entire workspace directory — only replace config files (AGENTS.md, SOUL.md, etc.) while preserving `memory/` and session data

### Rollback Strategy

Per CONTEXT: "Rollback restores exact workspace snapshot from previous successful deployment."

Current rollback creates a new deployment from old config_snapshot. Phase 6 extends this:
1. Fetch the target deployment's stored workspace files from Supabase
2. Send to VPS as a deployment package (but skip Claude Code optimization — use exact stored files)
3. Deploy directly without Claude Code review
4. This ensures deterministic rollback (same files every time)

## 4. Schema Changes Needed

### New columns on deployments table
```sql
-- Store Claude Code's optimization diff report
ALTER TABLE public.deployments
  ADD COLUMN IF NOT EXISTS optimization_report jsonb,
  ADD COLUMN IF NOT EXISTS deploy_target text DEFAULT 'local'
    CHECK (deploy_target IN ('local', 'vps')),
  ADD COLUMN IF NOT EXISTS vps_deploy_id text;
```

### New table: vps_status
```sql
CREATE TABLE IF NOT EXISTS public.vps_status (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  status text NOT NULL DEFAULT 'unknown'
    CHECK (status IN ('online', 'offline', 'degraded', 'unknown')),
  last_checked_at timestamptz DEFAULT now(),
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL
);
```

This is a singleton table (one row) tracking the shared VPS health state. The admin app polls this on dashboard load.

### New table: agent_vps_status
```sql
CREATE TABLE IF NOT EXISTS public.agent_vps_status (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL REFERENCES public.agents ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  vps_agent_id text NOT NULL,
  container_status text DEFAULT 'unknown'
    CHECK (container_status IN ('running', 'stopped', 'error', 'unknown')),
  last_health_check_at timestamptz,
  last_response_at timestamptz,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
```

Tracks per-agent VPS runtime status. Updated by post-deploy health checks and periodic polling.

## 5. File Impact Analysis

### New Files (estimated ~25-30)

**packages/core/vps/** (new module — ~6 files):
- `vps-client.ts` — HTTP + WebSocket client
- `vps-types.ts` — request/response types
- `vps-health.ts` — health check service
- `vps-config.ts` — connection configuration
- `vps-deploy.ts` — deployment push logic
- `vps-chat.ts` — chat routing to VPS agents

**packages/runtime/generators/** (new generators — ~7 files):
- `openclaw-workspace.ts` — workspace orchestrator
- `openclaw-agents-md.ts` — AGENTS.md generator
- `openclaw-soul-md.ts` — SOUL.md generator
- `openclaw-identity-md.ts` — IDENTITY.md generator
- `openclaw-tools-md.ts` — TOOLS.md generator
- `openclaw-config.ts` — openclaw.json generator
- `openclaw-user-md.ts` — USER.md generator

**apps/web/_actions/** (new/modified — ~2 files):
- `vps-actions.ts` — VPS health check, re-bootstrap actions
- Modified: `deployment-actions.ts`, `chat-actions.ts`, `task-actions.ts`

**apps/web/_components/** (new/modified — ~4 files):
- `vps-status-indicator.tsx` — VPS health badge for dashboard
- `deployment-progress-stream.tsx` — real-time deployment progress
- `deployment-diff-viewer.tsx` — Claude Code optimization diff
- Modified: `health-dashboard.tsx`, chat components

**infra/** (new — ~4 files):
- `vps/api-server.ts` — thin Express proxy on VPS
- `vps/bootstrap-prompt.md` — Claude Code bootstrap instructions
- `vps/docker-compose.vps.yml` — VPS Docker setup
- `vps/setup.sh` — VPS bootstrap script

**Database migrations** (~3 files):
- `027_vps_status_table.sql`
- `028_agent_vps_status_table.sql`
- `029_deployments_vps_columns.sql`

### Modified Files (estimated ~10-15)

- `packages/core/deployment/service.ts` — add VPS push step in deployment pipeline
- `packages/core/deployment/lifecycle.ts` — add `verifying` status
- `packages/core/deployment/snapshot.ts` — add OpenClaw workspace files to snapshot
- `packages/core/worker/tool-runner.ts` — add VPS execution path alongside mock
- `packages/core/chat/chat-service.ts` — replace stub with VPS routing
- `packages/core/orchestrator/executor.ts` — add VPS-aware execution path
- `packages/core/health/health-service.ts` — add VPS health to system health
- `packages/core/types/index.ts` — add new status types
- `packages/runtime/index.ts` — export new generators
- `apps/web/_components/health-dashboard.tsx` — add VPS status indicator
- `apps/web/app/(dashboard)/businesses/[id]/chat/page.tsx` — wire WebSocket
- `apps/web/_actions/deployment-actions.ts` — call VPS deploy
- `apps/web/_actions/chat-actions.ts` — route to VPS

## 6. Plan Breakdown Strategy

### Plan 06-01: OpenClaw Workspace Generators + VPS Client Module
**New generators:** AGENTS.md, SOUL.md, IDENTITY.md, TOOLS.md, USER.md, openclaw.json generators as pure functions in `packages/runtime/generators/`
**VPS client module:** `packages/core/vps/` with HTTP client, types, config helper
**Schema:** vps_status table, agent_vps_status table, deployment columns
**Types:** VPS status types, OpenClaw workspace types
**No UI** — pure backend/library work
**Files ~15-18**

**Requirements covered:** DEPL-VPS-01 (workspace artifact generation), DEPL-VPS-02 (partial — client module), DEPL-VPS-10 (partial — artifact storage)

### Plan 06-02: VPS Deployment Pipeline + Health Checks
**Deployment service evolution:** Extend `triggerDeployment()` to push workspace package to VPS
**VPS deploy service:** Send deployment payload, receive status events, handle partial failure
**Health checks:** VPS health endpoint polling, per-agent health verification, dashboard status
**Rollback evolution:** Send stored workspace snapshot to VPS (skip Claude Code optimization)
**WebSocket:** Deployment progress streaming from VPS to admin app
**UI:** VPS status indicator on dashboard, deployment progress stream component, diff viewer for Claude Code optimizations
**Files ~15-18**

**Requirements covered:** DEPL-VPS-02, DEPL-VPS-03, DEPL-VPS-04, DEPL-VPS-05, DEPL-VPS-06, DEPL-VPS-07, DEPL-VPS-08, DEPL-VPS-09, DEPL-VPS-10

### Plan 06-03: Live Task and Chat Routing to VPS Agents
**Task routing:** Replace mock tool execution with VPS task submission
**Chat routing:** Replace stub responses with real VPS agent chat
**Graceful degradation:** Offline detection, task queuing, "Agent offline" messages
**Inter-agent messaging:** Enable sessions_send between agents in same business
**WebSocket chat streaming:** Real-time agent response streaming in chat UI
**Files ~12-15**

**Requirements covered:** LIVE-01, LIVE-02, LIVE-03, LIVE-04, LIVE-05

### Plan 06-04: VPS Bootstrap, Infra Scripts, and Integration Testing
**Bootstrap:** VPS setup script, Claude Code bootstrap prompt, Docker compose for VPS
**API proxy:** Thin Express server on VPS that translates admin app requests to OpenClaw commands
**Integration testing:** End-to-end flow verification (deploy, task, chat)
**Documentation:** VPS setup guide for operators
**Files ~8-10**

**Requirements covered:** Cross-cutting — validates all DEPL-VPS and LIVE requirements work end-to-end

## 7. Technical Considerations

### WebSocket Implementation

The admin app runs on Vercel (serverless). Vercel does not support long-lived WebSocket connections from server-side code. Options:

**Option A: Client-side WebSocket** — The browser connects directly to the VPS WebSocket endpoint. The VPS API proxy handles auth via the shared API key passed as a query parameter or in the WebSocket handshake headers. This is simplest and works well for real-time streaming.

**Option B: Polling fallback** — If WebSocket is not available (corporate firewalls, etc.), fall back to polling the VPS REST endpoint every 1-2 seconds. The deployment progress and chat use the same polling pattern already established in Phase 4 (approvals) and Phase 5 (audit log live tail).

**Recommended: Option A (client-side WebSocket) with Option B as fallback.** The VPS API proxy exposes WebSocket endpoints for deployment streaming and chat. The admin app's client components connect directly. If connection fails, fall back to polling.

### Security Between Admin App and VPS

- HTTPS enforced for all REST communication
- Shared API key in `X-API-Key` header (stored as env var on both Vercel and VPS)
- WebSocket connections authenticated via token in handshake
- VPS firewall allows only Vercel's IP range + admin SSH access
- All tenant data in requests includes `business_id` — VPS validates tenant isolation
- Claude Code on VPS never receives decrypted secrets directly — secrets are injected into Docker containers via env vars managed by the VPS API proxy

### Handling VPS Downtime

When VPS is unreachable:
- **Tasks:** Queue in Supabase with status `queued`. When VPS comes back, a reconciliation job processes queued tasks.
- **Chat:** Show "Agent offline — your message has been saved and will be delivered when the agent is back online." Store user message in messages table. When VPS recovers, do NOT auto-send queued messages (context may be stale). Instead, show a notification that agents are back online.
- **Deployments:** Cannot deploy. Show VPS offline status in deployment center. Queue deployment for when VPS recovers.
- **Dashboard:** VPS status indicator shows "Offline" with last-seen timestamp. Agent cards show "VPS Offline" status.

### Token Budget for OpenClaw Workspace Files

Each OpenClaw workspace file costs tokens on every agent session. Per the docs, a 10,000-character AGENTS.md costs ~2,500 tokens per session. Budget constraints:
- `AGENTS.md`: max 8,000 chars (~2,000 tokens) — operational rules only
- `SOUL.md`: max 4,000 chars (~1,000 tokens) — personality essentials
- `IDENTITY.md`: max 500 chars — name and emoji only
- `USER.md`: max 3,000 chars (~750 tokens) — business context
- `TOOLS.md`: max 4,000 chars (~1,000 tokens) — integration endpoints
- Total bootstrap budget: ~5,750 tokens per session start

Generators must enforce these limits and prioritize the most important content.

### OpenClaw Config for Multi-Tenant

Single shared OpenClaw gateway for all tenants. Agent IDs namespaced by business slug:
```
{business_slug}-{department_type}-{agent_id_prefix}
```

Example: `acme-sales-a1b2c3d4`, `acme-support-e5f6g7h8`

Channel routing uses these IDs to route requests to the correct agent workspace. The VPS API proxy maps `business_id + agent_id` from admin app requests to the namespaced OpenClaw agent ID.

### Partial Failure Handling

Per CONTEXT: "If 3 of 5 agents deploy successfully and 2 fail, the 3 stay live, failed ones get retried."

Implementation:
- Deployment tracks per-agent deploy status in `config_snapshot.deploy_results[]`
- If any agent fails, deployment status = `degraded` (not `failed`)
- Dashboard shows which agents are live vs failed
- Admin can retry failed agents individually via `POST /api/deploy/:id/retry-agent/:agentId`
- Full retry re-deploys all agents

### VPS API Proxy Architecture

The VPS runs a thin Node.js/Express server alongside the OpenClaw gateway:

```
VPS Architecture:
  [OpenClaw Gateway] ← WebSocket → [API Proxy Server] ← HTTPS → [Admin App on Vercel]
       ↕                                  ↕
  [Agent Sandboxes]              [Docker Management]
  (per-agent containers)         (deploy, health check)
```

The API proxy:
1. Authenticates requests via API key
2. Translates deployment packages into OpenClaw workspace file writes
3. Invokes Claude Code via OpenClaw gateway to review/optimize
4. Manages Docker containers for agent sandboxes
5. Routes chat/task messages to correct OpenClaw agent via gateway
6. Streams responses back to admin app
7. Runs health checks and reports status

## 8. Requirement Coverage

| Requirement | Covered By | Implementation |
|-------------|-----------|----------------|
| DEPL-VPS-01 | Plan 06-01 | New OpenClaw workspace generators (AGENTS.md, SOUL.md, etc.) |
| DEPL-VPS-02 | Plan 06-01 + 06-02 | VPS client module + HTTPS + API key auth |
| DEPL-VPS-03 | Plan 06-02 + 06-04 | Claude Code receives packages via API proxy, reviews/deploys |
| DEPL-VPS-04 | Plan 06-02 | WebSocket deployment progress streaming |
| DEPL-VPS-05 | Plan 06-02 + 06-04 | Docker containers per agent via OpenClaw sandbox config |
| DEPL-VPS-06 | Plan 06-02 | VPS health endpoint + dashboard status indicator |
| DEPL-VPS-07 | Plan 06-02 | Rollback sends stored workspace snapshot (skip Claude Code) |
| DEPL-VPS-08 | Plan 06-02 | Full-tenant and per-agent deploy via API proxy |
| DEPL-VPS-09 | Plan 06-02 | Post-deploy health check pings each agent via gateway |
| DEPL-VPS-10 | Plan 06-01 + 06-02 | Artifacts stored in Supabase snapshot + VPS filesystem |
| LIVE-01 | Plan 06-03 | Task routing via VPS REST API replaces mock execution |
| LIVE-02 | Plan 06-03 | Chat routing via VPS WebSocket replaces stub responses |
| LIVE-03 | Plan 06-03 | VPS responses stored in Supabase messages/tasks tables |
| LIVE-04 | Plan 06-03 | Graceful degradation: queue tasks, show "Agent offline" |
| LIVE-05 | Plan 06-03 + 06-04 | Inter-agent messaging via OpenClaw sessions_send |

All 15 requirements covered across 4 plans.

## 9. Risk Assessment

### High Risk
- **VPS API proxy is new infrastructure** — no existing codebase pattern for this. Needs careful design of the Express server, auth, error handling, and OpenClaw gateway integration. Mitigate by keeping it minimal and well-typed.
- **WebSocket from Vercel client to VPS** — requires CORS configuration, auth in handshake, reconnection logic, and handling of dropped connections. Mitigate with polling fallback.

### Medium Risk
- **OpenClaw workspace generation quality** — generated AGENTS.md and SOUL.md quality determines agent behavior quality. Claude Code optimization on VPS helps, but the base generation must be solid. Mitigate by studying existing OpenClaw workspace examples and testing against known-good patterns.
- **Multi-tenant isolation on shared VPS** — all tenants on one VPS means agent namespacing and file isolation must be correct. Mitigate with namespaced agent IDs and per-tenant workspace directories.
- **Deployment progress streaming granularity** — Claude Code's optimization step is opaque from the admin app's perspective. Mitigate by defining structured progress events in the API proxy.

### Low Risk
- **Graceful degradation** — fallback patterns are well-understood (queue + status indicator). Existing polling patterns from Phase 4/5 apply directly.
- **Database schema changes** — additive columns and new tables only, no breaking changes to existing tables.

## RESEARCH COMPLETE
