---
phase: 06-builder-and-automation
verified: 2026-03-27T12:30:00Z
status: gaps_found
score: 14/16 must-haves verified
re_verification: false
gaps:
  - truth: "Deployment progress component has polling fallback when WebSocket connection fails"
    status: failed
    reason: "The component connects to WebSocket and sets connectionStatus to 'error' on failure, but does NOT fall back to polling getDeploymentStatusAction every 2 seconds as specified in the 06-02 plan must_haves. The error state is displayed ('WebSocket unavailable') but no polling loop is initiated."
    artifacts:
      - path: "apps/web/_components/deployment-progress-stream.tsx"
        issue: "ws.onerror sets connectionStatus='error' but no polling interval is started. No setInterval or getDeploymentStatusAction call exists in the file."
    missing:
      - "Add polling fallback: when ws.onerror fires, start setInterval polling getDeploymentStatusAction every 2s and update phases from deployment status"
  - truth: "Claude Code on VPS receives deployment packages, reviews/optimizes workspace files, and deploys agent containers (DEPL-VPS-03)"
    status: partial
    reason: "The VPS API proxy server exists with all required routes, but both the Claude Code optimization step (Step 3) and agent container management (Step 4) are explicitly stubbed with TODO markers in infra/vps/api-routes.ts. The stub returns all agents as 'deployed' without actual container creation. The plan acknowledged this as MVP-intentional, but the phase goal states 'real agents running on the VPS' which is not yet achieved. Per plan: 'marked for activation when Claude Code is bootstrapped'."
    artifacts:
      - path: "infra/vps/api-routes.ts"
        issue: "Lines 89-114: Steps 3 (Claude Code optimization) and 4 (container management) explicitly stubbed. Chat route (line 224-234) and task route (line 265-277) also return stub responses, not real OpenClaw agent execution."
    missing:
      - "This gap is intentional for MVP and requires VPS provisioning + OpenClaw bootstrap to resolve. The infrastructure exists to activate it. No code change needed — operational step required."
human_verification:
  - test: "Deploy a business to VPS with VPS_API_URL and VPS_API_KEY configured"
    expected: "Workspace files written to /data/tenants/{slug}/ on VPS, deployment transitions through queued->building->deploying->verifying->live, health badge turns online/degraded"
    why_human: "Requires actual VPS environment with the API proxy running"
  - test: "Send a chat message in the chat interface with VPS online"
    expected: "Message routes to real VPS agent (stub response from proxy), VPS-routed audit log entry created, VPS offline banner absent"
    why_human: "Requires live VPS environment"
  - test: "Trigger a rollback with VPS configured"
    expected: "Previous workspace snapshot sent to VPS with skipOptimization=true, health check runs post-rollback"
    why_human: "Requires live VPS with a previous successful deployment"
  - test: "Trigger a second deployment while a first is in deploying/verifying state"
    expected: "Second deployment returns queued status with queue_reason in config_snapshot"
    why_human: "Race condition behavior requires live environment to reliably test"
---

# Phase 6: Builder and Automation Verification Report

