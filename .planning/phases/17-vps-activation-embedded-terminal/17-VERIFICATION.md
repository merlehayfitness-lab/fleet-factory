---
phase: 17-vps-activation-embedded-terminal
verified: 2026-03-30T20:00:00Z
status: human_needed
score: 12/12 must-haves verified
re_verification: false
human_verification:
  - test: "Deploy a real agent to Hostinger VPS"
    expected: "Deployment pipeline runs Steps 1-4 in full: writes files to /data/tenants/, calls OpenClaw optimization, creates Docker containers via dockerode with 512MB/0.5CPU limits. Docker ps shows containers running."
    why_human: "Requires a live Hostinger VPS with OpenClaw running, Docker available, and the proxy deployed. Cannot verify container creation or optimization without a real VPS environment."
  - test: "Verify gear/Terminal icon navigates to terminal page"
    expected: "Terminal icon is visible next to VPS status badge on the business overview page (only when VPS is configured). Clicking it loads /businesses/{id}/terminal."
    why_human: "Requires browser rendering. The gear/terminal icon has conditional rendering (vpsStatus && ...) which requires a configured VPS to be visible."
  - test: "Open embedded SSH terminal and interact with shell"
    expected: "Terminal page loads with dark theme (bg #1a1a2e), xterm.js renders without SSR crash, WebSocket connects to VPS proxy ws/terminal/:slug, SSH shell responds to commands, resize works, reconnection fires on disconnect."
    why_human: "Requires live VPS with SSH daemon running and SSH credentials set. WebSocket, xterm.js rendering, and real SSH shell interaction cannot be verified without a browser and live VPS."
  - test: "Access deployed agent containers from terminal"
    expected: "Running 'docker ps' in the terminal shows agent containers. 'ls /data/tenants/{slug}/workspaces/' shows agent workspace directories."
    why_human: "Requires deployed containers and real VPS access — depends on VPS-TERM-01 being satisfied first."
  - test: "End-to-end: deploy, chat, task, approval, terminal loop"
    expected: "Following SETUP-CHECKLIST.md steps 1-8 then the 7-step E2E scenario produces: deployed agents, real Claude responses to chat, real task execution, correct approval flow, and terminal shell access."
    why_human: "Full E2E verification requires live VPS, OpenClaw gateway, deployed agents, and real user interactions in the browser across multiple pages."
---

# Phase 17: VPS Activation & Embedded Terminal — Verification Report

