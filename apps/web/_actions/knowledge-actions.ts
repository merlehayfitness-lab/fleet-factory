"use server";

import { createServerClient } from "@/_lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createDocument,
  listDocuments,
  deleteDocument,
  getDocumentChunks,
  processDocument,
  reIndexDocument,
} from "@agency-factory/core/server";
import type {
  KnowledgeDocument,
  KnowledgeChunk,
  KnowledgeFileType,
} from "@agency-factory/core";
import { randomUUID } from "node:crypto";

/** Allowed file extensions and their corresponding KnowledgeFileType */
const FILE_TYPE_MAP: Record<string, KnowledgeFileType> = {
  txt: "text",
  md: "markdown",
  pdf: "pdf",
  docx: "docx",
  xlsx: "xlsx",
};

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

/**
 * Upload a document file via FormData.
 * Returns the document record immediately with status='uploading'.
 * The client is responsible for calling triggerProcessingAction after this returns.
 */
export async function uploadDocumentAction(
  formData: FormData,
): Promise<{ document: KnowledgeDocument } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const businessId = formData.get("businessId") as string;
  const agentId = (formData.get("agentId") as string) || null;
  const file = formData.get("file") as File | null;

  if (!businessId) {
    return { error: "Business ID is required" };
  }

  if (!file || !(file instanceof File)) {
    return { error: "File is required" };
  }

  // Validate file type
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const fileType = FILE_TYPE_MAP[ext];
  if (!fileType) {
    return {
      error: `Unsupported file type: .${ext}. Allowed: .txt, .md, .pdf, .docx, .xlsx`,
    };
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return { error: "File size exceeds 25MB limit" };
  }

  try {
    const docId = randomUUID();
    const storagePath = `${businessId}/${docId}/${file.name}`;

    // Upload file to Supabase Storage
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from("knowledge-docs")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return { error: `Storage upload failed: ${uploadError.message}` };
    }

    // Create document record with status='uploading'
    const document = await createDocument(
      supabase,
      businessId,
      agentId,
      file.name,
      file.name,
      fileType,
      file.size,
      storagePath,
    );

    return { document };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to upload document",
    };
  }
}

/**
 * Trigger async processing for a document (extract + chunk + embed).
 * This is the long-running operation. The client fires this as fire-and-forget,
 * then polls via listDocumentsAction to observe status transitions.
 */
export async function triggerProcessingAction(
  documentId: string,
): Promise<{ success: true; chunkCount: number } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  try {
    // Fetch the document record to get storage_path, file_type, business_id
    const { data: doc, error: fetchError } = await supabase
      .from("knowledge_documents")
      .select("id, storage_path, file_type, business_id")
      .eq("id", documentId)
      .single();

    if (fetchError || !doc) {
      return { error: "Document not found" };
    }

    let fileBuffer: Buffer;

    if (doc.storage_path) {
      // Download file from Supabase Storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("knowledge-docs")
        .download(doc.storage_path as string);

      if (downloadError || !fileData) {
        return {
          error: `Failed to download file: ${downloadError?.message ?? "No data"}`,
        };
      }

      const arrayBuffer = await fileData.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
    } else {
      // For pasted text, the content is stored as the title (handled in pasteTextAction)
      // The document was created with fileType='text' and no storage path
      // We need to get the content from a different source
      // For paste-text docs, we store the content in error_message field temporarily
      // Actually, let's use a dedicated approach: fetch from metadata
      return { error: "Document has no storage path" };
    }

    const result = await processDocument(
      supabase,
      documentId,
      fileBuffer,
      doc.file_type as KnowledgeFileType,
    );

    if (!result.success) {
      return { error: result.error ?? "Processing failed" };
    }

    revalidatePath(`/businesses/${doc.business_id}`);
    return { success: true, chunkCount: result.chunkCount ?? 0 };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to process document",
    };
  }
}

/**
 * Create a document from pasted text content.
 * Returns the document record immediately with status='uploading'.
 * The client is responsible for calling triggerProcessingAction after this returns.
 */
export async function pasteTextAction(
  businessId: string,
  agentId: string | null,
  title: string,
  content: string,
): Promise<{ document: KnowledgeDocument } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  if (!title.trim()) {
    return { error: "Title is required" };
  }

  if (!content.trim()) {
    return { error: "Content is required" };
  }

  try {
    const docId = randomUUID();
    const storagePath = `${businessId}/${docId}/${title.replace(/[^a-zA-Z0-9-_]/g, "_")}.txt`;

    // Store pasted text as a file in storage so triggerProcessingAction can download it
    const buffer = Buffer.from(content, "utf-8");
    const { error: uploadError } = await supabase.storage
      .from("knowledge-docs")
      .upload(storagePath, buffer, {
        contentType: "text/plain",
        upsert: false,
      });

    if (uploadError) {
      return { error: `Storage upload failed: ${uploadError.message}` };
    }

    const document = await createDocument(
      supabase,
      businessId,
      agentId,
      title,
      null,
      "text",
      content.length,
      storagePath,
    );

    return { document };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to create text document",
    };
  }
}

/**
 * Delete a knowledge document and its chunks.
 */
export async function deleteDocumentAction(
  documentId: string,
  businessId: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    await deleteDocument(supabase, documentId);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to delete document",
    };
  }

  revalidatePath(`/businesses/${businessId}/knowledge`);
  return { success: true };
}

/**
 * Re-index a document (re-download, re-extract, re-chunk, re-embed).
 */
export async function reIndexDocumentAction(
  documentId: string,
  businessId: string,
): Promise<{ success: true; chunkCount: number } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const result = await reIndexDocument(supabase, documentId);

    if (!result.success) {
      return { error: result.error ?? "Re-indexing failed" };
    }

    revalidatePath(`/businesses/${businessId}/knowledge`);
    return { success: true, chunkCount: result.chunkCount ?? 0 };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to re-index document",
    };
  }
}

/**
 * List knowledge documents for a business.
 * If agentId is provided, returns agent-specific docs only.
 * If agentId is 'global', returns only global docs.
 */
export async function listDocumentsAction(
  businessId: string,
  agentId?: string | "global",
): Promise<{ documents: KnowledgeDocument[] } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  try {
    const documents = await listDocuments(supabase, businessId, agentId);
    return { documents };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to list documents",
    };
  }
}

/**
 * Get chunks for a specific document.
 */
export async function getDocumentChunksAction(
  documentId: string,
): Promise<{ chunks: KnowledgeChunk[] } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  try {
    const chunks = await getDocumentChunks(supabase, documentId);
    return { chunks };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to get document chunks",
    };
  }
}
