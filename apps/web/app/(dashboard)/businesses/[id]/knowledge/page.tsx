import { notFound } from "next/navigation";
import { createServerClient } from "@/_lib/supabase/server";
import { listDocuments } from "@agency-factory/core/server";
import { KnowledgeUploadZone } from "@/_components/knowledge-upload-zone";
import { KnowledgeDocumentList } from "@/_components/knowledge-document-list";

/**
 * Global Knowledge Base page.
 *
 * Shows a file-manager-style interface for uploading and managing
 * business-wide documents. Global documents are automatically
 * inherited by every agent in the business.
 */
export default async function KnowledgePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  // Fetch business details
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("id", id)
    .single();

  if (businessError || !business) {
    notFound();
  }

  // Fetch global documents (gracefully handle missing table before schema is applied)
  let globalDocs: Awaited<ReturnType<typeof listDocuments>> = [];
  try {
    globalDocs = await listDocuments(supabase, id, "global");
  } catch {
    // Table may not exist yet — show empty state
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Knowledge Base</h1>
        <p className="text-sm text-muted-foreground">
          Upload documents to make all agents in {business.name as string}{" "}
          smarter. Global documents are automatically inherited by every agent.
        </p>
      </div>

      {/* Upload zone */}
      <KnowledgeUploadZone
        businessId={business.id as string}
        agentId={null}
      />

      {/* Document list */}
      <KnowledgeDocumentList
        initialDocuments={globalDocs}
        businessId={business.id as string}
        scope="global"
      />
    </div>
  );
}