**Phase Goal:** Deploy the first real department/agent to the Hostinger VPS and provide an embedded SSH terminal accessible from the business overview page for direct VPS access
**Verified:** 2026-03-30T20:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Docker container lifecycle managed by dockerode (create, start, stop, tenant-wide ops) | VERIFIED | `infra/vps/container-manager.ts` — full implementation with createAgentContainer, startAgentContainer, stopAgentContainer, listTenantContainers, stopTenantContainers, resumeTenantContainers, countRunningAgents. 512MB/0.5CPU limits confirmed (lines 16-17). |
| 2 | openclaw-client.ts wraps OpenClaw gateway with Bearer auth | VERIFIED | `infra/vps/openclaw-client.ts` — sendMessageToAgent, submitTaskToAgent, checkGatewayHealth, streamChatFromAgent all implemented. Bearer auth at lines 29, 46, 74. HTTP fallback in streamChatFromAgent at line 193. |
| 3 | deploy-state.ts persists deployment state to JSON in /data/state/ | VERIFIED | `infra/vps/deploy-state.ts` — saveDeploymentState (line 21), loadDeploymentState (line 33), loadAllDeploymentStates (line 48), deleteDeploymentState (line 79). STATE_DIR env var at line 12. |
| 4 | Async deploy pipeline with real optimization, container creation, and EventEmitter progress | VERIFIED | `infra/vps/api-routes.ts` — POST /api/deploy returns immediately with deployId (line 111), runDeployPipeline() runs async (line 114). Steps 1-4 implemented: write files (line 163), optimize via sendMessageToAgent (line 187), containers via createAgentContainer (line 258). deployEvents exported at line 49. |
| 5 | Chat and task routes reach OpenClaw gateway (not stubs) | VERIFIED | `/api/agents/:vpsAgentId/chat` calls sendMessageToAgent at line 406. `/api/agents/:vpsAgentId/task` calls submitTaskToAgent at line 444. No "stub mode" comment found. |
| 6 | Health endpoints use real Docker/gateway data | VERIFIED | GET /api/health calls checkGatewayHealth() (line 476) and countRunningAgents() (line 479). GET /api/agents/:vpsAgentId/health calls docker.getContainer().inspect() (lines 519-525). No mode:"stub" in metadata. |
| 7 | Tenant stop/resume endpoints use dockerode | VERIFIED | POST /api/tenants/stop (line 572) calls stopTenantContainers(). POST /api/tenants/resume (line 594) calls resumeTenantContainers(). |
| 8 | WebSocket handlers stream real data (deploy progress + chat tokens) | VERIFIED | `api-server.ts` — handleDeployWebSocket subscribes to deployEvents.on(deployId, handler) (line 221). handleChatWebSocket calls streamChatFromAgent() (line 273). |
| 9 | terminal-bridge.ts uses ssh2 to bridge WebSocket to SSH shell | VERIFIED | `infra/vps/terminal-bridge.ts` — Client from ssh2 (line 10), shell with term:"xterm-256color" (line 29), binary data forwarding (line 38), JSON resize handling (lines 47-55), /data/tenants/{slug} scoping (line 72), env-var SSH credentials (lines 96-106). |
| 10 | EmbeddedTerminal dynamically imports xterm.js, uses dark theme, supports reconnect | VERIFIED | `apps/web/_components/embedded-terminal.tsx` — dynamic import of @xterm/xterm inside useEffect (line 29), dark theme background:#1a1a2e/foreground:#e0e0e0/cursor:#00ff41 (lines 37-41), ws.binaryType="arraybuffer" (line 67), exponential backoff 1s/2s/4s/8s (lines 91-101). |
| 11 | Gear/Terminal icon on health dashboard links to /businesses/{id}/terminal | VERIFIED | `apps/web/_components/health-dashboard.tsx` lines 120-128 — Terminal icon from lucide-react (line 17), Link href to /businesses/${business.id}/terminal (line 123), conditional on {vpsStatus && ...} (line 120). |
| 12 | VPS status indicator auto-polls every 30 seconds | VERIFIED | `apps/web/_components/vps-status-indicator.tsx` lines 88-95 — setInterval(() => refreshHealth(), 30_000) with clearInterval cleanup. |

