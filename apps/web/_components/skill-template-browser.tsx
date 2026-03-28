"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Eye, Plus, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getSkillTemplatesAction,
  createSkillFromTemplateAction,
  assignSkillAction,
} from "@/_actions/skill-actions";
import type { SkillTemplate } from "@agency-factory/core";

interface SkillTemplateBrowserProps {
  businessId: string;
  agentId?: string;
  onSkillAdded?: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEPARTMENT_OPTIONS = ["All", "Owner", "Sales", "Support", "Operations"] as const;

/**
 * Dialog for browsing and selecting skill templates.
 * Filterable card grid with department/role filters, preview, and copy-and-customize add flow.
 */
export function SkillTemplateBrowser({
  businessId,
  agentId,
  onSkillAdded,
  open,
  onOpenChange,
}: SkillTemplateBrowserProps) {
  const [templates, setTemplates] = useState<SkillTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [roleFilter, setRoleFilter] = useState("All");
  const [previewTemplate, setPreviewTemplate] = useState<SkillTemplate | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    async function fetchTemplates() {
      setLoading(true);
      const result = await getSkillTemplatesAction();
      if ("templates" in result) {
        setTemplates(result.templates);
      }
      setLoading(false);
    }

    fetchTemplates();
  }, [open]);

  // Extract unique role types from templates for filter options
  const roleOptions = useMemo(() => {
    const roles = new Set<string>();
    for (const t of templates) {
      if (t.role_type) roles.add(t.role_type);
    }
    return ["All", ...Array.from(roles).sort()];
  }, [templates]);

  // Filter templates client-side
  const filtered = useMemo(() => {
    return templates.filter((t) => {
      if (departmentFilter !== "All" && t.department_type.toLowerCase() !== departmentFilter.toLowerCase()) {
        return false;
      }
      if (roleFilter !== "All" && t.role_type !== roleFilter) {
        return false;
      }
      return true;
    });
  }, [templates, departmentFilter, roleFilter]);

  async function handleAdd(template: SkillTemplate) {
    setAdding(template.id);

    const result = await createSkillFromTemplateAction(businessId, template.id);

    if ("error" in result) {
      toast.error(result.error);
      setAdding(null);
      return;
    }

    // Optionally assign to agent
    if (agentId) {
      const assignResult = await assignSkillAction(result.skill.id, businessId, {
        agent_id: agentId,
      });
      if ("error" in assignResult) {
        toast.error(`Skill created but assignment failed: ${assignResult.error}`);
      }
    }

    toast.success(`Added "${template.name}" to library`);
    setAdding(null);
    onSkillAdded?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Skill Templates</DialogTitle>
          <DialogDescription>
            Browse starter skill templates. Adding a template creates a copy in your business library.
          </DialogDescription>
        </DialogHeader>

        {/* Filter bar */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Department:</span>
            <Select
              value={departmentFilter}
              onValueChange={(v) => v && setDepartmentFilter(v)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENT_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Role:</span>
            <Select
              value={roleFilter}
              onValueChange={(v) => v && setRoleFilter(v)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No templates match the current filters.
            </p>
          </div>
        ) : (
          <>
            {/* Card grid */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((template) => (
                <div
                  key={template.id}
                  className="flex flex-col rounded-lg border p-4"
                >
                  <h4 className="font-semibold text-sm">{template.name}</h4>
                  {template.description && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {template.description}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-xs capitalize">
                      {template.department_type}
                    </Badge>
                    {template.role_type && (
                      <Badge variant="secondary" className="text-xs">
                        {template.role_type}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-auto flex gap-2 pt-3">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1"
                      onClick={() => setPreviewTemplate(template)}
                    >
                      <Eye className="mr-1 size-3.5" />
                      Preview
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      disabled={adding === template.id}
                      onClick={() => handleAdd(template)}
                    >
                      {adding === template.id ? (
                        <Loader2 className="mr-1 size-3.5 animate-spin" />
                      ) : (
                        <Plus className="mr-1 size-3.5" />
                      )}
                      Add to Library
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Preview section */}
            {previewTemplate && (
              <div className="mt-4 rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-sm">
                    Preview: {previewTemplate.name}
                  </h4>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPreviewTemplate(null)}
                  >
                    Close Preview
                  </Button>
                </div>
                <pre className="max-h-[300px] overflow-auto rounded-md border bg-background p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                  {previewTemplate.content}
                </pre>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
