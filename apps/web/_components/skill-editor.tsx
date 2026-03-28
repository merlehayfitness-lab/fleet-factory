"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { createSkillAction, updateSkillAction } from "@/_actions/skill-actions";
import type { Skill } from "@agency-factory/core";

interface SkillEditorProps {
  businessId: string;
  skill: Skill | null; // null = new skill
  onSave: (skill: Skill) => void;
  onClose: () => void;
}

/**
 * Split-pane skill editor Dialog.
 * Left pane: structured form (name, description, instructions, trigger phrases).
 * Right pane: live SKILL.md preview updated from form state.
 */
export function SkillEditor({
  businessId,
  skill,
  onSave,
  onClose,
}: SkillEditorProps) {
  const [name, setName] = useState(skill?.name ?? "");
  const [description, setDescription] = useState(skill?.description ?? "");
  const [instructions, setInstructions] = useState(skill?.content ?? "");
  const [triggers, setTriggers] = useState(
    skill?.trigger_phrases?.join(", ") ?? "",
  );
  const [saving, setSaving] = useState(false);

  const isEditing = skill !== null;

  // Compute live SKILL.md preview from form state
  const preview = useMemo(() => {
    const lines: string[] = [];
    lines.push("---");
    lines.push(`name: ${name || "(untitled)"}`);
    if (description.trim()) {
      lines.push(`description: ${description.trim()}`);
    }
    if (triggers.trim()) {
      lines.push(`triggers: ${triggers.trim()}`);
    }
    lines.push("---");
    lines.push("");
    lines.push(`# ${name || "(untitled)"}`);
    lines.push("");
    lines.push(instructions || "(no instructions)");
    return lines.join("\n");
  }, [name, description, instructions, triggers]);

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Skill name is required");
      return;
    }

    setSaving(true);

    const triggerPhrases = triggers
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      if (isEditing) {
        const result = await updateSkillAction(skill.id, businessId, {
          name: name.trim(),
          description: description.trim() || undefined,
          content: instructions,
          trigger_phrases: triggerPhrases.length > 0 ? triggerPhrases : undefined,
        });

        if ("error" in result) {
          toast.error(result.error);
          return;
        }

        toast.success(`Skill updated (v${result.skill.version})`);
        onSave(result.skill);
      } else {
        const result = await createSkillAction(businessId, {
          name: name.trim(),
          description: description.trim() || undefined,
          content: instructions,
          trigger_phrases: triggerPhrases.length > 0 ? triggerPhrases : undefined,
        });

        if ("error" in result) {
          toast.error(result.error);
          return;
        }

        toast.success("Skill created");
        onSave(result.skill);
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? "Edit Skill" : "New Skill"}
            {isEditing && (
              <Badge variant="secondary" className="text-xs">
                v{skill.version}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the skill definition. Version will increment on save."
              : "Define a new skill with structured sections."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Left pane: Form */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="skill-name"
                className="text-sm font-medium leading-none"
              >
                Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="skill-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Lead Qualification"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="skill-description"
                className="text-sm font-medium leading-none"
              >
                Description
              </label>
              <Textarea
                id="skill-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of what this skill does"
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="skill-instructions"
                className="text-sm font-medium leading-none"
              >
                Instructions
              </label>
              <Textarea
                id="skill-instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Detailed instructions for the agent when using this skill..."
                rows={10}
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="skill-triggers"
                className="text-sm font-medium leading-none"
              >
                Trigger Phrases
              </label>
              <Input
                id="skill-triggers"
                value={triggers}
                onChange={(e) => setTriggers(e.target.value)}
                placeholder="e.g., qualify lead, score prospect, assess fit"
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated phrases that activate this skill
              </p>
            </div>
          </div>

          {/* Right pane: Live preview */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium leading-none">Preview</p>
            <p className="text-xs text-muted-foreground">
              Live SKILL.md preview
            </p>
            <pre className="mt-2 max-h-[400px] overflow-auto rounded-md border bg-muted/50 p-4 font-mono text-xs leading-relaxed">
              <code>{preview}</code>
            </pre>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Skill"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
