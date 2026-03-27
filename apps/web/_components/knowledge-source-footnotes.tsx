"use client";

import { useState } from "react";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface KnowledgeSource {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  chunkPreview: string;
  similarity: number;
}

interface KnowledgeSourceFootnotesProps {
  sources: KnowledgeSource[];
}

/**
 * Expandable source attribution section for chat messages.
 *
 * Renders below agent messages that used knowledge context.
 * Collapsed by default showing source count.
 * Expands to show document title, chunk preview, and similarity score per source.
 * Unobtrusive design: muted background, small text, collapsible.
 */
export function KnowledgeSourceFootnotes({
  sources,
}: KnowledgeSourceFootnotesProps) {
  const [expanded, setExpanded] = useState(false);

  if (sources.length === 0) return null;

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex items-center gap-1.5 text-[11px] text-muted-foreground/80 hover:text-muted-foreground transition-colors",
          "rounded-md px-2 py-1 hover:bg-muted/40",
        )}
      >
        <BookOpen className="size-3 shrink-0" />
        <span>Sources ({sources.length})</span>
        {expanded ? (
          <ChevronUp className="size-3" />
        ) : (
          <ChevronDown className="size-3" />
        )}
      </button>

      {expanded && (
        <div className="mt-1 space-y-1.5 rounded-md bg-muted/30 px-2.5 py-2">
          {sources.map((source) => (
            <div key={source.chunkId} className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-foreground/80">
                  {source.documentTitle}
                </span>
                <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                  {Math.round(source.similarity * 100)}% match
                </span>
              </div>
              <p className="text-[10px] leading-relaxed text-muted-foreground/70 line-clamp-2">
                &quot;{source.chunkPreview.slice(0, 150)}
                {source.chunkPreview.length > 150 ? "..." : ""}&quot;
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
