-- ====== 031: Knowledge Tables ======

-- knowledge_documents: stores document metadata
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents ON DELETE CASCADE,
  title text NOT NULL,
  filename text,
  file_type text NOT NULL DEFAULT 'text'
    CHECK (file_type IN ('text', 'markdown', 'pdf', 'docx', 'xlsx')),
  file_size_bytes integer,
  storage_path text,
  status text NOT NULL DEFAULT 'uploading'
    CHECK (status IN ('uploading', 'processing', 'ready', 'failed')),
  error_message text,
  chunk_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_knowledge_docs_business
  ON public.knowledge_documents (business_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_agent
  ON public.knowledge_documents (business_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_status
  ON public.knowledge_documents (business_id, status);

-- RLS: members read, owner/admin write
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

-- knowledge_chunks: stores text chunks with embeddings
CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES public.knowledge_documents ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  embedding vector(1536) NOT NULL,
  token_count integer,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_business
  ON public.knowledge_chunks (business_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_agent
  ON public.knowledge_chunks (business_id, agent_id);

-- HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
  ON public.knowledge_chunks
  USING hnsw (embedding vector_cosine_ops);

-- RLS: members read, owner/admin write
CREATE POLICY "knowledge_chunks_select_member" ON public.knowledge_chunks
  FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE POLICY "knowledge_chunks_insert_admin" ON public.knowledge_chunks
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin'));
CREATE POLICY "knowledge_chunks_delete_admin" ON public.knowledge_chunks
  FOR DELETE TO authenticated
  USING (public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin'));

-- knowledge_retrievals: logs retrieval events for observability
CREATE TABLE IF NOT EXISTS public.knowledge_retrievals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents,
  conversation_id uuid REFERENCES public.conversations,
  task_id uuid REFERENCES public.tasks,
  query_text text NOT NULL,
  chunks_retrieved jsonb NOT NULL DEFAULT '[]',
  retrieval_time_ms integer,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.knowledge_retrievals ENABLE ROW LEVEL SECURITY;

-- RLS: members read, members insert (agents need to log retrievals)
CREATE POLICY "knowledge_retrievals_select_member" ON public.knowledge_retrievals
  FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE POLICY "knowledge_retrievals_insert_member" ON public.knowledge_retrievals
  FOR INSERT TO authenticated
  WITH CHECK (public.is_business_member(business_id));
