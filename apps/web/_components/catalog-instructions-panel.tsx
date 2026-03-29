"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, AlertTriangle } from "lucide-react";

interface CatalogInstructionsPanelProps {
  integrationId: string;
  businessId: string;
  integrationName: string;
  integrationCategory: string;
  provider: string;
  targetName: string;
  targetType: string;
  existingInstructions?: string;
  onGenerated?: (instructions: string) => void;
}

/**
 * Instructions display panel with streaming consumption via fetch + ReadableStream.
 * Tokens render progressively as they arrive (typewriter effect).
 * Shows stored instructions immediately when available.
 */
export function CatalogInstructionsPanel({
  integrationId,
  businessId,
  integrationName,
  integrationCategory,
  provider,
  targetName,
  targetType,
  existingInstructions,
  onGenerated,
}: CatalogInstructionsPanelProps) {
  const [instructions, setInstructions] = useState(existingInstructions ?? "");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startStreaming = useCallback(async () => {
    setIsStreaming(true);
    setInstructions("");
    setError(null);

    try {
      const response = await fetch("/api/integrations/instructions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integrationId,
          businessId,
          integrationName,
          integrationCategory,
          provider,
          targetName,
          targetType,
        }),
      });

      if (!response.ok) throw new Error("Failed to generate instructions");

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        setInstructions(accumulated);
      }

      onGenerated?.(accumulated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsStreaming(false);
    }
  }, [
    integrationId,
    businessId,
    integrationName,
    integrationCategory,
    provider,
    targetName,
    targetType,
    onGenerated,
  ]);

  // Auto-start streaming on mount if no existing instructions
  useEffect(() => {
    if (!existingInstructions) {
      startStreaming();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Error state
  if (error) {
    return (
      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-center gap-2 text-sm text-amber-600">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={startStreaming}
        >
          Try Again
        </Button>
      </div>
    );
  }

  // Initial loading (before first tokens arrive)
  if (isStreaming && !instructions) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        <span>Generating setup instructions...</span>
      </div>
    );
  }

  // Streaming or complete with content
  if (instructions) {
    return (
      <div className="space-y-2">
        {!isStreaming && (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs text-muted-foreground"
              onClick={startStreaming}
            >
              <RefreshCw className="size-3" />
              Regenerate
            </Button>
          </div>
        )}
        <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {instructions}
          {isStreaming && (
            <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-foreground/60" />
          )}
        </div>
      </div>
    );
  }

  return null;
}
