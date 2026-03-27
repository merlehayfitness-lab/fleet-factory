"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  MoreHorizontal,
  Eye,
  RefreshCw,
  Trash2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import type { KnowledgeDocument } from "@agency-factory/core";
import {
  listDocumentsAction,
  deleteDocumentAction,
  reIndexDocumentAction,
} from "@/_actions/knowledge-actions";
import { KnowledgeChunkPreview } from "@/_components/knowledge-chunk-preview";

interface KnowledgeDocumentListProps {
  initialDocuments: KnowledgeDocument[];
  businessId: string;
  scope: "global" | "agent";
  agentId?: string;
}

function statusBadgeClass(status: KnowledgeDocument["status"]): string {
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

function fileTypeBadge(fileType: string): string {
  const labels: Record<string, string> = {
    text: "TXT",
    markdown: "MD",
    pdf: "PDF",
    docx: "DOCX",
    xlsx: "XLSX",
  };
  return labels[fileType] ?? fileType.toUpperCase();
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  return new Date(dateStr).toLocaleDateString();
}

/**
 * Document table with status badges, actions, and polling for processing status.
 */
export function KnowledgeDocumentList({
  initialDocuments,
  businessId,
  scope,
  agentId,
}: KnowledgeDocumentListProps) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeDocument | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reindexingId, setReindexingId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshDocuments = useCallback(async () => {
    const scopeArg = scope === "global" ? "global" : agentId;
    const result = await listDocumentsAction(businessId, scopeArg);
    if ("documents" in result) {
      setDocuments(result.documents);
    }
  }, [businessId, scope, agentId]);

  // Poll for status updates when documents are in processing state
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

  // Update documents when initialDocuments changes (e.g., from parent refresh)
  useEffect(() => {
    setDocuments(initialDocuments);
  }, [initialDocuments]);

  // Expose refresh for parent components
  useEffect(() => {
    // Re-fetch when parent triggers onUploadComplete
    // This is handled through initialDocuments prop changes
  }, []);

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);

    const result = await deleteDocumentAction(deleteTarget.id, businessId);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Document deleted");
      setDocuments((prev) => prev.filter((d) => d.id !== deleteTarget.id));
    }

    setIsDeleting(false);
    setDeleteTarget(null);
  }

  async function handleReIndex(doc: KnowledgeDocument) {
    setReindexingId(doc.id);

    const result = await reIndexDocumentAction(doc.id, businessId);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success(`Re-indexed with ${result.chunkCount} chunks`);
      void refreshDocuments();
    }

    setReindexingId(null);
  }

  if (documents.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No documents yet. Upload files or paste text above.
        </p>
      </div>
    );
  }

  return (
    <>
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Chunks</TableHead>
            <TableHead>Uploaded</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              isExpanded={expandedDocId === doc.id}
              onToggleExpand={() =>
                setExpandedDocId(expandedDocId === doc.id ? null : doc.id)
              }
              onDelete={() => setDeleteTarget(doc)}
              onReIndex={() => void handleReIndex(doc)}
              isReindexing={reindexingId === doc.id}
            />
          ))}
        </TableBody>
      </Table>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.title}&quot;?
              This will also delete all associated chunks and embeddings.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDelete()}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DocumentRow({
  doc,
  isExpanded,
  onToggleExpand,
  onDelete,
  onReIndex,
  isReindexing,
}: {
  doc: KnowledgeDocument;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onDelete: () => void;
  onReIndex: () => void;
  isReindexing: boolean;
}) {
  return (
    <>
      <TableRow>
        <TableCell className="font-medium">
          <div className="flex flex-col gap-0.5">
            <span>{doc.title}</span>
            {doc.status === "failed" && doc.errorMessage && (
              <span className="flex items-center gap-1 text-xs text-red-500">
                <AlertCircle className="size-3" />
                {doc.errorMessage}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="secondary" className="text-xs">
            {fileTypeBadge(doc.fileType)}
          </Badge>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className={statusBadgeClass(doc.status)}>
            {doc.status}
          </Badge>
        </TableCell>
        <TableCell>
          {doc.status === "ready" ? doc.chunkCount : "--"}
        </TableCell>
        <TableCell className="text-muted-foreground">
          {relativeTime(doc.createdAt)}
        </TableCell>
        <TableCell>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground">
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {doc.status === "ready" && (
                <DropdownMenuItem onClick={onToggleExpand}>
                  <Eye className="size-4" />
                  {isExpanded ? "Hide Chunks" : "View Chunks"}
                </DropdownMenuItem>
              )}
              {doc.status === "failed" ? (
                <DropdownMenuItem
                  onClick={onReIndex}
                  disabled={isReindexing}
                >
                  {isReindexing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  Retry
                </DropdownMenuItem>
              ) : doc.status === "ready" ? (
                <DropdownMenuItem
                  onClick={onReIndex}
                  disabled={isReindexing}
                >
                  {isReindexing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  Re-index
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>

      {/* Expandable chunk preview */}
      {isExpanded && doc.status === "ready" && (
        <TableRow>
          <TableCell colSpan={6} className="max-w-0 bg-muted/30 p-0">
            <KnowledgeChunkPreview
              documentId={doc.id}
              isExpanded={isExpanded}
            />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
