---
phase: 17-vps-activation-embedded-terminal
plan: 01
subsystem: infra
tags: [dockerode, openclaw, express, websocket, docker, container-management]

# Dependency graph
requires:
  - phase: 06-vps-proxy-deployment
    provides: "VPS proxy server scaffolding with stubbed endpoints"
provides:
  - "Docker container lifecycle management via dockerode (create, start, stop, tenant-wide ops)"
  - "OpenClaw gateway HTTP/WS client for agent chat and task routing"
  - "JSON file persistence for deployment state surviving proxy restarts"
  - "Async deploy pipeline with real Claude Code optimization and container creation"
  - "Real WebSocket streaming for deploy progress and chat tokens"
  - "Tenant stop/resume endpoints for container lifecycle management"
affects: [17-02-terminal-bridge, 17-03-end-to-end-verification]

# Tech tracking
tech-stack:
  added: [dockerode, ssh2, "@types/ssh2"]
  patterns: [EventEmitter-based deploy progress streaming, file-based state persistence, HTTP-to-WS fallback for chat streaming]

key-files:
  created:
    - infra/vps/container-manager.ts
    - infra/vps/openclaw-client.ts
    - infra/vps/deploy-state.ts
  modified:
    - infra/vps/api-routes.ts
    - infra/vps/api-server.ts
    - infra/vps/api-types.ts
    - infra/vps/package.json
    - infra/vps/.env.example
    - infra/vps/setup.sh

key-decisions:
  - "Async deploy pipeline returns deployId immediately, runs steps 1-4 in background with EventEmitter progress"
  - "Deploy failure on optimization error (per CONTEXT.md) -- if Claude Code optimization fails, deployment fails"
  - "WebSocket chat streaming falls back to HTTP POST when gateway WS unavailable"
  - "Agent containers use 512MB memory and 0.5 CPU limits with unless-stopped restart policy"
  - "Terminal WebSocket path registered but bridge deferred to Plan 02"

patterns-established:
  - "EventEmitter deploy progress: deployEvents.emit(deployId, event) for WebSocket streaming"
  - "File-based deploy state: JSON files in /data/state/ for persistence across proxy restarts"
  - "Container labels: agency-factory=true + tenant={slug} for dockerode filtering"

requirements-completed: [VPS-TERM-01, VPS-TERM-02, VPS-TERM-03, VPS-TERM-04, VPS-TERM-05]

# Metrics
duration: 4min
completed: 2026-03-30
---

# Phase 17 Plan 01: VPS API Proxy Activation Summary

**Dockerode container management, OpenClaw gateway routing, and file-based deploy state replacing all 6 VPS proxy stubs**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-30T19:18:41Z
- **Completed:** 2026-03-30T19:22:41Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Created 3 new infrastructure modules: container-manager.ts (dockerode), openclaw-client.ts (OpenClaw HTTP/WS), deploy-state.ts (JSON file persistence)
- Replaced all 6 stubbed areas in api-routes.ts with real implementations: deploy pipeline, chat, task, health, agent health, tenant lifecycle
- Rewrote WebSocket handlers in api-server.ts for real deploy progress streaming and chat token streaming
- Added tenant stop/resume endpoints for container lifecycle management

## Task Commits

Each task was committed atomically:

1. **Task 1: New modules -- container-manager, openclaw-client, deploy-state, and dependency updates** - `162d082` (feat)
2. **Task 2: Replace all stubs in api-routes.ts and api-server.ts with real implementations** - `5cf9bd4` (feat)

## Files Created/Modified
- `infra/vps/container-manager.ts` - Docker container lifecycle management via dockerode (create, start, stop, list, tenant ops)
- `infra/vps/openclaw-client.ts` - OpenClaw gateway HTTP/WS client (sendMessage, submitTask, checkHealth, streamChat)
- `infra/vps/deploy-state.ts` - JSON file persistence for deployment state in /data/state/
- `infra/vps/api-routes.ts` - All 6 stubs replaced: async deploy with optimization, real chat/task routing, real health, tenant lifecycle
- `infra/vps/api-server.ts` - Real WebSocket handlers for deploy progress (EventEmitter) and chat tokens (streamChatFromAgent)
- `infra/vps/api-types.ts` - Added TerminalMessage, TenantLifecycleRequest, TenantLifecycleResponse types
- `infra/vps/package.json` - Added dockerode, ssh2, @types/ssh2 dependencies
- `infra/vps/.env.example` - Added OPENCLAW_HTTP_URL, STATE_DIR, SSH_USER, SSH_PASSWORD, ADMIN_APP_ORIGIN
- `infra/vps/setup.sh` - Added copy commands for 3 new modules and /data/state directory creation

## Decisions Made
- Deploy endpoint returns immediately with deployId; pipeline runs async emitting progress events via EventEmitter
- Optimization failure causes deployment failure (per CONTEXT.md requirement)
- Chat WebSocket uses streamChatFromAgent with automatic HTTP fallback when WS connection fails
- Container resources: 512MB memory, 0.5 CPU, unless-stopped restart policy, bridge network mode
- Terminal WebSocket path (/ws/terminal/:businessSlug) registered but sends placeholder -- bridge wired in Plan 02

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- VPS proxy fully activated with real Docker container management and OpenClaw gateway routing
- Terminal WebSocket path registered, ready for SSH bridge implementation in Plan 02
- All infrastructure ready for end-to-end verification in Plan 03

---
*Phase: 17-vps-activation-embedded-terminal*
*Completed: 2026-03-30*
