"use client";

/**
 * Drag-and-drop upload zone with paste text support.
 * Stub -- full implementation in Task 2.
 */
export function KnowledgeUploadZone({
  businessId,
  agentId,
  onUploadComplete,
}: {
  businessId: string;
  agentId: string | null;
  onUploadComplete?: () => void;
}) {
  return (
    <div className="rounded-lg border-2 border-dashed p-8 text-center text-sm text-muted-foreground">
      Drag &amp; drop files here (stub)
    </div>
  );
}
