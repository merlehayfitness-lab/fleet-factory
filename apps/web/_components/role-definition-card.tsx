"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generatePromptAction } from "@/_actions/prompt-generator-actions";
import type { RoleDefinition, GenerationResult } from "@fleet-factory/core";

interface RoleDefinitionCardProps {
  agentId: string;
  businessId: string;
  initialRoleDefinition: RoleDefinition | null;
  knowledgeDocTitles: string[];
  integrationNames: string[];
  onGenerate: (result: GenerationResult) => void;
}

const TONE_OPTIONS = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "formal", label: "Formal" },
  { value: "casual", label: "Casual" },
  { value: "technical", label: "Technical" },
];

/**
 * Structured role definition form card.
 *
 * Provides fields for description, tone, focus areas, and workflow instructions.
 * Generate button sends the definition to Claude for prompt generation.
 */
export function RoleDefinitionCard({
  agentId,
  businessId,
  initialRoleDefinition,
  knowledgeDocTitles,
  integrationNames,
  onGenerate,
}: RoleDefinitionCardProps) {
  const [description, setDescription] = useState(
    initialRoleDefinition?.description ?? "",
  );
  const [tone, setTone] = useState(
    initialRoleDefinition?.tone ?? "professional",
  );
  const [focusInput, setFocusInput] = useState(
    initialRoleDefinition?.focus_areas?.join(", ") ?? "",
  );
  const [workflowInstructions, setWorkflowInstructions] = useState(
    initialRoleDefinition?.workflow_instructions ?? "",
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [breakdown, setBreakdown] = useState<string | null>(null);

  const focusAreas = focusInput
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  async function handleGenerate() {
    if (!description.trim()) {
      toast.error("Please provide a role description");
      return;
    }

    setIsGenerating(true);
    setBreakdown(null);

    try {
      const roleDefinition: RoleDefinition = {
        description,
        tone,
        focus_areas: focusAreas,
        workflow_instructions: workflowInstructions,
        linked_integrations: integrationNames,
        linked_knowledge_docs: knowledgeDocTitles,
      };

      const result = await generatePromptAction(
        agentId,
        businessId,
        roleDefinition,
        knowledgeDocTitles,
        integrationNames,
      );

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.data) {
        setBreakdown(result.data.structuredBreakdown);
        onGenerate(result.data);
        toast.success("Prompt generated successfully");
      }
    } catch {
      toast.error("Failed to generate prompt");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Role Definition</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="role-description">Description</Label>
          <Textarea
            id="role-description"
            placeholder="Describe what this agent does, its responsibilities, and how it fits in the department..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-24"
          />
        </div>

        {/* Tone selector */}
        <div className="space-y-2">
          <Label htmlFor="role-tone">Tone</Label>
          <Select value={tone} onValueChange={(v) => v && setTone(v)}>
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
            onChange={(e) => setFocusInput(e.target.value)}
          />
          {focusAreas.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {focusAreas.map((area, i) => (
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
            value={workflowInstructions}
            onChange={(e) => setWorkflowInstructions(e.target.value)}
            className="min-h-32"
          />
          <p className="text-xs text-muted-foreground">
            Describe how the agent should work, what steps it follows, and when
            to escalate. Claude will convert this into structured instructions.
          </p>
        </div>

        {/* Generate button */}
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !description.trim()}
          className="w-full"
        >
          {isGenerating ? "Generating..." : "Generate Prompt"}
        </Button>

        {/* Structured breakdown (confirmation) */}
        {breakdown && (
          <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-800 dark:bg-blue-900/10">
            <p className="mb-2 text-sm font-medium text-blue-900 dark:text-blue-200">
              Generation Summary
            </p>
            <pre className="whitespace-pre-wrap text-sm text-blue-800 dark:text-blue-300">
              {breakdown}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
