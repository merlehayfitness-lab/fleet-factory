import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  KnowledgeDocument,
  KnowledgeChunk,
  KnowledgeFileType,
} from "./knowledge-types";
import { extractText } from "./text-extractor";
import { chunkText } from "./chunker";
import { generateEmbeddings } from "./embedder";

/**
 * Map a Supabase row to a KnowledgeDocument.
 */
function mapDocument(row: Record<string, unknown>): KnowledgeDocument {
  return {
    id: row.id as string,
    businessId: row.business_id as string,
    agentId: (row.agent_id as string) ?? null,
    title: row.title as string,
    filename: (row.filename as string) ?? null,
    fileType: row.file_type as KnowledgeFileType,
    fileSizeBytes: (row.file_size_bytes as number) ?? null,
    storagePath: (row.storage_path as string) ?? null,
    status: row.status as KnowledgeDocument["status"],
    errorMessage: (row.error_message as string) ?? null,
    chunkCount: (row.chunk_count as number) ?? 0,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/**
 * Map a Supabase row to a KnowledgeChunk (without embedding for transfer efficiency).
 */
function mapChunk(row: Record<string, unknown>): KnowledgeChunk {
  return {
    id: row.id as string,
    documentId: row.document_id as string,
    businessId: row.business_id as string,
    agentId: (row.agent_id as string) ?? null,
    chunkIndex: row.chunk_index as number,
    content: row.content as string,
    tokenCount: (row.token_count as number) ?? null,
    createdAt: row.created_at as string,
  };
}

/**
 * Create a knowledge document record.
 * If a document with the same filename, business_id, and agent_id exists, it is replaced.
 */
export async function createDocument(
  supabase: SupabaseClient,
  businessId: string,
  agentId: string | null,
  title: string,
  filename: string | null,
  fileType: KnowledgeFileType,
  fileSizeBytes: number | null,
  storagePath: string | null
): Promise<KnowledgeDocument> {
  // Replace-on-re-upload: delete existing doc with same filename + business + agent
  if (filename) {
    let query = supabase
      .from("knowledge_documents")
      .delete()
      .eq("business_id", businessId)
      .eq("filename", filename);

    if (agentId) {
      query = query.eq("agent_id", agentId);
    } else {
      query = query.is("agent_id", null);
    }

    await query;
  }

  const { data, error } = await supabase
    .from("knowledge_documents")
    .insert({
      business_id: businessId,
      agent_id: agentId,
      title,
      filename,
      file_type: fileType,
      file_size_bytes: fileSizeBytes,
      storage_path: storagePath,
      status: "uploading",
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create knowledge document: ${error.message}`);
  }

  return mapDocument(data);
}

/**
 * List knowledge documents for a business.
 * If agentId is provided, returns docs for that agent + global docs.
 * If agentId is 'global', returns only global docs (agent_id IS NULL).
 * If agentId is omitted, returns all docs for the business.
 */
export async function listDocuments(
  supabase: SupabaseClient,
  businessId: string,
  agentId?: string | "global"
): Promise<KnowledgeDocument[]> {
  let query = supabase
    .from("knowledge_documents")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (agentId === "global") {
    query = query.is("agent_id", null);
  } else if (agentId) {
    query = query.or(`agent_id.eq.${agentId},agent_id.is.null`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list knowledge documents: ${error.message}`);
  }

  return (data ?? []).map(mapDocument);
}

/**
 * Delete a knowledge document and its chunks (CASCADE).
 * Also removes the file from Supabase Storage if storage_path exists.
 */
export async function deleteDocument(
  supabase: SupabaseClient,
  documentId: string
): Promise<boolean> {
  // Fetch document to get storage_path before deletion
  const { data: doc } = await supabase
    .from("knowledge_documents")
    .select("storage_path")
    .eq("id", documentId)
    .single();

  // Delete from storage if path exists
  if (doc?.storage_path) {
    await supabase.storage
      .from("knowledge")
      .remove([doc.storage_path]);
  }

  const { error } = await supabase
    .from("knowledge_documents")
    .delete()
    .eq("id", documentId);

  if (error) {
    throw new Error(`Failed to delete knowledge document: ${error.message}`);
  }

  return true;
}

/**
 * Update a document's status and optional fields.
 */
export async function updateDocumentStatus(
  supabase: SupabaseClient,
  documentId: string,
  status: KnowledgeDocument["status"],
  errorMessage?: string,
  chunkCount?: number
): Promise<void> {
  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (errorMessage !== undefined) {
    update.error_message = errorMessage;
  }

  if (chunkCount !== undefined) {
    update.chunk_count = chunkCount;
  }

  const { error } = await supabase
    .from("knowledge_documents")
    .update(update)
    .eq("id", documentId);

  if (error) {
    throw new Error(
      `Failed to update document status: ${error.message}`
    );
  }
}

/**
 * Get chunks for a document (without embedding vectors for efficiency).
 */
export async function getDocumentChunks(
  supabase: SupabaseClient,
  documentId: string
): Promise<KnowledgeChunk[]> {
  const { data, error } = await supabase
    .from("knowledge_chunks")
    .select(
      "id, document_id, business_id, agent_id, chunk_index, content, token_count, created_at"
    )
    .eq("document_id", documentId)
    .order("chunk_index", { ascending: true });

  if (error) {
    throw new Error(`Failed to get document chunks: ${error.message}`);
  }

  return (data ?? []).map(mapChunk);
}

/**
 * Process a document: extract text, chunk, embed, and store.
 *
 * Pipeline:
 * 1. Update status to 'processing'
 * 2. Extract text from file buffer
 * 3. Split into chunks
 * 4. Generate embeddings for all chunks
 * 5. Insert chunks with embeddings into knowledge_chunks
 * 6. Update document status to 'ready' with chunk count
 *
 * On failure: sets document status to 'failed' with error message.
 */
export async function processDocument(
  supabase: SupabaseClient,
  documentId: string,
  fileBuffer: Buffer,
  fileType: KnowledgeFileType
): Promise<{ success: boolean; chunkCount?: number; error?: string }> {
  try {
    // Update status to processing
    await updateDocumentStatus(supabase, documentId, "processing");

    // Extract text
    const text = await extractText(fileBuffer, fileType);

    // Split into chunks
    const chunks = chunkText(text);

    if (chunks.length === 0) {
      await updateDocumentStatus(
        supabase,
        documentId,
        "failed",
        "Document produced no text chunks after extraction"
      );
      return { success: false, error: "No text chunks produced" };
    }

    // Generate embeddings for all chunks
    const embeddings = await generateEmbeddings(
      chunks.map((c) => c.content)
    );

    // Fetch document to get business_id and agent_id
    const { data: doc, error: fetchError } = await supabase
      .from("knowledge_documents")
      .select("business_id, agent_id")
      .eq("id", documentId)
      .single();

    if (fetchError || !doc) {
      throw new Error("Document not found after processing started");
    }

    // Insert chunks with embeddings
    const chunkRows = chunks.map((chunk, i) => ({
      document_id: documentId,
      business_id: doc.business_id,
      agent_id: doc.agent_id,
      chunk_index: chunk.index,
      content: chunk.content,
      embedding: JSON.stringify(embeddings[i]),
      token_count: chunk.tokenCount,
    }));

    const { error: insertError } = await supabase
      .from("knowledge_chunks")
      .insert(chunkRows);

    if (insertError) {
      throw new Error(`Failed to insert chunks: ${insertError.message}`);
    }

    // Update document status to ready
    await updateDocumentStatus(
      supabase,
      documentId,
      "ready",
      undefined,
      chunks.length
    );

    return { success: true, chunkCount: chunks.length };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown processing error";

    // Update document status to failed
    try {
      await updateDocumentStatus(supabase, documentId, "failed", message);
    } catch {
      // Best-effort status update
      console.error("Failed to update document status to failed:", message);
    }

    return { success: false, error: message };
  }
}

/**
 * Re-index a document by downloading from storage and re-processing.
 * Deletes existing chunks first, then re-runs the processing pipeline.
 */
export async function reIndexDocument(
  supabase: SupabaseClient,
  documentId: string
): Promise<{ success: boolean; chunkCount?: number; error?: string }> {
  // Fetch document metadata
  const { data: doc, error: fetchError } = await supabase
    .from("knowledge_documents")
    .select("storage_path, file_type")
    .eq("id", documentId)
    .single();

  if (fetchError || !doc) {
    return { success: false, error: "Document not found" };
  }

  if (!doc.storage_path) {
    return {
      success: false,
      error: "Document has no storage path for re-indexing",
    };
  }

  // Download file from Supabase Storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from("knowledge")
    .download(doc.storage_path);

  if (downloadError || !fileData) {
    return {
      success: false,
      error: `Failed to download file: ${downloadError?.message ?? "No data"}`,
    };
  }

  // Delete existing chunks
  await supabase
    .from("knowledge_chunks")
    .delete()
    .eq("document_id", documentId);

  // Convert Blob to Buffer
  const arrayBuffer = await fileData.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Re-process
  return processDocument(
    supabase,
    documentId,
    buffer,
    doc.file_type as KnowledgeFileType
  );
}
