---
phase: 12-integrations-catalog-setup
plan: 02
subsystem: integrations
tags: [anthropic, streaming, instructions, ai-generation, readablestream, typewriter]

# Dependency graph
requires:
  - phase: 12-integrations-catalog-setup
    provides: Integration catalog, schema migration (setup_instructions column), catalog dialog, config cards
  - phase: 08-prompt-generator-agent-creation
    provides: Anthropic SDK pattern (getAnthropicApiKey, getClient, CLAUDE_MODELS)
provides:
  - AI-powered streaming setup instruction generation using Anthropic SDK client.messages.stream()
  - Streaming API route bridging core service to client via ReadableStream
  - Progressive token rendering panel (typewriter effect) with regeneration
  - Catalog dialog Step 3 with live streaming AI instructions after integration creation
  - Integration config card View Setup button for stored instruction viewing
affects: [integration-management, agent-detail, deployment-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: [Anthropic streaming via client.messages.stream(), async generator for token streaming, ReadableStream bridging server-to-client, progressive fetch + getReader consumption]

key-files:
  created:
    - packages/core/integrations/instructions-service.ts
    - apps/web/app/api/integrations/instructions/route.ts
    - apps/web/_components/catalog-instructions-panel.tsx
  modified:
    - packages/core/server.ts
    - apps/web/_actions/integration-actions.ts
    - apps/web/_components/integration-catalog-dialog.tsx
    - apps/web/_components/integration-config-card.tsx

key-decisions:
  - "Used raw MessageStreamEvent iteration with content_block_delta/text_delta filtering instead of on('text') callback for async generator compatibility"
  - "text/plain streaming (not SSE) for simpler client consumption via response.body.getReader()"
  - "API route persists full accumulated instructions to DB after stream completes (primary save path), with server action as fallback"
  - "CatalogInstructionsPanel conditionally renders only when setupOpen=true to prevent streaming on card mount"

patterns-established:
  - "Anthropic streaming async generator: client.messages.stream() + for-await event iteration + yield text deltas"
  - "ReadableStream bridge: core async generator -> API route ReadableStream -> client fetch + getReader"
  - "Progressive rendering: accumulated state updated per chunk with blinking cursor indicator during stream"

requirements-completed: [INTG-ENH-01, INTG-ENH-02, INTG-ENH-03, INTG-ENH-04]

# Metrics
duration: 6min
completed: 2026-03-29
---

# Phase 12 Plan 02: AI Streaming Setup Instructions Summary

**Anthropic SDK streaming instruction generator with progressive typewriter rendering, catalog dialog Step 3 live AI instructions, and config card View Setup button**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-29T21:41:01Z
- **Completed:** 2026-03-29T21:47:10Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- AI-powered streaming instruction generation using Anthropic SDK client.messages.stream() with CLAUDE_MODELS-derived latest sonnet model
- Async generator yields text chunks from Claude, bridged to client via ReadableStream API route
- CatalogInstructionsPanel with progressive token rendering (typewriter effect) and blinking cursor indicator
- Catalog dialog Step 3 transitions from placeholder to live streaming AI instructions after integration creation
- IntegrationConfigCard gains "View Setup" button opening stored instructions dialog (immediate, no re-stream)
- Regenerate button triggers fresh streaming generation on demand
- Graceful fallback when ANTHROPIC_API_KEY missing (error message, not crash)
- saveSetupInstructionsAction server action as fallback persistence path

## Task Commits

Each task was committed atomically:

1. **Task 1: Streaming instructions service, API route, save action, and core exports** - `bcf9a2b` (feat)
2. **Task 2: Streaming instructions panel, catalog dialog Step 3, and config card View Setup** - `8d33599` (feat)

## Files Created/Modified
- `packages/core/integrations/instructions-service.ts` - Anthropic streaming instruction generator (async generator, client.messages.stream)
- `packages/core/server.ts` - Added streamSetupInstructions export
- `apps/web/app/api/integrations/instructions/route.ts` - Streaming API route bridging core to client as ReadableStream
- `apps/web/_actions/integration-actions.ts` - Added saveSetupInstructionsAction fallback persist
- `apps/web/_components/catalog-instructions-panel.tsx` - Progressive rendering panel with streaming consumption, regenerate, error fallback
- `apps/web/_components/integration-catalog-dialog.tsx` - Step 3 updated with live streaming AI instructions and target context
- `apps/web/_components/integration-config-card.tsx` - Added View Setup button and instructions dialog with stored/streaming modes

## Decisions Made
- Used raw MessageStreamEvent iteration with content_block_delta/text_delta filtering for clean async generator pattern
- text/plain streaming response (simpler than SSE for this use case -- client reads via getReader)
- API route handles both streaming and DB persistence in single request (accumulates full text during stream)
- CatalogInstructionsPanel renders conditionally on dialog open to prevent premature streaming

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
ANTHROPIC_API_KEY must be set in environment for AI instruction generation. Without it, a graceful fallback message is shown.

## Next Phase Readiness
- Full integration catalog and AI instruction flow complete
- Phase 12 (final phase) is now complete -- all plans executed
- All INTG-ENH requirements addressed across plans 12-01 and 12-02

## Self-Check: PASSED

All 7 files verified present. Both task commits verified in git log.

---
*Phase: 12-integrations-catalog-setup*
*Completed: 2026-03-29*
