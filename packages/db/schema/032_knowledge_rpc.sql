-- ====== 032: Knowledge Retrieval RPC ======
CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(
  p_business_id uuid,
  p_agent_id uuid DEFAULT NULL,
  p_query_embedding vector(1536) DEFAULT NULL,
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
    1 - (kc.embedding <=> p_query_embedding)::float AS similarity
  FROM public.knowledge_chunks kc
  WHERE kc.business_id = p_business_id
    AND (
      kc.agent_id IS NULL
      OR kc.agent_id = p_agent_id
    )
    AND 1 - (kc.embedding <=> p_query_embedding) > p_match_threshold
  ORDER BY kc.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$;