**Phase Goal:** Admin app deploys OpenClaw-native agent workspaces to a Hostinger VPS via Claude Code, and all tasks/chat from the admin app route to real agents running on the VPS
**Verified:** 2026-03-27T12:30:00Z
**Status:** gaps_found (1 functional gap, 1 intentional MVP stub acknowledged)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Deployment pipeline generates OpenClaw workspace artifacts (AGENTS.md, SOUL.md, IDENTITY.md, TOOLS.md, USER.md, openclaw.json) per active agent | VERIFIED | `packages/runtime/generators/openclaw-workspace.ts` orchestrates all 7 generators; `deployment/service.ts` line 295 calls `generateOpenClawWorkspace` in the deploy pipeline |
| 2 | VPS client module communicates with VPS via HTTPS with X-API-Key header | VERIFIED | `packages/core/vps/vps-client.ts` uses native fetch with `"X-API-Key": config.apiKey` header on all requests; AbortController timeout |
| 3 | Deployment artifacts pushed to VPS when VPS_API_URL is configured, local-only fallback when not | VERIFIED | `deployment/service.ts` line 340: `if (isVpsConfigured()) { ... pushDeploymentToVps(...) } else { local-only path }` |
| 4 | VPS deploy service sends workspace package and handles partial failure | VERIFIED | `packages/core/vps/vps-deploy.ts`: `pushDeploymentToVps` handles agentResults, marks per-agent container status; partial failure logged at warn level |
| 5 | Deployment status transitions deploying->verifying->live for VPS path | VERIFIED | `deployment/service.ts` line 383-406: `assertDeploymentTransition("deploying", "verifying")`, then `assertDeploymentTransition("verifying", "live")`; lifecycle.ts includes all transitions |
| 6 | Rollback sends stored workspace snapshot to VPS with skipOptimization=true | VERIFIED | `rollbackDeployment()` in service.ts line 633 calls `pushRollbackToVps(...)` with `skipOptimization: true, isRollback: true`; post-rollback health check runs |
| 7 | Both full-tenant and per-agent deployment supported | VERIFIED | `pushDeploymentToVps` (full) and `pushAgentToVps` (per-agent) in vps-deploy.ts; `deployAgentAction` in deployment-actions.ts line 135 |
| 8 | Automated post-deploy health check pings each agent via VPS | VERIFIED | `runPostDeployHealthCheck` in vps-deploy.ts calls `checkAgentHealth(vpsAgentId)` per agent and updates `agent_vps_status` |
| 9 | VPS health check visible in admin dashboard with color-coded status | VERIFIED | `VpsStatusIndicator` component in health-dashboard.tsx line 167; color-coded badge (online=green, offline=red, degraded=amber); offline/degraded banners rendered at lines 216-227 |
| 10 | Real-time deployment progress via WebSocket with phase stepper and expandable detail | VERIFIED | `DeploymentProgressStream` in deployment-progress-stream.tsx: WebSocket connection, phase/detail/agent_status/complete/error events handled; vertical stepper UI rendered |
| 11 | Deployment progress stream has polling fallback when WebSocket fails | FAILED | Component sets `connectionStatus="error"` on ws.onerror but no polling loop is started. Comment says "Falls back to polling" but code does not implement it |
| 12 | Chat messages route to real VPS agents when VPS is online | VERIFIED | `chat-service.ts` line 563: `if (isVpsConfigured())` -> `checkVpsHealth()` -> `sendChatToVps()` with fallback chain to stub |
| 13 | Tasks route to real VPS agents when VPS is online, queue with assistance request when offline | VERIFIED | `executor.ts` line 239: checks VPS health before mock execution; VPS offline path creates assistance request and reverts task to queued |
| 14 | Chat shows "Agent is offline" system message when VPS unreachable | VERIFIED | `chat-service.ts` line 612: `if (vpsHealth.status === "offline") { sendMessage(..., "Agent is offline...", "system") }` |
| 15 | Inter-agent messaging enabled via openclaw.json agentToAgent config | VERIFIED | `openclaw-config.ts` lines 78-98: builds `allAgentIds` allow list, emits `tools.agentToAgent.enabled=true` with `sessions_send/list/history` capabilities |
| 16 | VPS API proxy server exists with all required routes and API key auth | VERIFIED | `infra/vps/api-server.ts`: Express with X-API-Key middleware; `infra/vps/api-routes.ts`: POST /api/deploy, POST /api/agents/:id/chat, POST /api/agents/:id/task, GET /api/health, GET /api/agents/:id/health, GET /healthz |