**Score:** 12/12 truths verified (all automated checks pass)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `infra/vps/container-manager.ts` | Docker container lifecycle via dockerode | VERIFIED | 214 lines. Exports all 7 required functions. Uses SANDBOX_IMAGE, 512MB/0.5CPU limits, LABEL_KEY. |
| `infra/vps/openclaw-client.ts` | OpenClaw gateway HTTP/WS client | VERIFIED | 230 lines. Exports sendMessageToAgent, submitTaskToAgent, checkGatewayHealth, streamChatFromAgent. Bearer auth, HTTP fallback. |
| `infra/vps/deploy-state.ts` | JSON file persistence for deployment state | VERIFIED | 87 lines. Exports save/load/loadAll/delete functions. /data/state/ directory creation on init. |
| `infra/vps/api-routes.ts` | All stubs replaced, tenant lifecycle endpoints added | VERIFIED | 621 lines. Zero "TODO: Activate when Claude Code" stubs. Zero "stub mode" references. POST /api/tenants/stop and /api/tenants/resume present. deployEvents exported. |
| `infra/vps/api-server.ts` | Real WebSocket handlers, terminal route | VERIFIED | 378 lines. parseWsPath handles terminal (lines 107-110). handleDeployWebSocket uses deployEvents (line 221). handleChatWebSocket uses streamChatFromAgent (line 273). handleTerminalWebSocket calls bridgeTerminal() (line 349). |
| `infra/vps/terminal-bridge.ts` | ssh2 WebSocket-to-SSH bridge | VERIFIED | 107 lines. Exports bridgeTerminal. ssh2 Client, xterm-256color, JSON resize, /data/tenants scoping, SSH env vars. |
| `apps/web/app/(dashboard)/businesses/[id]/terminal/page.tsx` | Server Component terminal page with auth/VPS check | VERIFIED | 82 lines. Auth check redirects to /sign-in, VPS check redirects to /businesses/{id}, wsUrl constructed with apiKey, best-effort health fetch. |
| `apps/web/_components/embedded-terminal.tsx` | xterm.js terminal with WebSocket and reconnect | VERIFIED | 141 lines. Dynamic imports, dark theme, binary arraybuffer, exponential backoff reconnect, ResizeObserver, @ts-expect-error for xterm.css. |
| `apps/web/_components/terminal-info-bar.tsx` | Info bar with VPS status, tenant, container count, disconnect | VERIFIED | 63 lines. Shows businessName, businessSlug, VPS status dot, agentCount, Disconnect button with useRouter().push(). |
| `apps/web/_components/health-dashboard.tsx` | Gear/Terminal icon next to VPS status badge | VERIFIED | Terminal icon (lucide-react) imported at line 17. Link to /businesses/${business.id}/terminal at lines 120-128. Conditional on vpsStatus. |
| `apps/web/_components/vps-status-indicator.tsx` | 30s auto-poll for VPS health | VERIFIED | setInterval(refreshHealth, 30_000) with clearInterval cleanup added at lines 88-95. |
| `infra/vps/SETUP-CHECKLIST.md` | Step-by-step VPS activation and E2E guide | VERIFIED | 8 setup steps + 7-step E2E scenario + troubleshooting section. References setup.sh, /data/tenants, /data/state, ports 3100/18789. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `infra/vps/api-routes.ts` | `infra/vps/container-manager.ts` | import createAgentContainer, countRunningAgents, stopTenantContainers, resumeTenantContainers, docker | WIRED | Lines 31-36: `import { createAgentContainer, countRunningAgents, stopTenantContainers, resumeTenantContainers, docker } from "./container-manager.js"` — all used in routes. |
| `infra/vps/api-routes.ts` | `infra/vps/openclaw-client.ts` | import sendMessageToAgent, submitTaskToAgent, checkGatewayHealth | WIRED | Lines 37-41: `import { sendMessageToAgent, submitTaskToAgent, checkGatewayHealth } from "./openclaw-client.js"` — all used in route handlers. |
| `infra/vps/api-routes.ts` | `infra/vps/deploy-state.ts` | import saveDeploymentState, loadAllDeploymentStates | WIRED | Lines 27-29: `import { saveDeploymentState, loadAllDeploymentStates } from "./deploy-state.js"` — used for persistence throughout. |
| `infra/vps/api-server.ts` | `infra/vps/openclaw-client.ts` | import streamChatFromAgent | WIRED | Line 18: `import { streamChatFromAgent } from "./openclaw-client.js"` — used in handleChatWebSocket at line 273. |
| `infra/vps/api-server.ts` | `infra/vps/terminal-bridge.ts` | import bridgeTerminal | WIRED | Line 20: `import { bridgeTerminal } from "./terminal-bridge.js"` — called in handleTerminalWebSocket at line 349. |
| `infra/vps/api-server.ts` | `infra/vps/api-routes.ts` | import deployEvents | WIRED | Line 17: `import apiRoutes, { deployEvents } from "./api-routes.js"` — used in handleDeployWebSocket at line 221. |
| `infra/vps/api-server.ts` | `infra/vps/deploy-state.ts` | import loadDeploymentState | WIRED | Line 19: `import { loadDeploymentState } from "./deploy-state.js"` — used in handleDeployWebSocket at line 198 to check already-completed deployments. |
| `apps/web/app/(dashboard)/businesses/[id]/terminal/page.tsx` | `apps/web/_components/embedded-terminal.tsx` | import EmbeddedTerminal, pass wsUrl | WIRED | Line 3: `import { EmbeddedTerminal } from "@/_components/embedded-terminal"` — rendered at line 78 with wsUrl prop. |
| `apps/web/app/(dashboard)/businesses/[id]/terminal/page.tsx` | `apps/web/_components/terminal-info-bar.tsx` | import TerminalInfoBar, pass business info | WIRED | Line 4: `import { TerminalInfoBar } from "@/_components/terminal-info-bar"` — rendered at line 70 with businessId, businessName, businessSlug, vpsStatus, agentCount. |
| `apps/web/_components/health-dashboard.tsx` | `/businesses/[id]/terminal` | Terminal icon Link href | WIRED | Line 123: `href={\`/businesses/${business.id}/terminal\`}` — conditional on `{vpsStatus && (`. |
| `apps/web/_components/vps-status-indicator.tsx` | `apps/web/_actions/vps-actions.ts` | setInterval calling checkVpsHealthAction every 30s | WIRED | Line 90: `const interval = setInterval(() => { refreshHealth(); }, 30_000)` — refreshHealth calls checkVpsHealthAction (line 68). |
| `infra/vps/SETUP-CHECKLIST.md` | `infra/vps/setup.sh` | References setup.sh as primary install script | WIRED | Line 24-25 of checklist references `chmod +x setup.sh && ./setup.sh`. |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| VPS-TERM-01 | 17-01, 17-02, 17-03 | First real department/agent deployed and running on Hostinger VPS | NEEDS HUMAN | Deploy pipeline is fully implemented: async runDeployPipeline() with real dockerode container creation and OpenClaw optimization. No stubs remain. But "deployed and running on Hostinger VPS" requires a live VPS — cannot verify programmatically. |
| VPS-TERM-02 | 17-02, 17-03 | Gear icon next to VPS status badge links to standalone terminal page | VERIFIED (code) / NEEDS HUMAN (render) | Terminal icon in health-dashboard.tsx (line 121), conditional on vpsStatus, links to /businesses/${business.id}/terminal. Needs browser rendering with a configured VPS to confirm icon visibility. |
| VPS-TERM-03 | 17-02 | Embedded real-time SSH terminal for direct VPS access from admin panel | VERIFIED (code) / NEEDS HUMAN (live) | terminal-bridge.ts bridges WebSocket to SSH. EmbeddedTerminal.tsx has full xterm.js integration, dark theme, binary data, resize, reconnect. Needs live VPS with SSH to verify real connection. |
| VPS-TERM-04 | 17-02 | Admin can access deployed agents and Docker containers from embedded terminal | NEEDS HUMAN | Shell is scoped to /data/tenants/{slug}/ (terminal-bridge.ts line 72). Container inspection works via docker CLI in the shell. Requires deployed containers and live terminal session to verify `docker ps` output. |
| VPS-TERM-05 | 17-01, 17-02, 17-03 | End-to-end VPS deployment pipeline verified with real agents | NEEDS HUMAN | SETUP-CHECKLIST.md provides the 7-step E2E verification scenario. All code paths are implemented. Requires live VPS activation following the checklist to confirm real agents respond to chat and tasks. |

