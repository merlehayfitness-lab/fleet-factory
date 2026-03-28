"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { KnowledgeUploadZone } from "@/_components/knowledge-upload-zone";
import { listDocumentsAction } from "@/_actions/knowledge-actions";

interface KnowledgeDoc {
  id: string;
  title: string;
  status: string;
}

interface WizardKnowledgeStepProps {
  businessId: string;
  provisionalAgentId: string | null;
  onDocsChange: (docs: KnowledgeDoc[]) => void;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "uploading":
      return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    case "processing":
      return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    case "ready":
      return "bg-green-500/10 text-green-600 border-green-500/20";
    case "failed":
      return "bg-red-500/10 text-red-600 border-red-500/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

/**
 * Wizard Step 2: Knowledge Upload.
 *
 * Reuses KnowledgeUploadZone from Phase 7 scoped to the provisional agent.
 * Shows document list with status badges and polls while processing.
 * Parent wizard disables Next button while docs are uploading/processing.
 */
export function WizardKnowledgeStep({
  businessId,
  provisionalAgentId,
  onDocsChange,
}: WizardKnowledgeStepProps) {
  const [documents, setDocuments] = useState<KnowledgeDoc[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshDocuments = useCallback(async () => {
    if (!provisionalAgentId) return;

    const result = await listDocumentsAction(businessId, provisionalAgentId);
    if ("documents" in result) {
      const docs: KnowledgeDoc[] = result.documents.map((d) => ({
        id: d.id,
        title: d.title,
        status: d.status,
      }));
      setDocuments(docs);
      onDocsChange(docs);
    }
  }, [businessId, provisionalAgentId, onDocsChange]);

  // Poll for processing status changes
  useEffect(() => {
    const hasProcessing = documents.some(
      (d) => d.status === "uploading" || d.status === "processing",
    );

    if (hasProcessing && !pollRef.current) {
      pollRef.current = setInterval(() => {
        void refreshDocuments();
      }, 5000);
    } else if (!hasProcessing && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [documents, refreshDocuments]);

  // Initial document fetch
  useEffect(() => {
    void refreshDocuments();
  }, [refreshDocuments]);

  if (!provisionalAgentId) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Setting up agent...
        </span>
      </div>
    );
  }

  const hasProcessing = documents.some(
    (d) => d.status === "uploading" || d.status === "processing",
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Knowledge Documents</h2>
        <p className="text-sm text-muted-foreground">
          Upload documents the agent can reference. You can skip this step and
          add documents later.
        </p>
      </div>

      <KnowledgeUploadZone
        businessId={businessId}
        agentId={provisionalAgentId}
        onUploadComplete={() => void refreshDocuments()}
      />

      {/* Document list */}
      {documents.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Uploaded Documents</h3>
          <div className="divide-y rounded-lg border">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <span className="text-sm">{doc.title}</span>
                <Badge variant="outline" className={statusBadgeClass(doc.status)}>
                  {doc.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Processing indicator */}
      {hasProcessing && (
        <p className="flex items-center gap-2 text-sm text-amber-600">
          <Loader2 className="size-3.5 animate-spin" />
          Documents are being processed. You can continue once all documents are
          ready.
        </p>
      )}
    </div>
  );
}
