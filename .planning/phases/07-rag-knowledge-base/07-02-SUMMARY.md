---
phase: 07-rag-knowledge-base
plan: 02
subsystem: ui
tags: [drag-and-drop, file-upload, knowledge-base, document-management, status-polling, chunk-preview, agent-tabs]

# Dependency graph
requires:
  - phase: 07-rag-knowledge-base
    plan: 01
    provides: "Knowledge service CRUD, processDocument pipeline, listDocuments, getDocumentChunks, reIndexDocument"
provides:
  - "Global Knowledge Base page at /businesses/[id]/knowledge"
  - "KnowledgeUploadZone with drag-and-drop multi-file and paste-text input"
  - "KnowledgeDocumentList with status badges, polling, and actions (View Chunks, Re-index, Delete)"
  - "KnowledgeChunkPreview expandable chunk detail per document"
  - "AgentKnowledgeTab with agent-specific upload and global docs link"
  - "7 Server Actions: uploadDocument, triggerProcessing, pasteText, delete, reIndex, list, getChunks"
  - "Sidebar nav Knowledge Base item with BookOpen icon"
  - "Agent detail page 6th Knowledge tab"
affects: [07-03-runtime-injection]

# Tech tracking
tech-stack:
  added: []
  patterns: [two-phase-upload, fire-and-forget-processing, status-polling, controlled-alert-dialog]

key-files:
  created:
    - apps/web/_actions/knowledge-actions.ts
    - apps/web/app/(dashboard)/businesses/[id]/knowledge/page.tsx
    - apps/web/_components/knowledge-upload-zone.tsx
    - apps/web/_components/knowledge-document-list.tsx
    - apps/web/_components/knowledge-chunk-preview.tsx
    - apps/web/_components/agent-knowledge-tab.tsx
  modified:
    - apps/web/_components/agent-detail-tabs.tsx
    - apps/web/_components/sidebar-nav.tsx

key-decisions:
  - "Two-phase upload pattern: uploadDocumentAction returns immediately with document record, triggerProcessingAction fires as fire-and-forget for async processing"
  - "Paste-text stored in Supabase Storage as .txt file so triggerProcessingAction can download and process uniformly"
  - "5-second polling interval for documents in uploading/processing state, stops when all documents reach terminal state"
  - "Controlled AlertDialog pattern for delete confirmation (open state managed externally)"

patterns-established:
  - "Two-phase server action pattern: fast action returns immediately, long-running action fires as fire-and-forget with client polling"
  - "Status polling with useEffect + setInterval for async processing status updates"
  - "Agent tab with scoped content + link to global business-level page"

requirements-completed: [RAG-02, RAG-05]

# Metrics
duration: 5min
completed: 2026-03-27
---

# Phase 7 Plan 02: Knowledge Base UI Summary

**Drag-and-drop Knowledge Base UI with two-phase async upload, document management table with status polling, expandable chunk previews, and agent-specific knowledge tab**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-27T17:38:23Z
- **Completed:** 2026-03-27T17:43:45Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Global Knowledge Base page at /businesses/[id]/knowledge with file-manager-style interface for uploading and managing business-wide documents
- Drag-and-drop upload zone supporting multi-file upload and paste-text input with client-side validation (file types, 25MB limit)
- Document table with color-coded status badges (uploading=blue, processing=amber, ready=green, failed=red), kebab menu actions, and 5-second auto-polling
- Expandable chunk preview showing numbered chunks with truncated text and token count badges
- Agent detail page extended with 6th Knowledge tab showing agent-specific docs and link to inherited global Knowledge Base

## Task Commits

Each task was committed atomically:

1. **Task 1: Server Actions for knowledge operations and global Knowledge Base page** - `c10826e` (feat)
2. **Task 2: Upload zone, document list, chunk preview, and agent knowledge tab components** - `841eaa2` (feat)

## Files Created/Modified
- `apps/web/_actions/knowledge-actions.ts` - 7 Server Actions: uploadDocument, triggerProcessing, pasteText, delete, reIndex, list, getChunks
- `apps/web/app/(dashboard)/businesses/[id]/knowledge/page.tsx` - Global Knowledge Base page (Server Component)
- `apps/web/_components/knowledge-upload-zone.tsx` - Drag-and-drop upload zone with paste-text support
- `apps/web/_components/knowledge-document-list.tsx` - Document table with status badges, actions, and polling
- `apps/web/_components/knowledge-chunk-preview.tsx` - Expandable chunk detail per document
- `apps/web/_components/agent-knowledge-tab.tsx` - Agent-specific knowledge tab with global docs link
- `apps/web/_components/agent-detail-tabs.tsx` - Extended from 5 to 6 tabs with Knowledge tab
- `apps/web/_components/sidebar-nav.tsx` - Added Knowledge Base nav item with BookOpen icon

## Decisions Made
- **Two-phase upload pattern:** uploadDocumentAction returns immediately with the document record (status='uploading'), then the client fires triggerProcessingAction as fire-and-forget. The document list polls every 5 seconds to observe status transitions. This keeps the UI responsive during long processing pipelines.
- **Paste-text storage:** Pasted text content is stored in Supabase Storage as a .txt file, so triggerProcessingAction can uniformly download and process both file uploads and pasted text without special-casing.
- **Controlled AlertDialog for delete:** Delete confirmation uses externally managed open state (deleteTarget !== null) to trigger from kebab dropdown menu items, following the controlled dialog pattern established in Phase 2.
- **5-second polling interval:** Balanced between responsiveness and server load; polling stops automatically when no documents are in uploading/processing state.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. The Supabase Storage bucket 'knowledge-docs' must exist for file uploads to work, but this is a runtime dependency, not a setup step.

## Next Phase Readiness
- Knowledge Base UI complete, ready for runtime injection (07-03) to inject knowledge context into agent prompts
- All 7 Server Actions operational and type-safe
- Agent Knowledge tab integrated and accessible from agent detail page

## Self-Check: PASSED

All 8 created/modified files verified on disk. Both task commits (c10826e, 841eaa2) verified in git log.

---
*Phase: 07-rag-knowledge-base*
*Completed: 2026-03-27*
