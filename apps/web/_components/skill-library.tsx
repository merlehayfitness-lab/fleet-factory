"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Plus, Layers, GitBranch, MoreVertical, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { SkillEditor } from "@/_components/skill-editor";
import { SkillUsageCard } from "@/_components/skill-usage-card";
import { SkillTemplateBrowser } from "@/_components/skill-template-browser";
import { GitHubImportDialog } from "@/_components/github-import-dialog";
import { deleteSkillAction, listSkillsForBusinessAction } from "@/_actions/skill-actions";
import type { Skill } from "@agency-factory/core";

interface SkillLibraryProps {
  businessId: string;
  initialSkills: Skill[];
}

const SOURCE_OPTIONS = ["All", "manual", "imported", "template"] as const;
const SOURCE_LABELS: Record<string, string> = {
  All: "All Sources",
  manual: "Manual",
  imported: "Imported",
  template: "Template",
};

const SOURCE_COLORS: Record<string, string> = {
  manual: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  imported: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  template: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
};

/**
 * Business skill library card grid with search, source filter, and CRUD actions.
 */
export function SkillLibrary({ businessId, initialSkills }: SkillLibraryProps) {
  const [skills, setSkills] = useState<Skill[]>(initialSkills);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [editorSkill, setEditorSkill] = useState<Skill | null | "new">(null);
  const [usageSkillId, setUsageSkillId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Skill | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [templateBrowserOpen, setTemplateBrowserOpen] = useState(false);
  const [githubImportOpen, setGithubImportOpen] = useState(false);

  const filtered = useMemo(() => {
    return skills.filter((s) => {
      if (sourceFilter !== "All" && s.source_type !== sourceFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!s.name.toLowerCase().includes(q) && !(s.description?.toLowerCase().includes(q))) {
          return false;
        }
      }
      return true;
    });
  }, [skills, search, sourceFilter]);

  async function refetchSkills() {
    const result = await listSkillsForBusinessAction(businessId);
    if ("skills" in result) {
      setSkills(result.skills);
    }
  }

  function handleEditorSave() {
    setEditorSkill(null);
    refetchSkills();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    const result = await deleteSkillAction(deleteTarget.id, businessId);

    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success(`"${deleteTarget.name}" deleted`);
      setSkills((prev) => prev.filter((s) => s.id !== deleteTarget.id));
    }

    setDeleting(false);
    setDeleteTarget(null);
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-semibold">Skill Library</h3>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setEditorSkill("new")}>
            <Plus className="mr-1 size-3.5" />
            New Skill
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setGithubImportOpen(true)}
          >
            <GitBranch className="mr-1 size-3.5" />
            Import from GitHub
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setTemplateBrowserOpen(true)}
          >
            <Layers className="mr-1 size-3.5" />
            Browse Templates
          </Button>
        </div>
      </div>

      {/* Filter/search bar */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search skills..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select
          value={sourceFilter}
          onValueChange={(v) => v && setSourceFilter(v)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SOURCE_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {SOURCE_LABELS[opt]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Card grid or empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {skills.length === 0
              ? "No skills yet. Create one, import from GitHub, or browse templates to get started."
              : "No skills match the current filters."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((skill) => (
            <div
              key={skill.id}
              className="flex flex-col rounded-lg border p-4 hover:bg-muted/30 transition-colors cursor-pointer"
              onClick={() => setEditorSkill(skill)}
            >
              <div className="flex items-start justify-between">
                <h4 className="font-semibold text-sm truncate flex-1">
                  {skill.name}
                </h4>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="inline-flex size-7 items-center justify-center rounded-md p-0 shrink-0 hover:bg-accent hover:text-accent-foreground"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="size-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        setUsageSkillId(skill.id);
                      }}
                    >
                      View Usage
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(skill);
                      }}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {skill.description && (
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                  {skill.description}
                </p>
              )}

              <div className="mt-2 flex flex-wrap gap-1.5">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    SOURCE_COLORS[skill.source_type] ?? ""
                  }`}
                >
                  {SOURCE_LABELS[skill.source_type] ?? skill.source_type}
                </span>
                <Badge variant="secondary" className="text-xs">
                  v{skill.version}
                </Badge>
              </div>

              {skill.trigger_phrases && skill.trigger_phrases.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {skill.trigger_phrases.slice(0, 3).map((phrase) => (
                    <span
                      key={phrase}
                      className="inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {phrase}
                    </span>
                  ))}
                  {skill.trigger_phrases.length > 3 && (
                    <span className="text-[10px] text-muted-foreground">
                      +{skill.trigger_phrases.length - 3} more
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Usage card (inline) */}
      {usageSkillId && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Skill Usage</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setUsageSkillId(null)}
            >
              Close
            </Button>
          </div>
          <SkillUsageCard skillId={usageSkillId} businessId={businessId} />
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Skill</DialogTitle>
            <DialogDescription>
              Delete <strong>{deleteTarget?.name}</strong>? This skill will be
              removed from the library. Agents with this skill assigned will
              keep their copy.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Skill editor dialog */}
      {editorSkill !== null && (
        <SkillEditor
          businessId={businessId}
          skill={editorSkill === "new" ? null : editorSkill}
          onSave={handleEditorSave}
          onClose={() => setEditorSkill(null)}
        />
      )}

      {/* Template browser */}
      <SkillTemplateBrowser
        businessId={businessId}
        onSkillAdded={() => {
          refetchSkills();
        }}
        open={templateBrowserOpen}
        onOpenChange={setTemplateBrowserOpen}
      />

      {/* GitHub import */}
      <GitHubImportDialog
        businessId={businessId}
        onImported={() => {
          refetchSkills();
        }}
        open={githubImportOpen}
        onOpenChange={setGithubImportOpen}
      />
    </div>
  );
}