All 5 requirement IDs from plan frontmatter are accounted for. No orphaned requirements.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/app/(dashboard)/businesses/[id]/terminal/page.tsx` | 62 | `onDisconnect={() => {}}` — empty callback in JSX comment | Info | No impact. The plan's own note explains this was superseded: TerminalInfoBar uses businessId + useRouter instead. The empty prop is not used. Actual file at line 71-76 passes businessId and relies on internal useRouter — no empty callback is actually rendered. |
| `infra/vps/container-manager.ts` | 57 | `Cmd: ["sleep", "infinity"]` comment: "Agent process managed by OpenClaw" | Info | Not a stub — this is correct architecture. OpenClaw manages the agent process; the container just keeps running. Intentional design per CONTEXT.md and RESEARCH.md. |

No blockers or warnings. All anti-pattern candidates are either intentional architecture or commented-out superseded items.

---

### Human Verification Required

#### 1. First Real Agent Deployed and Running (VPS-TERM-01)

**Test:** Follow SETUP-CHECKLIST.md Steps 1-8 on the Hostinger VPS. Then on the admin panel, create a business and trigger a deployment from /businesses/{id}/deployments.
**Expected:** Deployment pipeline streams phases: writing_files → optimizing → starting_containers → complete. `docker ps` on the VPS shows running containers named by vpsAgentId. `/data/tenants/{slug}/workspaces/` directories are populated.
**Why human:** Requires a provisioned Hostinger VPS with Docker, OpenClaw gateway running on port 18789, and VPS_API_URL/VPS_API_KEY env vars configured. The deploy pipeline runs on the VPS, not locally.

#### 2. Gear/Terminal Icon Visible and Navigates Correctly (VPS-TERM-02)

**Test:** On the business overview page with a configured VPS (VPS_API_URL set), verify the Terminal icon appears next to the VPS status badge in the dashboard header. Click it.
**Expected:** Terminal icon is visible only when vpsStatus is non-null. Clicking navigates to /businesses/{id}/terminal.
**Why human:** The icon has a conditional `{vpsStatus && (...)}` guard — only visible when the VPS is configured and a status has been returned. Without a live VPS or mock VPS status, the icon won't render.

#### 3. Embedded Terminal Opens and SSH Shell Responds (VPS-TERM-03)

**Test:** After setup, navigate to /businesses/{id}/terminal. Wait for the "Connecting to VPS..." overlay to clear.
**Expected:** xterm.js renders in dark theme (background #1a1a2e). Shell prompt appears. Type `ls` — shows /data/tenants/{slug}/ contents. Type `whoami` — returns SSH_USER.
**Why human:** Requires WebSocket connection from browser to VPS proxy to SSH daemon. xterm.js must render in the browser DOM. Not verifiable without a real browser + live VPS + SSH credentials in .env.

#### 4. Docker Containers Accessible from Terminal (VPS-TERM-04)

**Test:** In the embedded terminal, run `docker ps`. Run `ls /data/tenants/{slug}/workspaces/`.
**Expected:** `docker ps` lists running agent containers. Workspace directories contain agent config files.
**Why human:** Depends on VPS-TERM-01 having succeeded (containers deployed). The terminal bridge is wired but container visibility requires deployed containers.

#### 5. End-to-End Deployment and Agent Response Loop (VPS-TERM-05)

**Test:** Follow SETUP-CHECKLIST.md End-to-End Verification Scenario, Steps 1-7. Particularly: create a business, deploy, chat with an agent, create a task, verify approval flow.
**Expected:** Agent responds to chat with a real Claude completion (not stub text). Task routes to VPS agent and returns a result. Approval request appears in /businesses/{id}/approvals. Health polling updates after stopping/starting containers.
**Why human:** Full loop verification requires live Anthropic API key, OpenClaw gateway routing, deployed containers, and multi-page browser interactions.

---

## Dependency Notes

VPS-TERM-01 is a prerequisite for VPS-TERM-04 and VPS-TERM-05. VPS-TERM-02 and VPS-TERM-03 can be verified independently once the VPS proxy is running (even without deployed agents). VPS-TERM-05 requires all prior requirements to be satisfied.

The SETUP-CHECKLIST.md at `infra/vps/SETUP-CHECKLIST.md` is the authoritative guide for performing human verification. All 5 requirements map to specific steps in the 7-step E2E scenario.

---

## Summary

All 12 automated must-haves are verified — every artifact exists, is substantive (not a stub), and is wired to its dependencies. The phase completed 6 commits across 3 plans, touching 15+ files.

The implementation is complete. What cannot be verified programmatically is whether the system works against a live Hostinger VPS: real Docker containers need to start, real SSH connections need to succeed, and real Claude responses need to flow through OpenClaw. All 5 requirements (VPS-TERM-01 through VPS-TERM-05) require a provisioned VPS to fully satisfy. The SETUP-CHECKLIST.md provides the structured path to that verification.

---

_Verified: 2026-03-30T20:00:00Z_
_Verifier: Claude (gsd-verifier)_