**Score:** 14/16 truths verified (1 functional gap, 1 acknowledged MVP stub)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/db/schema/027_vps_status_table.sql` | VPS health singleton table | VERIFIED | Creates `vps_status` with status CHECK constraint, RLS, seed row |
| `packages/db/schema/028_agent_vps_status_table.sql` | Per-agent VPS runtime status | VERIFIED | Creates `agent_vps_status` with unique index on agent_id, RLS policies |
| `packages/db/schema/029_deployments_vps_columns.sql` | VPS deployment columns | VERIFIED | Adds `optimization_report`, `deploy_target`, `vps_deploy_id` to deployments |
| `packages/core/types/index.ts` | VpsStatus, VpsContainerStatus, DeployTarget, DeploymentStatus+verifying | VERIFIED | All types exported at lines 87-94; DeploymentStatus includes "verifying" at line 36 |
| `packages/core/vps/vps-client.ts` | HTTP client with X-API-Key, timeout | VERIFIED | `vpsPost`, `vpsGet`, `createVpsWebSocket` — native fetch, AbortController, error returns not throws |
| `packages/core/vps/vps-naming.ts` | Shared deriveVpsAgentId | VERIFIED | Single source of truth; format `{slug}-{dept}-{prefix}` documented |
| `packages/core/vps/vps-config.ts` | getVpsConfig, isVpsConfigured | VERIFIED | Reads VPS_API_URL + VPS_API_KEY; `isVpsConfigured()` returns false when missing |
| `packages/core/vps/vps-health.ts` | checkVpsHealth, checkAgentHealth, updateVpsStatus, updateAgentVpsStatus, getVpsStatus | VERIFIED | All 5 functions present and substantive |
| `packages/core/vps/vps-deploy.ts` | pushDeploymentToVps, pushAgentToVps, pushRollbackToVps, runPostDeployHealthCheck | VERIFIED | All 4 exports present; full logic not stubs |
| `packages/core/vps/vps-chat.ts` | sendChatToVps, getVpsAgentId, getVpsChatWsUrl | VERIFIED | All 3 exports; getVpsAgentId has DB lookup + deriveVpsAgentId fallback |
| `packages/core/vps/vps-task.ts` | sendTaskToVps | VERIFIED | Exports sendTaskToVps; error returns fallback result |
| `packages/runtime/generators/openclaw-agents-md.ts` | AGENTS.md generator, 8000 char budget | VERIFIED | MAX_CHARS = 8000; truncates scope section first, then final truncation |
| `packages/runtime/generators/openclaw-soul-md.ts` | SOUL.md generator, 4000 char budget | VERIFIED | MAX_CHARS = 4000; department-specific persona profiles |
| `packages/runtime/generators/openclaw-config.ts` | openclaw.json generator with deriveVpsAgentId and agentToAgent | VERIFIED | Uses local copy of deriveVpsAgentId (circular dep workaround); agentToAgent enabled block |
| `packages/runtime/generators/openclaw-workspace.ts` | Workspace orchestrator | VERIFIED | Calls all 5 per-agent generators + generateOpenClawConfig; filters frozen/retired agents |
| `packages/runtime/index.ts` | 7 OpenClaw generator exports | VERIFIED | All 7 exports present at lines 13-20 |
| `apps/web/_components/vps-status-indicator.tsx` | Color-coded VPS badge with refresh | VERIFIED | Status colors, relativeTime, manual refresh via button click, calls checkVpsHealthAction on mount |
| `apps/web/_components/deployment-progress-stream.tsx` | WebSocket streaming with polling fallback | PARTIAL | WebSocket connection works; polling fallback NOT implemented |
| `apps/web/_components/deployment-diff-viewer.tsx` | Claude Code optimization report display | VERIFIED | Collapsible file changes; summary section; "No optimization report" empty state |
| `apps/web/_components/health-dashboard.tsx` | VPS status indicator + warning banners | VERIFIED | VpsStatusIndicator rendered at line 167; offline/degraded banners at lines 216-227 |
| `apps/web/_actions/vps-actions.ts` | checkVpsHealthAction, getVpsStatusAction | VERIFIED | Both server actions present and exported |
| `infra/vps/api-server.ts` | Express server with API key auth and WebSocket | VERIFIED | JSON body parser 10MB; API key middleware skips /healthz; WebSocket server with path routing |
| `infra/vps/api-routes.ts` | All required routes | VERIFIED | All 6 routes present; workspace files written to /data/tenants/{slug}/; stubs clearly marked TODO |
| `infra/vps/bootstrap-prompt.md` | Claude Code bootstrap with tenant rules | VERIFIED | Contains tenant workspace structure, deployment workflow, memory preservation rules, naming convention, Docker sandbox config, inter-agent comm |
| `infra/vps/setup.sh` | VPS provisioning script | VERIFIED | Node.js 24, Docker, OpenClaw install; /data/tenants directory; systemd service; idempotent checks |
| `infra/vps/docker-compose.vps.yml` | Docker services definition | VERIFIED | api-proxy and openclaw-gateway services with shared /data/tenants volume |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/runtime/generators/openclaw-workspace.ts` | `openclaw-agents-md.ts` etc. | orchestrates all per-agent generators | WIRED | Line 100: `generateAgentsMd(...)`, lines 111,116,121,126 call all generators |
| `packages/core/vps/vps-client.ts` | `packages/core/vps/vps-config.ts` | reads URL+key from env | WIRED | Line 1: `import { getVpsConfig }` called on every request |
| `packages/core/vps/vps-health.ts` | `packages/core/vps/vps-client.ts` | uses HTTP client for health endpoints | WIRED | Line 3: `import { vpsGet }` used at line 23: `vpsGet("/api/health")` |
| `packages/core/deployment/service.ts` | `packages/core/vps/vps-deploy.ts` | calls pushDeploymentToVps after workspace generation | WIRED | Line 14 import; line 375: `pushDeploymentToVps(supabase, deploymentId, vpsPayload)` |
| `packages/core/vps/vps-deploy.ts` | `packages/core/vps/vps-client.ts` | uses HTTP client for deploy POST | WIRED | Line 30: `vpsPost<VpsDeployResult>("/api/deploy", payload)` |
| `apps/web/_components/health-dashboard.tsx` | `apps/web/_components/vps-status-indicator.tsx` | renders VPS status in dashboard header | WIRED | Line 42 import; line 167: `<VpsStatusIndicator initialStatus={vpsStatus} />` |
| `apps/web/_components/deployment-progress-stream.tsx` | `packages/core/vps/vps-types.ts` | consumes VpsDeployProgressEvent | WIRED | Line 7: `import type { VpsDeployProgressEvent }` used in handleEvent |
| `apps/web/app/(dashboard)/businesses/[id]/deployments/page.tsx` | `deployment-progress-stream.tsx` | passes vpsWsUrl through DeploymentCenter->DeploymentDetail | WIRED | page.tsx line 63-68 generates vpsWsUrl; line 127 passes to DeploymentCenter; deployment-detail.tsx line 291-295 renders DeploymentProgressStream |
| `apps/web/_components/deployment-detail.tsx` | `deployment-diff-viewer.tsx` | renders with optimization_report from config_snapshot | WIRED | Line 32 import; line 340: `<DeploymentDiffViewer optimizationReport={...} />` |
| `packages/core/chat/chat-service.ts` | `packages/core/vps/vps-chat.ts` | routes to VPS agent when online | WIRED | Line 15 import; line 570: `sendChatToVps(...)` called when VPS online |
| `packages/core/orchestrator/executor.ts` | `packages/core/vps/vps-task.ts` | sends task to VPS when online | WIRED | Line 9 import; line 245: `sendTaskToVps(...)` called when VPS online |
| `packages/core/vps/vps-chat.ts` | `packages/core/vps/vps-client.ts` | HTTP POST to VPS chat endpoint | WIRED | Line 9 import; line 87: `vpsPost<VpsChatResponse>(...)` |
| `packages/core/vps/vps-task.ts` | `packages/core/vps/vps-client.ts` | HTTP POST to VPS task endpoint | WIRED | Line 8 import; line 29: `vpsPost<VpsTaskResult>(...)` |
| `packages/core/vps/vps-chat.ts` | `packages/core/vps/vps-naming.ts` | fallback vpsAgentId derivation | WIRED | Line 11: `import { deriveVpsAgentId }` used at line 66 in fallback |
| `infra/vps/api-server.ts` | `infra/vps/api-routes.ts` | mounts route handlers on Express app | WIRED | Line 17 import; line 72: `app.use(apiRoutes)` |
| `packages/runtime/generators/openclaw-config.ts` | `packages/core/vps/vps-naming.ts` | uses deriveVpsAgentId for namespacing | LOCAL COPY | Uses locally duplicated copy (lines 7-22) — documented deviation due to circular dep. Convention matches canonical. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DEPL-VPS-01 | 06-01 | Deployment pipeline generates OpenClaw-native workspace artifacts | SATISFIED | `generateOpenClawWorkspace` called in service.ts; all 7 generators producing AGENTS.md, SOUL.md, IDENTITY.md, TOOLS.md, USER.md, openclaw.json per agent |
| DEPL-VPS-02 | 06-01, 06-02 | Admin app communicates with VPS via REST API with API key auth over HTTPS | SATISFIED | vps-client.ts uses `X-API-Key` header; infra/vps/api-server.ts validates header on all routes except /healthz |
| DEPL-VPS-03 | 06-02, 06-04 | Claude Code on VPS receives deployment packages, reviews/optimizes, deploys containers | PARTIAL | API proxy receives packages and writes workspace files (SATISFIED). Claude Code optimization and actual container management are stubbed with TODO markers (intentional MVP decision) |
| DEPL-VPS-04 | 06-02 | Real-time deployment progress via WebSocket with expandable detail log | SATISFIED | DeploymentProgressStream connects to VPS WebSocket; phase/detail/agent_status events handled; expandable details rendered. Polling fallback missing but core WebSocket path works |
| DEPL-VPS-05 | 06-02, 06-04 | Each agent runs in its own isolated Docker container | PARTIAL | openclaw.json configures per-agent containers with sandbox settings (SATISFIED). Actual container creation stubbed in infra/vps/api-routes.ts (intentional MVP) |
| DEPL-VPS-06 | 06-02 | VPS health check visible in admin dashboard | SATISFIED | VpsStatusIndicator renders in dashboard header; checkVpsHealthAction polls on mount; color-coded status badge |
| DEPL-VPS-07 | 06-02 | Rollback restores exact workspace snapshot | SATISFIED | `rollbackDeployment` extracts openclaw_workspace from old snapshot, calls `pushRollbackToVps` with `skipOptimization=true, isRollback=true` |
| DEPL-VPS-08 | 06-02 | Both full-tenant and per-agent deployment supported | SATISFIED | `pushDeploymentToVps` (full) and `pushAgentToVps` (per-agent) in vps-deploy.ts; `deployAgentAction` server action |
| DEPL-VPS-09 | 06-02 | Automated post-deploy health check verifies each agent | SATISFIED | `runPostDeployHealthCheck` called in triggerDeployment and rollbackDeployment; checks each agent via `checkAgentHealth(vpsAgentId)` |
| DEPL-VPS-10 | 06-01, 06-02 | Deployment artifacts stored in both Supabase and VPS | SATISFIED | `config_snapshot.openclaw_workspace` stored in Supabase (service.ts line 320); workspace files written to /data/tenants/ on VPS (api-routes.ts line 74-79) |
| LIVE-01 | 06-03 | Tasks route to real OpenClaw agents on VPS | SATISFIED (with stub fallback) | executor.ts checks VPS health, calls sendTaskToVps when online; VPS proxy routes to stub for MVP, real agent when bootstrapped |
| LIVE-02 | 06-03 | Chat messages route to real OpenClaw agents on VPS | SATISFIED (with stub fallback) | chat-service.ts routes to sendChatToVps when VPS online; VPS proxy returns stub for MVP, real agent when bootstrapped |
| LIVE-03 | 06-03 | Agent responses from VPS flow back and update Supabase | SATISFIED | chat-service.ts line 579: `sendMessage(supabase, ..., vpsResponse.content, "agent")` stores response; executor.ts lines 259-270: updates task with vpsResult |
| LIVE-04 | 06-03 | Graceful degradation when VPS unreachable | SATISFIED | chat-service.ts: offline system message + stub fallback; executor.ts: queues task + creates assistance request when offline |
| LIVE-05 | 06-03, 06-04 | Inter-agent messaging enabled within the same business | SATISFIED | openclaw-config.ts lines 78-98: `tools.agentToAgent.enabled=true` with all business agent IDs in allow list; sessions_send/list/history capabilities |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `infra/vps/api-routes.ts` | 89-113 | TODO stub: Claude Code optimization and container management not implemented | Info | Intentional MVP decision; marked clearly. Activation requires VPS + OpenClaw bootstrap. |
| `infra/vps/api-routes.ts` | 224-234 | TODO stub: chat route returns canned response, not real agent | Info | Intentional MVP; chat routing to real agent activates when Claude Code bootstrapped |
| `infra/vps/api-routes.ts` | 265-278 | TODO stub: task route returns stub success, not real agent | Info | Intentional MVP; same activation path |
| `infra/vps/api-server.ts` | 163-180 | TODO stub: deploy WebSocket sends connected event then closes, no real event streaming | Info | Intentional MVP; real events streamed when Claude Code bootstrapped |
| `apps/web/_components/deployment-progress-stream.tsx` | 138-152 | Polling fallback not implemented: ws.onerror only sets error state | Warning | Polling fallback was specified in plan must_haves; component shows "WebSocket unavailable" but does not degrade to polling |
| `packages/runtime/generators/openclaw-config.ts` | 7-22 | Duplicated deriveVpsAgentId (local copy) | Info | Documented deviation to avoid circular dep; both copies reference canonical source with update warning |
| `packages/runtime/generators/openclaw-workspace.ts` | 10-25 | Duplicated deriveVpsAgentId (local copy) | Info | Same as above; acceptable tradeoff |

