---
phase: 07-rag-knowledge-base
plan: 01
subsystem: database, api
tags: [pgvector, openai, embeddings, rag, pdf-parse, mammoth, xlsx, cosine-similarity, hnsw]

# Dependency graph
requires:
  - phase: 06-builder-and-automation
    provides: "Core module pattern (index.ts client-safe, server.ts server-only), Supabase schema conventions"
provides:
  - "pgvector extension enabled"
  - "knowledge_documents, knowledge_chunks, knowledge_retrievals tables with RLS"
  - "HNSW index for cosine similarity search"
  - "match_knowledge_chunks RPC for semantic retrieval"
  - "Knowledge types (KnowledgeDocument, KnowledgeChunk, RetrievedContext, KnowledgeSource)"
  - "Text extraction pipeline (txt, md, pdf, docx, xlsx)"
  - "Recursive character text chunker (~512 tokens per chunk)"
  - "OpenAI text-embedding-3-small wrapper with batching"
  - "Document CRUD service with replace-on-re-upload"
  - "Semantic retrieval with context formatting and source attribution"
affects: [07-02-knowledge-ui, 07-03-runtime-injection]

# Tech tracking
tech-stack:
  added: [pdf-parse@2, mammoth, xlsx, openai]
  patterns: [pgvector-similarity-search, recursive-character-chunking, two-tier-knowledge-scoping, replace-on-re-upload]

key-files:
  created:
    - packages/db/schema/030_pgvector_extension.sql
    - packages/db/schema/031_knowledge_tables.sql
    - packages/db/schema/032_knowledge_rpc.sql
    - packages/core/knowledge/knowledge-types.ts
    - packages/core/knowledge/text-extractor.ts
    - packages/core/knowledge/chunker.ts
    - packages/core/knowledge/embedder.ts
    - packages/core/knowledge/knowledge-service.ts
    - packages/core/knowledge/retriever.ts
  modified:
    - packages/db/schema/_combined_schema.sql
    - packages/core/index.ts
    - packages/core/server.ts
    - packages/core/package.json
    - pnpm-lock.yaml

key-decisions:
  - "pdf-parse v2 uses class-based PDFParse API instead of v1 default function -- updated import pattern accordingly"
  - "Embeddings stored as JSON-stringified arrays in INSERT (Supabase handles vector casting)"
  - "Retriever returns empty context gracefully when OPENAI_API_KEY is missing -- no hard failure"
  - "Two-tier scoping: agent_id NULL = global business-wide, agent_id NOT NULL = per-agent"

patterns-established:
  - "Knowledge module pattern: types -> extractor -> chunker -> embedder -> service -> retriever pipeline"
  - "pgvector HNSW index with vector_cosine_ops for semantic similarity search"
  - "Replace-on-re-upload: delete existing doc with same filename+business_id+agent_id before inserting"
  - "context_string XML format with <knowledge_context> tags for prompt injection"

requirements-completed: [RAG-01, RAG-02, RAG-03, RAG-04]

# Metrics
duration: 4min
completed: 2026-03-27
---

# Phase 7 Plan 01: Schema & Core Pipeline Summary

**pgvector schema with HNSW-indexed knowledge tables, 5-format text extraction pipeline, recursive chunking, OpenAI embedding, and semantic retrieval with two-tier business/agent scoping**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-27T17:30:28Z
- **Completed:** 2026-03-27T17:35:22Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- pgvector extension enabled with three knowledge tables (documents, chunks, retrievals) fully RLS-protected using existing is_business_member/has_role_on_business helpers
- HNSW index on vector(1536) embedding column for fast cosine similarity search via match_knowledge_chunks RPC
- Complete knowledge processing pipeline: text extraction from 5 file types (txt, md, pdf, docx, xlsx) -> recursive character chunking (~512 tokens) -> OpenAI embedding generation with batching -> storage with status tracking
- Semantic retrieval formats context as XML block with source attribution and logs retrieval events for observability

## Task Commits

Each task was committed atomically:

1. **Task 1: pgvector extension, knowledge tables, RLS policies, HNSW index, and retrieval RPC** - `a39544f` (feat)
2. **Task 2: Knowledge core module -- types, text extractor, chunker, embedder, service, retriever, and exports** - `302fa0b` (feat)

## Files Created/Modified
- `packages/db/schema/030_pgvector_extension.sql` - Enables pgvector extension
- `packages/db/schema/031_knowledge_tables.sql` - knowledge_documents, knowledge_chunks, knowledge_retrievals with RLS and HNSW index
- `packages/db/schema/032_knowledge_rpc.sql` - match_knowledge_chunks similarity search RPC (SECURITY DEFINER)
- `packages/db/schema/_combined_schema.sql` - Appended all three migration contents
- `packages/core/knowledge/knowledge-types.ts` - Type definitions for knowledge system
- `packages/core/knowledge/text-extractor.ts` - Text extraction from PDF (pdf-parse v2), DOCX (mammoth), XLSX, TXT, MD
- `packages/core/knowledge/chunker.ts` - Recursive character text splitter (~2000 chars, ~200 overlap)
- `packages/core/knowledge/embedder.ts` - OpenAI text-embedding-3-small wrapper with batching (2048 per call)
- `packages/core/knowledge/knowledge-service.ts` - Document CRUD with processDocument pipeline and replace-on-re-upload
- `packages/core/knowledge/retriever.ts` - Semantic search via RPC with context formatting and retrieval logging
- `packages/core/index.ts` - Added knowledge type exports (client-safe)
- `packages/core/server.ts` - Added knowledge service, retriever, extractor, chunker, embedder exports (server-only)
- `packages/core/package.json` - Added pdf-parse, mammoth, xlsx, openai dependencies
- `pnpm-lock.yaml` - Updated lockfile

## Decisions Made
- **pdf-parse v2 API:** v2.4.5 uses class-based `PDFParse` with `getText()` method instead of v1 default function -- adapted import and usage pattern accordingly
- **Embeddings as JSON strings:** Supabase handles vector casting from JSON-stringified arrays, so embeddings are stored via `JSON.stringify(embedding)` in INSERT operations
- **Graceful degradation:** Retriever returns empty context when OPENAI_API_KEY is missing instead of throwing, allowing the app to function without embeddings configured
- **Two-tier scoping:** Global docs (agent_id IS NULL) are included in all agent retrievals alongside agent-specific docs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pdf-parse v2 import pattern**
- **Found during:** Task 2 (text extractor implementation)
- **Issue:** pdf-parse v2.4.5 no longer exports a default function; uses class-based `PDFParse` with `getText()` method
- **Fix:** Changed from `(await import("pdf-parse")).default` to `const { PDFParse } = await import("pdf-parse")` with class instantiation
- **Files modified:** packages/core/knowledge/text-extractor.ts
- **Verification:** pnpm turbo typecheck passes (all 5 tasks successful)
- **Committed in:** 302fa0b (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary API adaptation for pdf-parse v2. No scope creep.

## Issues Encountered
None beyond the pdf-parse v2 API change documented above.

## User Setup Required
None - no external service configuration required. OPENAI_API_KEY is needed for embedding generation but the system gracefully degrades without it.

## Next Phase Readiness
- Schema and core pipeline ready for UI layer (07-02) to build document upload, management, and retrieval pages
- Retriever is ready for runtime injection (07-03) to inject knowledge context into agent prompts
- SQL migrations need to be applied to Supabase cloud instance before testing

---
*Phase: 07-rag-knowledge-base*
*Completed: 2026-03-27*
