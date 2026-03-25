"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { updateAgentConfigAction } from "@/_actions/agent-actions";

interface Template {
  id: string;
  name: string;
  system_prompt: string;
  tool_profile: Record<string, unknown>;
  model_profile: Record<string, unknown>;
}

interface Agent {
  id: string;
  name: string;
  system_prompt: string;
  tool_profile: Record<string, unknown>;
  model_profile: Record<string, unknown>;
}

interface AgentConfigProps {
  agent: Agent;
  template: Template | null;
  businessId: string;
}

/** Compare two values for equality (JSON comparison for objects). */
function isEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Config tab for the agent detail page.
 *
 * Shows the full system prompt (editable), template reference with link,
 * template diff highlighting config drift, and tool/model profiles.
 */
export function AgentConfig({ agent, template, businessId }: AgentConfigProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(agent.system_prompt);
  const [isSaving, setIsSaving] = useState(false);

  // Calculate template drift
  const promptDiffers = template
    ? !isEqual(agent.system_prompt, template.system_prompt)
    : false;
  const toolsDiffer = template
    ? !isEqual(agent.tool_profile, template.tool_profile)
    : false;
  const modelDiffers = template
    ? !isEqual(agent.model_profile, template.model_profile)
    : false;
  const hasDrift = promptDiffers || toolsDiffer || modelDiffers;

  async function handleSave() {
    setIsSaving(true);
    try {
      const result = await updateAgentConfigAction(agent.id, businessId, {
        system_prompt: editedPrompt,
      });
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("System prompt updated");
        setIsEditing(false);
      }
    } catch {
      toast.error("Failed to update system prompt");
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    setEditedPrompt(agent.system_prompt);
    setIsEditing(false);
  }

  return (
    <div className="space-y-6 pt-4">
      {/* System prompt */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>System Prompt</span>
            {!isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                Edit
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="space-y-3">
              <Textarea
                value={editedPrompt}
                onChange={(e) => setEditedPrompt(e.target.value)}
                className="min-h-48 font-mono text-sm"
                disabled={isSaving}
              />
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={isSaving} size="sm">
                  {isSaving ? "Saving..." : "Save"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSaving}
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap rounded-lg bg-muted p-4 font-mono text-sm">
              {agent.system_prompt}
            </pre>
          )}
        </CardContent>
      </Card>

      {/* Template reference */}
      {template && (
        <Card>
          <CardHeader>
            <CardTitle>Template Reference</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">
              Created from:{" "}
              <Link
                href={`/businesses/${businessId}/templates/${template.id}/edit`}
                className="font-medium text-primary hover:underline"
              >
                {template.name}
              </Link>
            </p>

            {hasDrift ? (
              <Badge
                variant="secondary"
                className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
              >
                Config differs from template
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
              >
                In sync with template
              </Badge>
            )}
          </CardContent>
        </Card>
      )}

      {/* Template diff (only if drift exists) */}
      {template && hasDrift && (
        <Card>
          <CardHeader>
            <CardTitle>Template Differences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {promptDiffers && (
              <DiffSection
                label="System Prompt"
                templateValue={template.system_prompt}
                agentValue={agent.system_prompt}
              />
            )}
            {toolsDiffer && (
              <DiffSection
                label="Tool Profile"
                templateValue={JSON.stringify(template.tool_profile, null, 2)}
                agentValue={JSON.stringify(agent.tool_profile, null, 2)}
              />
            )}
            {modelDiffers && (
              <DiffSection
                label="Model Profile"
                templateValue={JSON.stringify(template.model_profile, null, 2)}
                agentValue={JSON.stringify(agent.model_profile, null, 2)}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Tool profile */}
      <Card>
        <CardHeader>
          <CardTitle>Tool Profile</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(agent.tool_profile).length > 0 ? (
            <pre className="whitespace-pre-wrap rounded-lg bg-muted p-4 font-mono text-sm">
              {JSON.stringify(agent.tool_profile, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              No tools configured
            </p>
          )}
        </CardContent>
      </Card>

      {/* Model profile */}
      <Card>
        <CardHeader>
          <CardTitle>Model Profile</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(agent.model_profile).length > 0 ? (
            <pre className="whitespace-pre-wrap rounded-lg bg-muted p-4 font-mono text-sm">
              {JSON.stringify(agent.model_profile, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">Default model</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Side-by-side diff display for a single config field.
 */
function DiffSection({
  label,
  templateValue,
  agentValue,
}: {
  label: string;
  templateValue: string;
  agentValue: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Template:</p>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs text-muted-foreground">
            {templateValue}
          </pre>
        </div>
        <div>
          <p className="mb-1 text-xs text-amber-700 dark:text-amber-400">
            Agent (diverged):
          </p>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md border border-amber-200 bg-amber-50/50 p-3 font-mono text-xs dark:border-amber-800 dark:bg-amber-900/10">
            {agentValue}
          </pre>
        </div>
      </div>
    </div>
  );
}
