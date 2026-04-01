---
phase: 19-rate-limiting-api-cost-tracking
plan: 02
subsystem: api
tags: [rate-limiting, token-usage, cost-tracking, openclaw, vps, chat-ui]

# Dependency graph
requires:
  - phase: 19-rate-limiting-api-cost-tracking
    provides: "Rate limiter (executeWithRateLimit), budget service (checkBudget), model pricing (calculateCost), api_usage logging"
provides:
  - "VPS proxy returns split token counts (prompt + completion) from OpenClaw"
  - "VpsChatResponse includes tokenUsage from VPS poll response"
  - "routeAndRespond wraps all VPS chat calls in executeWithRateLimit"
  - "Every chat message logged to api_usage with real tokens, cost, and latency"
  - "Budget-exceeded requests return friendly system message"
  - "Rate-limited requests return queue position in chat"
  - "Chat UI shows queue status bubble with spinner and auto-polls for completion"
affects: [19-rate-limiting-api-cost-tracking, dashboard, revops]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Rate limit wrapper around VPS calls", "Queue status JSON in system messages with isQueueStatus metadata", "Snake_case to camelCase token usage conversion at VPS boundary"]

key-files:
  created: []
  modified:
    - "infra/vps/openclaw-client.ts"
    - "infra/vps/api-routes.ts"
    - "infra/vps/api-types.ts"
    - "packages/core/vps/vps-types.ts"
    - "packages/core/vps/vps-chat.ts"
    - "packages/core/chat/chat-service.ts"
    - "apps/web/_components/chat-message-bubble.tsx"
    - "apps/web/_components/chat-layout.tsx"

key-decisions:
  - "Queue status stored as JSON system message with isQueueStatus metadata flag for UI detection"
  - "Budget-exceeded content detection uses string includes('token budget') in chat bubble"
  - "Queue polling at 3s interval in chat-layout, stops when non-queue message arrives"
  - "High demand indicator is informational only, does not disable sending"

patterns-established:
  - "Rate limit wrapper pattern: executeWithRateLimit wraps VPS calls with budget check, slot acquisition, usage logging"
  - "Token usage boundary conversion: snake_case from VPS proxy JSON to camelCase in TypeScript domain types"

requirements-completed: [RATE-01, RATE-03, USAGE-01, VPS-01, QUEUE-UX-01]

# Metrics
duration: 6min
completed: 2026-04-01
---

# Phase 19 Plan 02: VPS Chat Integration Summary

**Rate-limited VPS chat routing with real token usage tracking, budget enforcement, and queue status UI**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-01T16:27:18Z
- **Completed:** 2026-04-01T16:33:00Z
- **Tasks:** 4
- **Files modified:** 8

## Accomplishments
- VPS proxy now returns prompt_tokens, completion_tokens, and total_tokens from OpenClaw response
- Every VPS chat call goes through executeWithRateLimit with real token counts, cost calculation, and api_usage logging
- Budget-exceeded requests return user-friendly system message instead of failing
- Rate-limited requests show queue position in chat with auto-polling for completion

## Task Commits

Each task was committed atomically:

1. **Task 1: Enhance VPS proxy to return split token counts** - `508aa86` (feat)
2. **Task 2: Update VPS types and vps-chat to parse token usage** - `27aa158` (feat)
3. **Task 3: Wire executeWithRateLimit into routeAndRespond** - `1652f37` (feat)
4. **Task 4: Chat UI queue status message and budget error display** - `69c69e3` (feat)

## Files Created/Modified
- `infra/vps/api-types.ts` - Added TokenUsage type, added tokenUsage to ChatResponse
- `infra/vps/openclaw-client.ts` - Parse split token counts from OpenClaw response
- `infra/vps/api-routes.ts` - Include tokenUsage in stored async chat result
- `packages/core/vps/vps-types.ts` - Added VpsTokenUsage interface, tokenUsage on VpsChatResponse and AsyncChatPollResponse
- `packages/core/vps/vps-chat.ts` - Parse snake_case token counts from poll response to camelCase
- `packages/core/chat/chat-service.ts` - Wrap sendChatToVps in executeWithRateLimit, handle budget/queue results, budget warning check
- `apps/web/_components/chat-message-bubble.tsx` - Queue status amber pill, budget-exceeded red warning
- `apps/web/_components/chat-layout.tsx` - Queue status polling at 3s, high demand indicator

## Decisions Made
- Queue status stored as JSON system message with `isQueueStatus` metadata flag -- allows existing message infrastructure to carry queue info without new DB columns
- Budget-exceeded detection in UI uses content string matching (`includes("token budget")`) -- simple and effective, no metadata flag needed since the message text is unique
- Queue polling at 3s interval with auto-cleanup when real response arrives -- balances responsiveness with request volume
- High demand indicator near send button is informational only -- does not disable sending to avoid blocking users

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Rate limiting is now fully wired into the VPS chat path
- Real token usage flows from OpenClaw through VPS proxy to api_usage table
- Ready for Plan 03 (Usage Dashboard) which will visualize the api_usage data
- Ready for Plan 04 (Slack budget alerts) which will use the budget_warning audit log entries

## Self-Check: PASSED

All 8 modified files verified on disk. All 4 task commit hashes verified in git log.

---
*Phase: 19-rate-limiting-api-cost-tracking*
*Completed: 2026-04-01*
