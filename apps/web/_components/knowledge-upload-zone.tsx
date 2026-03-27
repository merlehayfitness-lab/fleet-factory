"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileText, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  uploadDocumentAction,
  triggerProcessingAction,
  pasteTextAction,
} from "@/_actions/knowledge-actions";
import { cn } from "@/lib/utils";

const ALLOWED_EXTENSIONS = ["txt", "md", "pdf", "docx", "xlsx"];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

interface KnowledgeUploadZoneProps {
  businessId: string;
  agentId: string | null;
  onUploadComplete?: () => void;
}

/**
 * Drag-and-drop upload zone with paste text support.
 *
 * Handles multi-file drag-and-drop, file input click, and paste-text input.
 * Uses two-phase upload: uploadDocumentAction returns immediately, then
 * triggerProcessingAction fires as fire-and-forget for async processing.
 */
export function KnowledgeUploadZone({
  businessId,
  agentId,
  onUploadComplete,
}: KnowledgeUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);
  const [showPasteText, setShowPasteText] = useState(false);
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteContent, setPasteContent] = useState("");
  const [isPasting, setIsPasting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function validateFile(file: File): string | null {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `Unsupported file type: .${ext}. Allowed: .txt, .md, .pdf, .docx, .xlsx`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File "${file.name}" exceeds 25MB limit`;
    }
    return null;
  }

  const processFiles = useCallback(
    async (files: File[]) => {
      // Validate all files first
      const errors: string[] = [];
      const validFiles: File[] = [];
      for (const file of files) {
        const error = validateFile(file);
        if (error) {
          errors.push(error);
        } else {
          validFiles.push(file);
        }
      }

      if (errors.length > 0) {
        for (const err of errors) {
          toast.error(err);
        }
      }

      if (validFiles.length === 0) return;

      setIsUploading(true);
      setUploadingFiles(validFiles.map((f) => f.name));

      for (const file of validFiles) {
        const formData = new FormData();
        formData.set("businessId", businessId);
        if (agentId) {
          formData.set("agentId", agentId);
        }
        formData.set("file", file);

        const result = await uploadDocumentAction(formData);

        if ("error" in result) {
          toast.error(`Failed to upload ${file.name}: ${result.error}`);
          continue;
        }

        // Trigger list refresh so document appears with 'uploading' status
        onUploadComplete?.();

        // Fire triggerProcessingAction as fire-and-forget
        triggerProcessingAction(result.document.id).then((processResult) => {
          if ("error" in processResult) {
            toast.error(
              `Processing failed for ${file.name}: ${processResult.error}`,
            );
          }
          // Polling in KnowledgeDocumentList will pick up status changes
          onUploadComplete?.();
        });

        toast.success(`"${file.name}" uploaded -- processing started`);
      }

      setIsUploading(false);
      setUploadingFiles([]);
    },
    [businessId, agentId, onUploadComplete],
  );

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      void processFiles(files);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      void processFiles(files);
    }
    // Reset input so the same file can be re-selected
    e.target.value = "";
  }

  async function handlePasteSubmit() {
    if (!pasteTitle.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!pasteContent.trim()) {
      toast.error("Content is required");
      return;
    }

    setIsPasting(true);

    const result = await pasteTextAction(
      businessId,
      agentId,
      pasteTitle.trim(),
      pasteContent.trim(),
    );

    if ("error" in result) {
      toast.error(result.error);
      setIsPasting(false);
      return;
    }

    // Trigger list refresh
    onUploadComplete?.();

    // Fire triggerProcessingAction as fire-and-forget
    triggerProcessingAction(result.document.id).then((processResult) => {
      if ("error" in processResult) {
        toast.error(`Processing failed: ${processResult.error}`);
      }
      onUploadComplete?.();
    });

    toast.success(`"${pasteTitle.trim()}" created -- processing started`);
    setPasteTitle("");
    setPasteContent("");
    setIsPasting(false);
  }

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50",
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".txt,.md,.pdf,.docx,.xlsx"
          onChange={handleFileChange}
          className="hidden"
        />

        {isUploading ? (
          <div className="space-y-2">
            <Loader2 className="mx-auto size-8 animate-spin text-muted-foreground" />
            <p className="text-sm font-medium">Uploading...</p>
            <div className="space-y-1">
              {uploadingFiles.map((name) => (
                <p
                  key={name}
                  className="text-xs text-muted-foreground"
                >
                  {name}
                </p>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="mx-auto size-8 text-muted-foreground" />
            <p className="text-sm font-medium">
              Drag &amp; drop files here
            </p>
            <p className="text-xs text-muted-foreground">
              or click to browse
            </p>
            <p className="text-xs text-muted-foreground">
              .txt, .md, .pdf, .docx, .xlsx (max 25MB)
            </p>
          </div>
        )}
      </div>

      {/* Paste text section */}
      <div>
        <button
          type="button"
          onClick={() => setShowPasteText(!showPasteText)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <FileText className="size-3.5" />
          Or paste text
          {showPasteText ? (
            <ChevronUp className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
        </button>

        {showPasteText && (
          <div className="mt-3 space-y-3 rounded-lg border p-4">
            <Input
              placeholder="Document title"
              value={pasteTitle}
              onChange={(e) => setPasteTitle(e.target.value)}
            />
            <Textarea
              placeholder="Paste text content here..."
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              rows={6}
            />
            <Button
              size="sm"
              onClick={() => void handlePasteSubmit()}
              disabled={isPasting || !pasteTitle.trim() || !pasteContent.trim()}
            >
              {isPasting && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Add Text
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
