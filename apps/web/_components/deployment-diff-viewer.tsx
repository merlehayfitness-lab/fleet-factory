"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, FileCode } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface OptimizationChange {
  file: string;
  description: string;
}

interface OptimizationReport {
  changes: OptimizationChange[];
  summary: string;
}

interface DeploymentDiffViewerProps {
  optimizationReport: OptimizationReport | null;
}

/**
 * Displays Claude Code's optimization changes from a deployment.
 *
 * Shows a summary and collapsible list of per-file changes with
 * descriptions of what was optimized.
 */
export function DeploymentDiffViewer({ optimizationReport }: DeploymentDiffViewerProps) {
  const [expandedFiles, setExpandedFiles] = useState<Set<number>>(new Set());

  if (!optimizationReport) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6 text-sm text-muted-foreground">
          No optimization report available
        </CardContent>
      </Card>
    );
  }

  const toggleFile = (idx: number) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Claude Code Optimization Report</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Summary */}
        <div className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          {optimizationReport.summary}
        </div>

        {/* Changes list */}
        {optimizationReport.changes.length > 0 ? (
          <div className="divide-y rounded-md border">
            {optimizationReport.changes.map((change, idx) => {
              const isExpanded = expandedFiles.has(idx);

              return (
                <div key={idx}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50"
                    onClick={() => toggleFile(idx)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <FileCode className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 font-mono text-xs">{change.file}</span>
                  </button>

                  {isExpanded && (
                    <div className="border-t bg-muted/30 px-4 py-3">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {change.description}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No file changes in this optimization pass.
          </p>
        )}

        {/* Summary stats */}
        <p className="text-xs text-muted-foreground">
          {optimizationReport.changes.length} file{optimizationReport.changes.length !== 1 ? "s" : ""} modified
        </p>
      </CardContent>
    </Card>
  );
}
