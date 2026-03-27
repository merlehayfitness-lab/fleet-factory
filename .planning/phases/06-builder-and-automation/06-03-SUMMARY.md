---
phase: 06-builder-and-automation
plan: 03
subsystem: chat, tasks, vps, ui
tags: [vps, chat-routing, task-routing, websocket, streaming, graceful-degradation, inter-agent, openclaw]

# Dependency graph
requires:
  - phase: 06-builder-and-automation
    provides: VPS client module, VPS health checks, VPS naming convention, OpenClaw config generators, VPS deploy service
  - phase: 05-observability-and-command-center
    provides: Chat service with stub responses, chat UI with typing indicator, department channels
  - phase: 04-task-execution-and-approvals
    provides: Orchestrator executor with mock tool execution, task service, worker tool runner
provides:
  - VPS chat routing service (sendChatToVps, getVpsAgentId, getVpsChatWsUrl)
  - VPS task routing service (sendTaskToVps)
  - VPS-aware chat service with real agent routing and graceful offline fallback
  - VPS-aware task executor with real agent execution and offline queuing
  - WebSocket chat streaming with partial message display
  - VPS offline banner in chat UI
  - Inter-agent messaging config in openclaw.json (agentToAgent with sessions tools)
affects: [06-04-realtime-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [VPS-aware routing with health check gate, WebSocket streaming with fallback to stub, graceful degradation pattern for offline VPS]

key-files:
  created:
    - packages/core/vps/vps-chat.ts
    - packages/core/vps/vps-task.ts
  modified:
    - packages/core/chat/chat-service.ts
    - packages/core/orchestrator/executor.ts
    - packages/core/server.ts
    - apps/web/_actions/chat-actions.ts
    - apps/web/_components/chat-layout.tsx
    - apps/web/_components/chat-message-list.tsx
    - apps/web/app/(dashboard)/businesses/[id]/chat/page.tsx
    - packages/runtime/generators/openclaw-config.ts

key-decisions:
  - "Chat service checks VPS health before generating stub -- routes to real VPS agent when online, falls back to stub when offline/unconfigured"
  - "Executor checks VPS health before mock execution -- sends to real VPS agent when online, queues with assistance request when offline"
  - "WebSocket streaming uses try/catch with fallback to stub typing indicator -- no breaking change if VPS WebSocket is unavailable"
  - "Inter-agent messaging uses tools.agentToAgent config block with explicit allow list of all business agent IDs"

patterns-established:
  - "VPS-aware routing: isVpsConfigured() -> checkVpsHealth() -> getVpsAgentId() -> sendToVps() with fallback chain"
  - "Offline degradation: system message for chat, assistance request + queue revert for tasks"
  - "WebSocket streaming: connect on send, parse token/complete/error events, fallback to stub display"

requirements-completed: [LIVE-01, LIVE-02, LIVE-03, LIVE-04, LIVE-05]

# Metrics
duration: 7min
completed: 2026-03-27
---

# Phase 6 Plan 03: VPS Chat and Task Routing Summary

**Real VPS agent routing for chat messages and task execution with WebSocket streaming, offline graceful degradation, and inter-agent messaging config**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-27T11:23:34Z
- **Completed:** 2026-03-27T11:30:43Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Chat messages route to real VPS agents when online, with VPS responses stored in existing messages table
- Task execution routes to real VPS agents when online, with results stored in existing tasks table
- Graceful degradation: chat shows "Agent is offline" system message, tasks queue with assistance request when VPS is unreachable
- WebSocket chat streaming displays partial agent response tokens with blinking cursor in real-time
- VPS offline banner in chat UI warns users when agents are unreachable
- Inter-agent messaging enabled via openclaw.json agentToAgent config with sessions_send/list/history capabilities

## Task Commits

Each task was committed atomically:

1. **Task 1: VPS chat and task routing services with graceful degradation** - `5249d47` (feat)
2. **Task 2: Chat UI WebSocket streaming, offline state, and inter-agent messaging config** - `a682b5f` (feat)

## Files Created/Modified
- `packages/core/vps/vps-chat.ts` - VPS chat routing: sendChatToVps, getVpsAgentId (with fallback derivation), getVpsChatWsUrl
- `packages/core/vps/vps-task.ts` - VPS task routing: sendTaskToVps with error handling and fallback result
- `packages/core/chat/chat-service.ts` - routeAndRespond now checks VPS health first, routes to real agent when online, sends offline system message when unreachable
- `packages/core/orchestrator/executor.ts` - executeTask now checks VPS health before mock execution, sends to real VPS agent when online, queues with assistance request when offline
- `packages/core/server.ts` - Added VPS chat/task routing exports (sendChatToVps, getVpsAgentId, getVpsChatWsUrl, sendTaskToVps)
- `apps/web/_actions/chat-actions.ts` - Added getVpsChatStreamUrl server action for WebSocket URL retrieval
- `apps/web/_components/chat-layout.tsx` - VPS offline banner, WebSocket streaming support, fallback to stub typing indicator
- `apps/web/_components/chat-message-list.tsx` - streamingContent/streamingAgentName props for partial message display with blinking cursor
- `apps/web/app/(dashboard)/businesses/[id]/chat/page.tsx` - Fetches VPS status and passes to ChatLayout
- `packages/runtime/generators/openclaw-config.ts` - Added tools.agentToAgent config with allow list and sessions capabilities

## Decisions Made
- Chat service checks VPS health before generating stub responses. When VPS is online/degraded and agent has a VPS mapping, messages route to the real agent. When VPS is offline, a system message notifies the user. When VPS is unconfigured, the existing stub path runs unchanged.
- Executor checks VPS health before mock tool execution. When VPS is online and agent is mapped, tasks execute on the real VPS agent. When VPS is offline, the task reverts to queued status and an assistance request is created. When VPS is unconfigured, the existing mock execution runs.
- WebSocket streaming wraps connection in try/catch. If WebSocket fails to connect or receives an error, the component falls back to showing the server-side response with the existing 1.5s typing indicator delay. No breaking change.
- Inter-agent messaging uses an explicit tools.agentToAgent config block in openclaw.json with an allow list of all business agent IDs and sessions_send/list/history capabilities, rather than relying only on the existing agents.communication block.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - VPS env vars (VPS_API_URL, VPS_API_KEY) remain optional. System degrades gracefully without them, preserving existing stub/mock behavior.

## Next Phase Readiness
- VPS chat and task routing complete, ready for 06-04 (real-time dashboard) to display live agent status
- WebSocket infrastructure established for streaming patterns in dashboard
- All stub/mock fallback paths preserved for development without VPS

## Self-Check: PASSED

All 10 files verified present. All 2 task commits verified in git log.

---
*Phase: 06-builder-and-automation*
*Completed: 2026-03-27*
