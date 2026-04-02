"use client";

import { useState } from "react";
import { toast } from "sonner";
import { GitBranch, Loader2, FileText, FolderOpen, Folder } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  previewGitHubUrlAction,
  importFromGitHubAction,
} from "@/_actions/skill-actions";
import type { GitHubImportResult } from "@fleet-factory/core";

interface GitHubImportDialogProps {
  businessId: string;
  agentId?: string;
  onImported?: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type PreviewState =
  | { type: "idle" }
  | { type: "checking" }
  | { type: "file"; preview: GitHubImportResult }
  | { type: "directory"; files: string[]; repoName: string }
  | { type: "error"; message: string };

/**
 * Dialog for importing skills from a public GitHub repository.
 * Accepts URL, detects file vs directory, shows preview, then imports.
 */
export function GitHubImportDialog({
  businessId,
  agentId,
  onImported,
  open,
  onOpenChange,
}: GitHubImportDialogProps) {
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<PreviewState>({ type: "idle" });
  const [importing, setImporting] = useState(false);

  function handleClose() {
    setUrl("");
    setPreview({ type: "idle" });
    setImporting(false);
    onOpenChange(false);
  }

  async function handleCheck() {
    if (!url.trim()) {
      toast.error("Please enter a GitHub URL");
      return;
    }

    setPreview({ type: "checking" });

    const result = await previewGitHubUrlAction(url.trim());

    if ("error" in result) {
      setPreview({ type: "error", message: result.error });
      return;
    }

    if (result.type === "file") {
      setPreview({ type: "file", preview: result.preview });
    } else {
      setPreview({ type: "directory", files: result.files, repoName: result.repoName });
    }
  }

  async function handleImport() {
    setImporting(true);

    const result = await importFromGitHubAction(businessId, url.trim(), agentId);

    if ("error" in result) {
      toast.error(result.error);
      setImporting(false);
      return;
    }

    const count = result.skills.length;
    toast.success(`Imported ${count} skill${count === 1 ? "" : "s"} from GitHub`);
    onImported?.();
    handleClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="size-5" />
            Import from GitHub
          </DialogTitle>
          <DialogDescription>
            Import skill files from a public GitHub repository.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* URL input */}
          <div className="flex gap-2">
            <Input
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (preview.type !== "idle") setPreview({ type: "idle" });
              }}
              placeholder="https://github.com/owner/repo/blob/main/skills/my-skill.md"
              className="flex-1"
              disabled={importing}
            />
            <Button
              variant="outline"
              onClick={handleCheck}
              disabled={!url.trim() || preview.type === "checking" || importing}
            >
              {preview.type === "checking" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Check URL"
              )}
            </Button>
          </div>

          {/* Preview results */}
          {preview.type === "error" && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{preview.message}</p>
            </div>
          )}

          {preview.type === "file" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">{preview.preview.name}</span>
                <span className="text-xs text-muted-foreground">Single file</span>
              </div>
              <pre className="max-h-[200px] overflow-auto rounded-md border bg-muted/50 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                {preview.preview.content}
              </pre>
            </div>
          )}

          {preview.type === "directory" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FolderOpen className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  Importing from {preview.repoName}
                </span>
                <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
                  {preview.files.length} file{preview.files.length === 1 ? "" : "s"}
                </span>
              </div>
              <ul className="max-h-[200px] overflow-auto rounded-md border bg-muted/50 p-3 space-y-0.5">
                {(() => {
                  // Group files by directory for tree display
                  const dirs = new Set<string>();
                  const rendered: Array<{ key: string; dir?: string; file: string; depth: number }> = [];
                  for (const filePath of preview.files) {
                    const parts = filePath.split("/");
                    if (parts.length > 1) {
                      // Show each unique directory path
                      let dirPath = "";
                      for (let i = 0; i < parts.length - 1; i++) {
                        dirPath = dirPath ? dirPath + "/" + parts[i] : parts[i];
                        if (!dirs.has(dirPath)) {
                          dirs.add(dirPath);
                          rendered.push({ key: "dir-" + dirPath, dir: parts[i], depth: i, file: "" });
                        }
                      }
                      rendered.push({ key: filePath, file: parts[parts.length - 1], depth: parts.length - 1 });
                    } else {
                      rendered.push({ key: filePath, file: filePath, depth: 0 });
                    }
                  }

                  return rendered.map((item) => (
                    <li
                      key={item.key}
                      className="flex items-center gap-1.5 text-xs font-mono"
                      style={{ paddingLeft: `${item.depth * 16}px` }}
                    >
                      {item.dir ? (
                        <>
                          <Folder className="size-3 text-amber-500 shrink-0" />
                          <span className="text-muted-foreground">{item.dir}/</span>
                        </>
                      ) : (
                        <>
                          <FileText className="size-3 text-muted-foreground shrink-0" />
                          {item.file}
                        </>
                      )}
                    </li>
                  ));
                })()}
              </ul>
              <p className="text-xs text-muted-foreground">
                Skills will be grouped under &ldquo;{preview.repoName}&rdquo; collection in your library.
              </p>
            </div>
          )}

          {/* Info text */}
          <p className="text-xs text-muted-foreground">
            Public repositories only. Imported skills are added to your business library.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={importing}>
            Cancel
          </Button>
          {(preview.type === "file" || preview.type === "directory") && (
            <Button onClick={handleImport} disabled={importing}>
              {importing ? (
                <>
                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                  Importing...
                </>
              ) : preview.type === "file" ? (
                "Import"
              ) : (
                `Import All from ${preview.repoName} (${preview.files.length})`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
