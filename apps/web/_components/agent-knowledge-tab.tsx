"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { BookOpen, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { KnowledgeUploadZone } from "@/_components/knowledge-upload-zone";
import { KnowledgeDocumentList } from "@/_components/knowledge-document-list";
import { listDocumentsAction } from "@/_actions/knowledge-actions";
import type { KnowledgeDocument } from "@agency-factory/core";

interface AgentKnowledgeTabProps {
  businessId: string;
  agentId: string;
  agentName: string;
}

/**
 * Agent-specific knowledge tab content.
 *
 * Shows agent-specific document upload zone and list,
 * with a section linking to the global Knowledge Base.
 */
export function AgentKnowledgeTab({
  businessId,
  agentId,
  agentName,
}: AgentKnowledgeTabProps) {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDocuments = useCallback(async () => {
    const result = await listDocumentsAction(businessId, agentId);
    if ("documents" in result) {
      // Filter to agent-specific only (exclude global docs with null agentId)
      setDocuments(result.documents.filter((d) => d.agentId === agentId));
    }
    setIsLoading(false);
  }, [businessId, agentId]);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  const handleUploadComplete = useCallback(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  return (
    <div className="space-y-6 pt-4">
      {/* Agent-specific knowledge section */}
      <div>
        <h3 className="text-lg font-semibold">Agent-Specific Knowledge</h3>
        <p className="text-sm text-muted-foreground">
          Documents uploaded here are only available to {agentName}.
        </p>
      </div>

      <KnowledgeUploadZone
        businessId={businessId}
        agentId={agentId}
        onUploadComplete={handleUploadComplete}
      />

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-md bg-muted"
            />
          ))}
        </div>
      ) : (
        <KnowledgeDocumentList
          initialDocuments={documents}
          businessId={businessId}
          scope="agent"
          agentId={agentId}
        />
      )}

      <Separator />

      {/* Inherited global knowledge section */}
      <div>
        <h3 className="text-lg font-semibold">Inherited Global Knowledge</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          All global business documents are automatically available to this
          agent.
        </p>
        <Link href={`/businesses/${businessId}/knowledge`}>
          <Button variant="outline" size="sm">
            <BookOpen className="mr-1.5 size-3.5" />
            View Global Knowledge Base
            <ExternalLink className="ml-1.5 size-3" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