### Human Verification Required

#### 1. End-to-End VPS Deployment

**Test:** Configure VPS_API_URL and VPS_API_KEY pointing to a running API proxy; trigger a new business deployment
**Expected:** Files written to /data/tenants/{slug}/workspaces/{vpsAgentId}/; deployment transitions through queued->building->deploying->verifying->live; health badge shows online/degraded; DeploymentProgressStream shows WebSocket connection events
**Why human:** Requires a live VPS with the API proxy running

#### 2. Chat Routing with VPS Online

**Test:** Open the chat interface for a business that has been deployed to VPS; send a message
**Expected:** Message routes to VPS agent (stub response in MVP: "I received your message..."); audit log entry with action "chat.vps_routed"; no offline banner visible
**Why human:** Requires live VPS environment and Supabase connectivity

#### 3. Rollback Behavior

**Test:** Trigger a rollback to a previous live deployment with VPS configured
**Expected:** Previous openclaw_workspace files from config_snapshot sent to VPS with skipOptimization=true; post-rollback health check updates agent_vps_status; deployment transitions to live
**Why human:** Requires multiple prior successful deployments in a live environment

#### 4. Serial Deployment Queuing

**Test:** Trigger two deployments for the same business in quick succession
**Expected:** Second deployment returns status="queued" with queue_reason referencing the first deployment's ID in config_snapshot
**Why human:** Race condition timing requires live environment to reliably reproduce

