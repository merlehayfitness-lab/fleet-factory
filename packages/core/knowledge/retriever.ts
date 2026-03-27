import type { SupabaseClient } from "@supabase/supabase-js";
import type { RetrievedContext, KnowledgeSource } from "./knowledge-types";
import { generateEmbedding } from "./embedder";

interface RetrieveOptions {
  matchThreshold?: number;
  matchCount?: number;
  conversationId?: string;
  taskId?: string;
}

/**
 * Retrieve relevant knowledge context for a query using semantic similarity search.
 *
 * 1. Generates embedding for the query text
 * 2. Calls match_knowledge_chunks RPC (cosine similarity, HNSW index)
 * 3. Formats context string with source attribution
 * 4. Logs the retrieval event for observability
 *
 * Returns empty context gracefully if OPENAI_API_KEY is not set.
 */
export async function retrieveKnowledgeContext(
  supabase: SupabaseClient,
  businessId: string,
  agentId: string | null,
  queryText: string,
  options?: RetrieveOptions
): Promise<RetrievedContext> {
  const startTime = Date.now();

  const matchThreshold = options?.matchThreshold ?? 0.7;
  const matchCount = options?.matchCount ?? 3;

  // If OPENAI_API_KEY is not set, return empty context gracefully
  if (!process.env.OPENAI_API_KEY) {
    return {
      contextString: "",
      sources: [],
      retrievalTimeMs: Date.now() - startTime,
    };
  }

  try {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(queryText);

    // Call the match_knowledge_chunks RPC
    const { data: chunks, error } = await supabase.rpc(
      "match_knowledge_chunks",
      {
        p_business_id: businessId,
        p_agent_id: agentId,
        p_query_embedding: JSON.stringify(queryEmbedding),
        p_match_threshold: matchThreshold,
        p_match_count: matchCount,
      }
    );

    if (error) {
      console.error("Knowledge retrieval RPC error:", error.message);
      return {
        contextString: "",
        sources: [],
        retrievalTimeMs: Date.now() - startTime,
      };
    }

    if (!chunks || chunks.length === 0) {
      return {
        contextString: "",
        sources: [],
        retrievalTimeMs: Date.now() - startTime,
      };
    }

    // Fetch document titles for matched chunks
    const documentIds = [
      ...new Set(chunks.map((c: Record<string, unknown>) => c.document_id)),
    ];
    const { data: docs } = await supabase
      .from("knowledge_documents")
      .select("id, title")
      .in("id", documentIds);

    const titleMap = new Map<string, string>();
    if (docs) {
      for (const doc of docs) {
        titleMap.set(doc.id, doc.title);
      }
    }

    // Format context string
    const contextParts: string[] = [
      "<knowledge_context>",
      "The following information is from the business knowledge base. Use it to inform your response when relevant.",
      "",
    ];

    const sources: KnowledgeSource[] = [];

    for (const chunk of chunks as Array<Record<string, unknown>>) {
      const documentTitle =
        titleMap.get(chunk.document_id as string) ?? "Unknown Document";
      const content = chunk.content as string;
      const chunkIndex = chunk.chunk_index as number;
      const similarity = chunk.similarity as number;

      contextParts.push(
        `[Source: ${documentTitle}, Chunk ${chunkIndex}]`
      );
      contextParts.push(content);
      contextParts.push("");

      sources.push({
        chunkId: chunk.id as string,
        documentId: chunk.document_id as string,
        documentTitle,
        chunkPreview: content.slice(0, 200),
        similarity,
      });
    }

    contextParts.push("</knowledge_context>");
    const contextString = contextParts.join("\n");

    const retrievalTimeMs = Date.now() - startTime;

    // Log retrieval event (best-effort, don't throw on failure)
    try {
      await supabase.from("knowledge_retrievals").insert({
        business_id: businessId,
        agent_id: agentId,
        conversation_id: options?.conversationId ?? null,
        task_id: options?.taskId ?? null,
        query_text: queryText,
        chunks_retrieved: sources.map((s) => ({
          chunk_id: s.chunkId,
          document_id: s.documentId,
          similarity: s.similarity,
        })),
        retrieval_time_ms: retrievalTimeMs,
      });
    } catch (logError) {
      console.error("Failed to log knowledge retrieval:", logError);
    }

    return { contextString, sources, retrievalTimeMs };
  } catch (error) {
    console.error("Knowledge retrieval error:", error);
    return {
      contextString: "",
      sources: [],
      retrievalTimeMs: Date.now() - startTime,
    };
  }
}
