"use client";

import type { KnowledgeDocument } from "@agency-factory/core";

/**
 * Document table with status badges and actions.
 * Stub -- full implementation in Task 2.
 */
export function KnowledgeDocumentList({
  initialDocuments,
  businessId,
  scope,
}: {
  initialDocuments: KnowledgeDocument[];
  businessId: string;
  scope: "global" | "agent";
}) {
  return (
    <div className="text-sm text-muted-foreground">
      {initialDocuments.length === 0
        ? "No documents yet."
        : `${initialDocuments.length} documents (stub)`}
    </div>
  );
}
