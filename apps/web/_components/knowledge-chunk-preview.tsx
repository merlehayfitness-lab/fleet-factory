"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { getDocumentChunksAction } from "@/_actions/knowledge-actions";
import type { KnowledgeChunk } from "@agency-factory/core";

interface KnowledgeChunkPreviewProps {
  documentId: string;
  isExpanded: boolean;
}

/**
 * Expandable chunk detail for a document.
 *
 * Fetches chunks on expand and displays them as numbered cards
 * with truncated text preview (~300 chars) and token count badge.
 */
export function KnowledgeChunkPreview({
  documentId,
  isExpanded,
}: KnowledgeChunkPreviewProps) {
  const [chunks, setChunks] = useState<KnowledgeChunk[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isExpanded) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getDocumentChunksAction(documentId).then((result) => {
      if (cancelled) return;

      if ("error" in result) {
        setError(result.error);
      } else {
        setChunks(result.chunks);
      }
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [documentId, isExpanded]);

  if (!isExpanded) return null;

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-md bg-muted"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-500">
        Failed to load chunks: {error}
      </div>
    );
  }

  if (chunks.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No chunks found for this document.
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden space-y-2 p-4">
      <p className="mb-3 text-xs font-medium text-muted-foreground">
        {chunks.length} chunk{chunks.length !== 1 ? "s" : ""}
      </p>
      {chunks.map((chunk) => (
        <div
          key={chunk.id}
          className="overflow-hidden rounded-md border bg-background p-3"
        >
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Chunk {chunk.chunkIndex + 1}
            </span>
            {chunk.tokenCount != null && (
              <Badge variant="secondary" className="text-xs">
                {chunk.tokenCount} tokens
              </Badge>
            )}
          </div>
          <p className="whitespace-pre-wrap break-all text-xs leading-relaxed text-muted-foreground">
            {chunk.content.length > 300
              ? `${chunk.content.slice(0, 300)}...`
              : chunk.content}
          </p>
        </div>
      ))}
    </div>
  );
}