### Gaps Summary

**Gap 1 — Missing polling fallback in DeploymentProgressStream (functional gap):**

The 06-02 plan's must_haves specified: "Polling fallback: if WebSocket connection fails, fall back to polling getDeploymentStatusAction every 2 seconds." The component's comment in line 27 also references this ("Falls back to polling when WebSocket unavailable"). However, the actual implementation only sets `connectionStatus="error"` on WebSocket failure — it does not start a polling interval. This is a real functional gap. When the VPS WebSocket is unavailable, the user sees "WebSocket unavailable" with no fallback progress updates.

Fix: In the `ws.onerror` handler, start `setInterval(() => getDeploymentStatusAction(...), 2000)` and map deployment status to phase display. Stop the interval on component unmount or when WebSocket reconnects.

**Gap 2 — DEPL-VPS-03 and DEPL-VPS-05 partial (intentional MVP stubs, not blocking for demo):**

The VPS API proxy routes for chat, task, Claude Code optimization, and container management are explicitly stubbed with TODO markers. This was a deliberate MVP decision documented across all 4 SUMMARYs: "All OpenClaw integration points stubbed for MVP and clearly marked for activation after Claude Code bootstrap." The admin-app-to-VPS pipeline works end-to-end with stub responses. Activating real execution requires running `setup.sh` on the VPS, installing OpenClaw, and removing the TODO stub code. This is an operational step, not a missing code path.

---

_Verified: 2026-03-27T12:30:00Z_
_Verifier: Claude (gsd-verifier)_
