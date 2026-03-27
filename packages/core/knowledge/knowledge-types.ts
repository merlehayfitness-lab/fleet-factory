/** Document status in the processing pipeline */
export type DocumentStatus = "uploading" | "processing" | "ready" | "failed";

/** Supported file types for knowledge documents */
export type KnowledgeFileType = "text" | "markdown" | "pdf" | "docx" | "xlsx";

/** Knowledge document metadata */
export interface KnowledgeDocument {
  id: string;
  businessId: string;
  agentId: string | null; // null = global (business-wide)
  title: string;
  filename: string | null;
  fileType: KnowledgeFileType;
  fileSizeBytes: number | null;
  storagePath: string | null;
  status: DocumentStatus;
  errorMessage: string | null;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}

/** A text chunk with embedding */
export interface KnowledgeChunk {
  id: string;
  documentId: string;
  businessId: string;
  agentId: string | null;
  chunkIndex: number;
  content: string;
  tokenCount: number | null;
  createdAt: string;
}

/** Source attribution for a retrieved chunk */
export interface KnowledgeSource {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  chunkPreview: string; // first ~200 chars of chunk
  similarity: number;
}

/** Result of a knowledge retrieval operation */
export interface RetrievedContext {
  contextString: string; // formatted for prompt injection
  sources: KnowledgeSource[]; // for UI source footnotes
  retrievalTimeMs: number;
}

/** Chunk output from the text splitter */
export interface TextChunk {
  content: string;
  index: number;
  tokenCount: number;
}
