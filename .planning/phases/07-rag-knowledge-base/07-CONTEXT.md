# Phase 7: RAG Knowledge Base - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Agents become business-specific domain experts through two-tier knowledge: global business-wide docs and per-agent role-specific docs, with document upload, embedding, and automatic retrieval at runtime. pgvector enabled with knowledge_documents, knowledge_chunks, and knowledge_retrievals tables with RLS. Knowledge synced from Supabase to VPS for fast local retrieval. Retrieved context automatically prepended to agent system prompt before model call.

</domain>

<decisions>
## Implementation Decisions

### Document Upload Experience
- **File types**: Text (.txt, .md), PDF (.pdf), Office (.docx, .xlsx) -- no images/video for MVP
- **Upload UI**: Drag-and-drop zone (multi-file supported)
- **Size limit**: 25 MB per file
- **Text input**: Both file upload and paste text (raw text area for pasting snippets), pasted text requires a title
- **Versioning**: Replace on re-upload -- same filename overwrites the previous version (re-chunks and re-embeds)
- **Deletion**: Yes, with confirmation dialog before removing doc and all associated chunks
- **Document limits**: No per-business or per-agent doc limit for MVP
- **Bulk upload**: Multi-file drag-and-drop in a single operation

### Knowledge Scoping & Inheritance
- **Tiers**: Two tiers only -- global (business-wide) and per-agent (no department-level tier)
- **Auto-access**: Global docs are automatically inherited by all agents in the business
- **Layout**: Separate pages -- global Knowledge Base on a business-level page, per-agent Knowledge Base on the agent config tab
- **Visibility on agent page**: Show agent-specific docs, with a link to the global Knowledge Base
- **Conflict resolution**: Agent-specific docs override global docs when both match (ranked higher in retrieval)
- **Navigation**: New "Knowledge Base" sidebar item for the global business-level page
- **Frozen agents**: Docs stay accessible even when an agent is frozen (knowledge is read-only data, not execution)

### Indexing & Status Visibility
- **Processing indicator**: Status badge per document -- uploading -> processing -> ready / failed
- **Failure handling**: Show error message + retry button per failed document
- **Chunk detail**: Expandable detail per document showing its chunks with truncated text preview
- **Re-index**: Re-index button per document to force re-chunking and re-embedding
- **Processing model**: Async -- user can navigate away, processing continues server-side
- **Completion notification**: Toast when processing finishes (success or failure)
- **Stats**: No separate stats dashboard -- just the document list with status badges

### Retrieval Behavior at Runtime
- **Chunk count**: Top 3 chunks per interaction (semantic similarity search)
- **Transparency**: Show sources in chat as footnotes / expandable section so admin sees which docs informed the response
- **Trigger**: Every message -- always retrieve relevant context (no manual toggle)
- **VPS sync**: Stub for MVP -- knowledge retrieval happens via Supabase; VPS sync is deferred to v2 VPS activation theme

### Claude's Discretion
- Chunk size and overlap strategy for text splitting
- Embedding model selection (e.g., OpenAI text-embedding-3-small vs alternatives)
- Exact pgvector index type (ivfflat vs hnsw) and tuning parameters
- Toast notification timing and styling
- Loading skeleton designs for upload and processing states
- Exact layout spacing and typography within the Knowledge Base pages

</decisions>

<specifics>
## Specific Ideas

- Global Knowledge Base page should feel like a file manager -- list of docs with status badges, not a complex dashboard
- Agent config tab should show "agent-only docs here, see global Knowledge Base for inherited docs" with a link
- Source footnotes in chat should be unobtrusive -- expandable section, not inline clutter
- Replace-on-re-upload should feel seamless -- drag a new version, old one disappears, re-processing starts automatically

</specifics>

<deferred>
## Deferred Ideas

- VPS-local knowledge sync for fast retrieval (currently retrieval goes through Supabase) -- deferred to v2 VPS Activation theme
- Department-level knowledge tier (between global and per-agent) -- not needed for MVP
- Document usage analytics / stats dashboard -- can add later if needed
- Knowledge Base search across all docs -- future enhancement

</deferred>

---

*Phase: 07-rag-knowledge-base*
*Context gathered: 2026-03-27*
