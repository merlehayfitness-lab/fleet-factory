"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RoleDefinition, RoleTemplate } from "@fleet-factory/core";
import { getRoleTemplatesForDepartment } from "@fleet-factory/core";

const TONE_OPTIONS = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "formal", label: "Formal" },
  { value: "casual", label: "Casual" },
  { value: "technical", label: "Technical" },
];

interface WizardRoleDefinitionStepProps {
  departmentType: string;
  roleDefinition: RoleDefinition;
  onRoleDefinitionChange: (rd: RoleDefinition) => void;
}

/**
 * Wizard Step 3: Role Definition.
 *
 * Template selector pre-fills fields from curated templates.
 * Structured fields match RoleDefinitionCard: description, tone,
 * focus areas, and workflow instructions.
 */
export function WizardRoleDefinitionStep({
  departmentType,
  roleDefinition,
  onRoleDefinitionChange,
}: WizardRoleDefinitionStepProps) {
  const templates = getRoleTemplatesForDepartment(departmentType);

  const focusInput = roleDefinition.focus_areas.join(", ");

  function update(partial: Partial<RoleDefinition>) {
    onRoleDefinitionChange({ ...roleDefinition, ...partial });
  }

  function handleTemplateSelect(templateId: string) {
    const template = templates.find((t: RoleTemplate) => t.id === templateId);
    if (!template) return;

    onRoleDefinitionChange({
      ...template.roleDefinition,
      template_id: template.id,
      // Preserve any linked docs/integrations from wizard context
      linked_integrations: roleDefinition.linked_integrations,
      linked_knowledge_docs: roleDefinition.linked_knowledge_docs,
    });
  }

  function handleFocusChange(value: string) {
    const areas = value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    update({ focus_areas: areas });
  }

  const currentFocusAreas = roleDefinition.focus_areas.filter(Boolean);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Role Definition</h2>
        <p className="text-sm text-muted-foreground">
          Describe the agent&apos;s role in plain language. Claude will use this
          to generate a system prompt in the next step.
        </p>
      </div>

      {/* Template selector */}
      {templates.length > 0 && (
        <div className="space-y-2">
          <Label>Start from a Template</Label>
          <Select
            value={roleDefinition.template_id ?? ""}
            onValueChange={(v) => v && handleTemplateSelect(v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a template to pre-fill..." />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t: RoleTemplate) => (
                <SelectItem key={t.id} value={t.id}>
                  <div className="flex flex-col">
                    <span>{t.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {t.description}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="role-desc">
          Description <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="role-desc"
          placeholder="Describe what this agent does, its responsibilities, and how it fits in the department..."
          value={roleDefinition.description}
          onChange={(e) => update({ description: e.target.value })}
          className="min-h-24"
        />
      </div>

      {/* Tone */}
      <div className="space-y-2">
        <Label htmlFor="role-tone">Tone</Label>
        <Select
          value={roleDefinition.tone}
          onValueChange={(v) => v && update({ tone: v })}
        >
          <SelectTrigger id="role-tone">
            <SelectValue placeholder="Select tone" />
          </SelectTrigger>
          <SelectContent>
            {TONE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Focus areas */}
      <div className="space-y-2">
        <Label htmlFor="focus-areas">Focus Areas</Label>
        <Input
          id="focus-areas"
          placeholder="e.g., customer retention, upselling, complaint resolution"
          value={focusInput}
          onChange={(e) => handleFocusChange(e.target.value)}
        />
        {currentFocusAreas.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {currentFocusAreas.map((area, i) => (
              <Badge key={i} variant="secondary">
                {area}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Workflow instructions */}
      <div className="space-y-2">
        <Label htmlFor="workflow">Workflow Instructions</Label>
        <Textarea
          id="workflow"
          placeholder="Describe the agent's workflow step by step..."
          value={roleDefinition.workflow_instructions}
          onChange={(e) => update({ workflow_instructions: e.target.value })}
          className="min-h-32"
        />
        <p className="text-xs text-muted-foreground">
          Describe how the agent should work, what steps it follows, and when to
          escalate. Claude will convert this into structured instructions.
        </p>
      </div>
    </div>
  );
}
