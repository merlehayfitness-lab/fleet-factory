---
phase: 07-rag-knowledge-base
plan: 03
subsystem: api, ui
tags: [rag, knowledge-injection, source-attribution, chat-service, executor, vps-types, footnotes]

# Dependency graph
requires:
  - phase: 07-rag-knowledge-base
    plan: 01
    provides: "retrieveKnowledgeContext, RetrievedContext type, KnowledgeSource type, knowledge_retrievals table"
  - phase: 07-rag-knowledge-base
    plan: 02
    provides: "Knowledge Base UI with document upload and management"
provides:
  - "RAG context injection in chat service routeAndRespond before agent routing"
  - "RAG context injection in executor executeTask before VPS/mock task execution"
  - "VpsChatRequest and VpsTaskRequest with optional knowledgeContext field"
  - "knowledgeSources array in agent message metadata for UI rendering"
  - "KnowledgeSourceFootnotes expandable component for source attribution"
  - "Source footnotes integrated into ChatMessageBubble below tool call traces"
affects: [08-01-role-definition]

# Tech tracking
tech-stack:
  added: []
  patterns: [rag-context-injection, source-attribution-footnotes, graceful-degradation-on-retrieval-failure]

key-files:
  created:
    - apps/web/_components/knowledge-source-footnotes.tsx
  modified:
    - packages/core/vps/vps-types.ts
    - packages/core/vps/vps-chat.ts
    - packages/core/vps/vps-task.ts
    - packages/core/chat/chat-service.ts
    - packages/core/orchestrator/executor.ts
    - apps/web/_components/chat-message-bubble.tsx

key-decisions:
  - "Dynamic import for retrieveKnowledgeContext to avoid hard dependency in chat/executor modules"
  - "Knowledge context passed through VPS chat/task functions as optional string parameter"
  - "Source footnotes use simple useState toggle (no Collapsible component) for lightweight expand/collapse"
  - "Sources rendered below tool call traces but above timestamp in chat message visual hierarchy"

patterns-established:
  - "RAG injection pattern: retrieve context before agent routing, include in VPS request, store sources in metadata"
  - "Source attribution pattern: knowledgeSources array in message metadata, rendered via KnowledgeSourceFootnotes"

requirements-completed: [RAG-06, RAG-07]

# Metrics
duration: 3min
completed: 2026-03-27
---

# Phase 7 Plan 03: Runtime Injection & Source Attribution Summary

**RAG context injection into chat and task execution paths with expandable source footnotes showing document title, chunk preview, and similarity scores on agent messages**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-27T17:47:14Z
- **Completed:** 2026-03-27T17:50:47Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Chat service routeAndRespond retrieves knowledge context before every agent interaction, injecting it into VPS requests and including sources in agent message metadata
- Executor executeTask retrieves knowledge context before VPS/mock task execution, passing context to VPS and storing sources in task result metadata
- VPS types updated with optional knowledgeContext field on both VpsChatRequest and VpsTaskRequest
- Source footnotes component renders expandable attribution below agent messages -- collapsed by default with source count, expandable to show document title, chunk preview (~150 chars), and similarity percentage badge

## Task Commits

Each task was committed atomically:

1. **Task 1: RAG context injection in chat service, executor, and VPS type updates** - `eeb10da` (feat)
2. **Task 2: Source footnotes component and chat UI integration** - `e696b92` (feat)

## Files Created/Modified
- `packages/core/vps/vps-types.ts` - Added optional knowledgeContext field to VpsChatRequest and VpsTaskRequest
- `packages/core/vps/vps-chat.ts` - Updated sendChatToVps to accept and forward knowledgeContext
- `packages/core/vps/vps-task.ts` - Updated sendTaskToVps to accept and forward knowledgeContext
- `packages/core/chat/chat-service.ts` - Added RAG retrieval in routeAndRespond, knowledge sources in message metadata
- `packages/core/orchestrator/executor.ts` - Added RAG retrieval in executeTask, knowledge sources in VPS task result
- `apps/web/_components/knowledge-source-footnotes.tsx` - Expandable source attribution component with BookOpen icon, similarity badges
- `apps/web/_components/chat-message-bubble.tsx` - Integrated KnowledgeSourceFootnotes below tool call traces for agent messages

## Decisions Made
- **Dynamic import for retriever:** Used `await import("../knowledge/retriever")` to avoid hard dependency in chat-service and executor modules, keeping them functional even if knowledge module has issues
- **Knowledge context as optional string:** Passed through VPS chat/task functions as an optional parameter rather than modifying the payload types to include full RetrievedContext, keeping the VPS interface simple
- **Simple expand/collapse:** Used useState toggle for source footnotes instead of Collapsible component, matching the lightweight UI pattern established in the project
- **Visual hierarchy:** Source footnotes placed after tool call traces but before timestamp, maintaining the message content > tool calls > sources > timestamp reading order

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. OPENAI_API_KEY is needed for knowledge retrieval but the system gracefully degrades without it.

## Next Phase Readiness
- RAG knowledge base system fully wired: schema (07-01), UI (07-02), and runtime injection (07-03) all complete
- Phase 7 complete -- ready for Phase 8 (Role Definition & Prompt Generation)
- All agent interactions (chat and task) now automatically retrieve and inject relevant knowledge context

## Self-Check: PASSED

All 7 created/modified files verified on disk. Both task commits (eeb10da, e696b92) verified in git log.

---
*Phase: 07-rag-knowledge-base*
*Completed: 2026-03-27*
