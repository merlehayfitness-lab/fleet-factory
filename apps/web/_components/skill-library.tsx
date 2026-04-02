"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Plus, Layers, GitBranch, MoreVertical, Loader2, FolderOpen, ArrowLeft, Folder } from "lucide-react";
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
import type { Skill } from "@fleet-factory/core";

interface SkillLibraryProps {
  businessId: string;
  initialSkills: Skill[];
  agents?: Array<{ id: string; name: string; department_name?: string }>;
  departments?: Array<{ id: string; name: string }>;
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

/** Skill card used in both default and collection views. */
function SkillCard({
  skill,
  onEdit,
  onViewUsage,
  onDelete,
  showCollection,
}: {
  skill: Skill;
  onEdit: () => void;
  onViewUsage: () => void;
  onDelete: () => void;
  showCollection: boolean;
}) {
  return (
    <div
      className="flex flex-col rounded-lg border p-4 hover:bg-muted/30 transition-colors cursor-pointer"
      onClick={onEdit}
    >
      <div className="flex items-start justify-between">
        <h4 className="font-semibold text-sm truncate flex-1">{skill.name}</h4>
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
                onViewUsage();
              }}
            >
              View Usage
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
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
        {showCollection && skill.import_collection && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            <FolderOpen className="size-2.5" />
            {skill.import_collection}
          </span>
        )}
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
  );
}

/**
 * Business skill library card grid with search, source filter, and CRUD actions.
 */
export function SkillLibrary({ businessId, initialSkills, agents, departments }: SkillLibraryProps) {
  const [skills, setSkills] = useState<Skill[]>(initialSkills);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [collectionFilter, setCollectionFilter] = useState("All");
  const [editorSkill, setEditorSkill] = useState<Skill | null | "new">(null);
  const [usageSkillId, setUsageSkillId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Skill | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [templateBrowserOpen, setTemplateBrowserOpen] = useState(false);
  const [githubImportOpen, setGithubImportOpen] = useState(false);

  // Collection summaries: { name, count }
  const collectionSummaries = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of skills) {
      if (s.import_collection) {
        map.set(s.import_collection, (map.get(s.import_collection) ?? 0) + 1);
      }
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [skills]);

  // Loose skills = no collection (shown alongside folder cards in default view)
  const looseSkills = useMemo(() => {
    return skills.filter((s) => {
      if (s.import_collection) return false;
      if (sourceFilter !== "All" && s.source_type !== sourceFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!s.name.toLowerCase().includes(q) && !(s.description?.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [skills, search, sourceFilter]);

  // Collection skills = skills in the selected collection
  const collectionSkills = useMemo(() => {
    if (collectionFilter === "All") return [];
    return skills.filter((s) => {
      if (s.import_collection !== collectionFilter) return false;
      if (sourceFilter !== "All" && s.source_type !== sourceFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!s.name.toLowerCase().includes(q) && !(s.description?.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [skills, search, sourceFilter, collectionFilter]);

  // Filtered collection folders (when searching, only show folders with matching skills)
  const filteredCollections = useMemo(() => {
    if (!search.trim() && sourceFilter === "All") return collectionSummaries;
    return collectionSummaries.filter((col) => {
      const colSkills = skills.filter((s) => {
        if (s.import_collection !== col.name) return false;
        if (sourceFilter !== "All" && s.source_type !== sourceFilter) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          if (!s.name.toLowerCase().includes(q) && !(s.description?.toLowerCase().includes(q))) return false;
        }
        return true;
      });
      return colSkills.length > 0;
    });
  }, [collectionSummaries, skills, search, sourceFilter]);

  const isViewingCollection = collectionFilter !== "All";
  const isSearching = search.trim().length > 0;

  // Global search results — all matching skills as flat cards (bypasses folders)
  const globalSearchResults = useMemo(() => {
    if (!isSearching) return [];
    const q = search.toLowerCase();
    return skills.filter((s) => {
      if (sourceFilter !== "All" && s.source_type !== sourceFilter) return false;
      if (!s.name.toLowerCase().includes(q) && !(s.description?.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [skills, search, sourceFilter, isSearching]);

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

      {/* Collection breadcrumb or filter bar */}
      {isViewingCollection ? (
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCollectionFilter("All")}
            className="gap-1.5"
          >
            <ArrowLeft className="size-3.5" />
            All Skills
          </Button>
          <div className="flex items-center gap-2">
            <Folder className="size-4 text-amber-600" />
            <span className="font-semibold text-sm">{collectionFilter}</span>
            <Badge variant="secondary" className="text-xs">
              {collectionSkills.length} skill{collectionSkills.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        </div>
      ) : null}

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
      {isSearching && !isViewingCollection ? (
        /* Global search — flat list of ALL matching skills across collections */
        globalSearchResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No skills match &ldquo;{search}&rdquo;.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {globalSearchResults.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onEdit={() => setEditorSkill(skill)}
                onViewUsage={() => setUsageSkillId(skill.id)}
                onDelete={() => setDeleteTarget(skill)}
                showCollection={true}
              />
            ))}
          </div>
        )
      ) : isViewingCollection ? (
        /* Collection detail view — list of skills in the selected collection */
        collectionSkills.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No skills match the current filters.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {collectionSkills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onEdit={() => setEditorSkill(skill)}
                onViewUsage={() => setUsageSkillId(skill.id)}
                onDelete={() => setDeleteTarget(skill)}
                showCollection={false}
              />
            ))}
          </div>
        )
      ) : (
        /* Default view — folder cards for collections + loose skill cards */
        filteredCollections.length === 0 && looseSkills.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {skills.length === 0
                ? "No skills yet. Create one, import from GitHub, or browse templates to get started."
                : "No skills match the current filters."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* Collection folder cards */}
            {filteredCollections.map((col) => (
              <button
                key={`col-${col.name}`}
                type="button"
                className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-amber-300 bg-amber-50/50 p-6 hover:bg-amber-100/50 hover:border-amber-400 transition-colors cursor-pointer dark:border-amber-700 dark:bg-amber-950/20 dark:hover:bg-amber-900/30"
                onClick={() => setCollectionFilter(col.name)}
              >
                <Folder className="size-10 text-amber-600 dark:text-amber-400" />
                <div className="text-center">
                  <h4 className="font-semibold text-sm">{col.name}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {col.count} skill{col.count !== 1 ? "s" : ""}
                  </p>
                </div>
              </button>
            ))}

            {/* Loose (non-collection) skill cards */}
            {looseSkills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onEdit={() => setEditorSkill(skill)}
                onViewUsage={() => setUsageSkillId(skill.id)}
                onDelete={() => setDeleteTarget(skill)}
                showCollection={false}
              />
            ))}
          </div>
        )
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
        agents={agents}
        departments={departments}
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
