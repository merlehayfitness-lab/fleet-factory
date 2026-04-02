---
phase: 06-builder-and-automation
plan: 04
subsystem: infra, vps, deployment
tags: [vps, express, api-proxy, docker, openclaw, bootstrap, websocket, systemd, deployment-pipeline]

# Dependency graph
requires:
  - phase: 06-builder-and-automation
    provides: VPS client module, VPS health checks, VPS deploy service, VPS chat/task routing, OpenClaw config generators, VPS naming convention
provides:
  - VPS API proxy server (Express) with deploy, chat, task, and health routes
  - API key authentication middleware for all VPS endpoints
  - WebSocket streaming for deployment progress and chat
  - Claude Code bootstrap prompt with tenant workspace rules, memory preservation, naming conventions
  - VPS setup script for automated provisioning (Node.js, Docker, OpenClaw, systemd)
  - Docker Compose reference scaffold for api-proxy and openclaw-gateway services
  - Deploy route writes workspace files to /data/tenants/{businessSlug}/ directory structure
affects: [production-deployment, vps-operations]

# Tech tracking
tech-stack:
  added: [express, ws, dotenv, tsx]
  patterns: [VPS API proxy with stub-first routes, API key auth middleware with healthz bypass, WebSocket upgrade with path routing, idempotent VPS setup script]

key-files:
  created:
    - infra/vps/api-server.ts
    - infra/vps/api-routes.ts
    - infra/vps/api-types.ts
    - infra/vps/bootstrap-prompt.md
    - infra/vps/setup.sh
    - infra/vps/docker-compose.vps.yml
    - infra/vps/package.json
    - infra/vps/tsconfig.json
    - infra/vps/.env.example
  modified: []

key-decisions:
  - "VPS proxy is a standalone npm project (not part of monorepo) with its own package.json and node_modules for deployment independence"
  - "All OpenClaw integration points stubbed with TODO markers for MVP activation when Claude Code is bootstrapped"
  - "API types duplicated locally in api-types.ts to avoid monorepo dependency on VPS -- must stay in sync with packages/core/vps/vps-types.ts"
  - "Bootstrap prompt enforces memory preservation (NEVER overwrite memory/ or MEMORY.md) and character budgets per workspace file"

patterns-established:
  - "VPS stub pattern: all agent interaction routes return plausible responses with [stub] markers, enabling end-to-end testing without OpenClaw"
  - "API key auth bypass: /healthz liveness probe skips auth for load balancer probes"
  - "WebSocket path routing: server.on('upgrade') with URL parsing dispatches to deploy or chat handlers"
  - "Idempotent setup: setup.sh checks for existing installations before installing, never overwrites .env"

requirements-completed: [DEPL-VPS-03, DEPL-VPS-05, LIVE-05]

# Metrics
duration: 7min
completed: 2026-03-27
---

# Phase 6 Plan 04: VPS API Proxy Server and Infrastructure Summary

**Express API proxy server with deploy/chat/task/health routes, Claude Code bootstrap prompt, VPS setup script, and Docker Compose for Hostinger VPS deployment**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-27T11:34:23Z
- **Completed:** 2026-03-27T11:41:06Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- VPS API proxy server (Express) receives deployment packages, chat messages, task requests, and health checks from the admin app with X-API-Key authentication
- Deploy route writes workspace files to tenant-scoped directories at /data/tenants/{businessSlug}/workspaces/{vpsAgentId}/ matching the naming convention from packages/core/vps/vps-naming.ts
- WebSocket server handles deployment progress streaming (/ws/deploy/:id) and chat streaming (/ws/chat/:conversationId) with token-by-token delivery
- Claude Code bootstrap prompt documents the complete tenant workspace structure, deployment workflow, memory preservation rules, agent naming convention, sandbox config, and inter-agent communication
- VPS setup script automates full provisioning: Node.js 24, Docker, OpenClaw, tenant directories, systemd service, with idempotent safety checks
- Docker Compose reference scaffold defines api-proxy and openclaw-gateway services with shared tenant volume, health checks, and bridge networking

## Task Commits

Each task was committed atomically:

1. **Task 1: VPS API proxy server with deploy, chat, task, and health routes** - `901e0f0` (feat)
2. **Task 2: Bootstrap prompt, setup script, Docker Compose, and inter-agent config** - `f064c46` (feat)

## Files Created/Modified
- `infra/vps/package.json` - Standalone npm project with express, ws, dotenv dependencies
- `infra/vps/tsconfig.json` - TypeScript config targeting ES2022 with ESNext modules
- `infra/vps/.env.example` - Environment variable documentation (API_KEY, PORT, OPENCLAW_WS_URL, TENANT_DATA_DIR)
- `infra/vps/api-types.ts` - Local type definitions mirroring packages/core/vps/vps-types.ts (DeployPayload, ChatRequest, TaskRequest, HealthStatus, etc.)
- `infra/vps/api-server.ts` - Express entry point with JSON body parser (10MB), CORS, API key auth middleware (bypasses /healthz), WebSocket server with path-based routing
- `infra/vps/api-routes.ts` - Route handlers: POST /api/deploy (writes workspace files, stub optimization/container management), POST /api/agents/:vpsAgentId/chat, POST /api/agents/:vpsAgentId/task, GET /api/health (checks OpenClaw gateway), GET /api/agents/:vpsAgentId/health (checks workspace exists), GET /healthz (liveness probe)
- `infra/vps/bootstrap-prompt.md` - Claude Code bootstrap with system architecture, tenant workspace structure, deployment workflow, critical rules (memory preservation, character budgets), naming convention, Docker sandbox config, inter-agent communication, rollback handling, error recovery
- `infra/vps/setup.sh` - VPS provisioning: apt update, Node.js 24, Docker, OpenClaw, directory structure, file copy, npm install, .env setup, sandbox image pull, systemd service configuration
- `infra/vps/docker-compose.vps.yml` - Reference scaffold with api-proxy (port 3100) and openclaw-gateway (ports 18789/18790) services, shared /data/tenants volume, health checks, bridge network

## Decisions Made
- VPS proxy is a standalone npm project with its own dependencies, separate from the monorepo. This enables independent deployment to the VPS without needing the full monorepo context.
- API types are duplicated locally in api-types.ts rather than importing from packages/core. This avoids a monorepo dependency but creates a sync obligation -- both files must be kept aligned.
- All OpenClaw gateway integration points (optimization, container management, chat routing, task execution) are stubbed with clear TODO markers. The stubs return plausible responses that enable end-to-end testing of the admin-app-to-VPS pipeline without requiring OpenClaw to be installed.
- Bootstrap prompt explicitly enforces memory preservation rules and character budgets per workspace file to prevent Claude Code from accidentally destroying agent memory on redeployment.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None for development. For VPS deployment:
1. Run `setup.sh` on the target VPS
2. Edit `/opt/fleet-factory/vps-proxy/.env` with API_KEY and OPENCLAW_AUTH_TOKEN
3. Configure OpenClaw gateway settings
4. Start the systemd service

## Next Phase Readiness
- Complete VPS infrastructure from admin app client through API proxy to OpenClaw gateway
- All 6 phases of the builder-and-automation milestone are complete
- End-to-end deployment pipeline: admin app generates workspace files -> VPS client sends to proxy -> proxy writes files to disk -> stub returns success
- Ready for production activation: install OpenClaw on VPS, remove TODO stubs, enable real agent container management

## Self-Check: PASSED

All 10 files verified present. All 2 task commits verified in git log.

---
*Phase: 06-builder-and-automation*
*Completed: 2026-03-27*
