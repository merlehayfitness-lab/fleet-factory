"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings } from "lucide-react";
import { updateAgentConfigAction } from "@/_actions/agent-actions";
import { saveRoleDefinitionAction } from "@/_actions/prompt-generator-actions";
import { RoleDefinitionCard } from "@/_components/role-definition-card";
import { SkillDefinitionCard } from "@/_components/skill-definition-card";
import { ContextSuggestionUI } from "@/_components/context-suggestion-ui";
import { PromptRefinementPanel } from "@/_components/prompt-refinement-panel";
import { TestChatDialog } from "@/_components/test-chat-dialog";
import { ModelSelector } from "@/_components/model-selector";
import { ProfileEditorDrawer } from "@/_components/profile-editor-drawer";
import { SyncFromTemplateDialog } from "@/_components/sync-from-template-dialog";
import type {
  RoleDefinition,
  GenerationResult,
  PromptSections,
  ToolProfileShape,
} from "@agency-factory/core";
import { getModelFriendlyName, EMPTY_TOOL_PROFILE } from "@agency-factory/core";

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
  role_definition: Record<string, unknown> | null;
  skill_definition: string | null;
}

interface KnowledgeDoc {
  id: string;
  title: string;
}

interface IntegrationItem {
  id: string;
  name: string;
  type: string;
}

interface AgentConfigProps {
  agent: Agent;
  template: Template | null;
  businessId: string;
  knowledgeDocs: KnowledgeDoc[];
  integrations: IntegrationItem[];
}

/** Compare two values for equality (JSON comparison for objects). */
function isEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Join prompt sections into a single system prompt string. */
function joinSections(sections: PromptSections): string {
  return [
    `## Identity\n${sections.identity}`,
    `## Instructions\n${sections.instructions}`,
    `## Tools\n${sections.tools}`,
    `## Constraints\n${sections.constraints}`,
  ].join("\n\n");
}

/** Try to parse a system prompt into sections. Returns null if not section-based. */
function parseSections(prompt: string): PromptSections | null {
  const identityMatch = prompt.match(
    /## Identity\n([\s\S]*?)(?=\n## Instructions|$)/,
  );
  const instructionsMatch = prompt.match(
    /## Instructions\n([\s\S]*?)(?=\n## Tools|$)/,
  );
  const toolsMatch = prompt.match(
    /## Tools\n([\s\S]*?)(?=\n## Constraints|$)/,
  );
  const constraintsMatch = prompt.match(/## Constraints\n([\s\S]*?)$/);

  if (identityMatch && instructionsMatch && toolsMatch && constraintsMatch) {
    return {
      identity: identityMatch[1].trim(),
      instructions: instructionsMatch[1].trim(),
      tools: toolsMatch[1].trim(),
      constraints: constraintsMatch[1].trim(),
    };
  }
  return null;
}

/** Extract model ID from a model_profile object. */
function extractModelId(mp: Record<string, unknown>): string {
  const model = mp?.model;
  return typeof model === "string" ? model : "";
}

/** Parse Record into ToolProfileShape. */
function parseToolProfile(tp: Record<string, unknown>): ToolProfileShape {
  if (!tp || typeof tp !== "object") return EMPTY_TOOL_PROFILE;
  return {
    allowed_tools: Array.isArray(tp.allowed_tools)
      ? (tp.allowed_tools as string[])
      : EMPTY_TOOL_PROFILE.allowed_tools,
    mcp_servers: Array.isArray(tp.mcp_servers)
      ? (tp.mcp_servers as ToolProfileShape["mcp_servers"])
      : EMPTY_TOOL_PROFILE.mcp_servers,
  };
}

/**
 * Config tab for the agent detail page.
 *
 * Includes Role Definition, Context Suggestions, System Prompt (with refinement
 * and test chat), SKILL.md, Template Reference, Differences, Tool/Model Profiles
 * with ModelSelector dropdown and ProfileEditorDrawer.
 */
export function AgentConfig({
  agent,
  template,
  businessId,
  knowledgeDocs,
  integrations,
}: AgentConfigProps) {
  const router = useRouter();

  // Role definition state
  const initialRoleDef = agent.role_definition as RoleDefinition | null;
  const [roleDefinition, setRoleDefinition] = useState<RoleDefinition | null>(
    initialRoleDef,
  );

  // Prompt sections state (try to parse from existing prompt)
  const [promptSections, setPromptSections] = useState<PromptSections | null>(
    parseSections(agent.system_prompt),
  );
  const [skillDefinition, setSkillDefinition] = useState<string | null>(
    agent.skill_definition,
  );

  // Context selections
  const [selectedDocTitles, setSelectedDocTitles] = useState<string[]>(
    knowledgeDocs.map((d) => d.title),
  );
  const [selectedIntegrationNames, setSelectedIntegrationNames] = useState<
    string[]
  >(integrations.map((i) => `${i.name} (${i.type})`));

  // UI state
  const [isRefinementOpen, setIsRefinementOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(agent.system_prompt);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAll, setIsSavingAll] = useState(false);

  // Model state
  const [currentModelId, setCurrentModelId] = useState(
    extractModelId(agent.model_profile),
  );
  const [savingModel, setSavingModel] = useState(false);

  // Tool profile state
  const [toolProfile, setToolProfile] = useState<ToolProfileShape>(
    parseToolProfile(agent.tool_profile),
  );
  const [toolDrawerOpen, setToolDrawerOpen] = useState(false);

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

  // Context selection handler
  const handleSelectionChange = useCallback(
    (docTitles: string[], intNames: string[]) => {
      setSelectedDocTitles(docTitles);
      setSelectedIntegrationNames(intNames);
    },
    [],
  );

  // Generation handler
  function handleGenerate(result: GenerationResult) {
    setPromptSections(result.promptSections);
    setSkillDefinition(result.skillDefinition);
  }

  // Save system prompt only (manual edit)
  async function handleSavePrompt() {
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

  function handleCancelPrompt() {
    setEditedPrompt(agent.system_prompt);
    setIsEditing(false);
  }

  // Save all generated content
  async function handleSaveAll() {
    if (!promptSections || !roleDefinition) return;

    setIsSavingAll(true);
    try {
      const result = await saveRoleDefinitionAction(
        agent.id,
        businessId,
        roleDefinition,
        joinSections(promptSections),
        skillDefinition ?? "",
      );
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Role definition, prompt, and SKILL.md saved");
      }
    } catch {
      toast.error("Failed to save");
    } finally {
      setIsSavingAll(false);
    }
  }

  // Handle skill definition save from card
  function handleSkillSave(updated: string) {
    setSkillDefinition(updated);
  }

  // Handle refinement accept
  function handleRefinementAccept(updated: PromptSections) {
    setPromptSections(updated);
    setIsRefinementOpen(false);
  }

  // Handle model change
  async function handleModelChange(newModelId: string) {
    setSavingModel(true);
    setCurrentModelId(newModelId);
    try {
      const result = await updateAgentConfigAction(agent.id, businessId, {
        model_profile: { ...agent.model_profile, model: newModelId },
      });
      if (result?.error) {
        toast.error(result.error);
      } else {
        const friendlyName = getModelFriendlyName(newModelId);
        toast(`Model updated to ${friendlyName}`, {
          action: {
            label: "Redeploy",
            onClick: () =>
              router.push(`/businesses/${businessId}/deployments`),
          },
        });
      }
    } catch {
      toast.error("Failed to update model");
    } finally {
      setSavingModel(false);
    }
  }

  // Handle tool profile save from drawer
  async function handleToolProfileSave(updated: ToolProfileShape) {
    setToolProfile(updated);
    try {
      const result = await updateAgentConfigAction(agent.id, businessId, {
        tool_profile: updated as unknown as Record<string, unknown>,
      });
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast("Tool profile updated", {
          action: {
            label: "Redeploy",
            onClick: () =>
              router.push(`/businesses/${businessId}/deployments`),
          },
        });
      }
    } catch {
      toast.error("Failed to update tool profile");
    }
  }

  const currentPrompt = promptSections
    ? joinSections(promptSections)
    : agent.system_prompt;

  // Tool profile summary
  const toolCount = toolProfile.allowed_tools.includes("*")
    ? "All"
    : String(toolProfile.allowed_tools.length);
  const mcpCount = toolProfile.mcp_servers.length;
  const displayTools = toolProfile.allowed_tools
    .filter((t) => t !== "*")
    .slice(0, 5);

  return (
    <div className="space-y-6 pt-4">
      {/* Role Definition card */}
      <RoleDefinitionCard
        agentId={agent.id}
        businessId={businessId}
        initialRoleDefinition={initialRoleDef}
        knowledgeDocTitles={selectedDocTitles}
        integrationNames={selectedIntegrationNames}
        onGenerate={(result) => {
          setRoleDefinition({
            description: initialRoleDef?.description ?? "",
            tone: initialRoleDef?.tone ?? "professional",
            focus_areas: initialRoleDef?.focus_areas ?? [],
            workflow_instructions:
              initialRoleDef?.workflow_instructions ?? "",
            linked_integrations: selectedIntegrationNames,
            linked_knowledge_docs: selectedDocTitles,
          });
          handleGenerate(result);
        }}
      />

      {/* Context Suggestion UI (shown when role definition exists) */}
      {(knowledgeDocs.length > 0 || integrations.length > 0) && (
        <ContextSuggestionUI
          knowledgeDocs={knowledgeDocs}
          integrations={integrations}
          onSelectionChange={handleSelectionChange}
        />
      )}

      {/* Refinement Panel (shown when open) */}
      {isRefinementOpen && promptSections && (
        <PromptRefinementPanel
          initialSections={promptSections}
          onAccept={handleRefinementAccept}
          onClose={() => setIsRefinementOpen(false)}
        />
      )}

      {/* System Prompt card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>System Prompt</span>
            <div className="flex gap-2">
              {promptSections && !isRefinementOpen && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsRefinementOpen(true)}
                  >
                    Refine Prompt
                  </Button>
                  <TestChatDialog
                    systemPrompt={currentPrompt}
                    modelProfile={agent.model_profile}
                  />
                </>
              )}
              {!isEditing && !promptSections && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  Edit
                </Button>
              )}
            </div>
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
                <Button
                  onClick={handleSavePrompt}
                  disabled={isSaving}
                  size="sm"
                >
                  {isSaving ? "Saving..." : "Save"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCancelPrompt}
                  disabled={isSaving}
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : promptSections ? (
            <div className="space-y-4">
              {(
                [
                  ["Identity", promptSections.identity],
                  ["Instructions", promptSections.instructions],
                  ["Tools", promptSections.tools],
                  ["Constraints", promptSections.constraints],
                ] as const
              ).map(([label, content]) => (
                <div key={label}>
                  <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                    {label}
                  </p>
                  <pre className="whitespace-pre-wrap rounded-lg bg-muted p-3 font-mono text-sm">
                    {content}
                  </pre>
                </div>
              ))}
            </div>
          ) : (
            <pre className="whitespace-pre-wrap rounded-lg bg-muted p-4 font-mono text-sm">
              {agent.system_prompt}
            </pre>
          )}
        </CardContent>
      </Card>

      {/* SKILL.md card */}
      <SkillDefinitionCard
        skillDefinition={skillDefinition}
        onSave={handleSkillSave}
      />

      {/* Save All button (when generated content exists) */}
      {promptSections && (
        <Button
          onClick={handleSaveAll}
          disabled={isSavingAll}
          className="w-full"
        >
          {isSavingAll
            ? "Saving..."
            : "Save Role Definition, Prompt & SKILL.md"}
        </Button>
      )}

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

            <div className="flex items-center gap-2">
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
            </div>

            <SyncFromTemplateDialog
              agentId={agent.id}
              businessId={businessId}
              hasTemplate={!!template}
            />
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

      {/* Model profile -- ModelSelector dropdown */}
      <Card>
        <CardHeader>
          <CardTitle>Model Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <ModelSelector
            value={currentModelId}
            onValueChange={handleModelChange}
            disabled={savingModel}
          />
          {savingModel && (
            <p className="mt-2 text-xs text-muted-foreground">Saving...</p>
          )}
        </CardContent>
      </Card>

      {/* Tool profile -- Summary card with Edit button */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Tool Profile</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setToolDrawerOpen(true)}
            >
              Edit
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {toolCount} tools allowed, {mcpCount} MCP server
                {mcpCount !== 1 ? "s" : ""} configured
              </span>
            </div>
            {displayTools.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {displayTools.map((tool) => (
                  <Badge key={tool} variant="secondary" className="text-xs">
                    {tool}
                  </Badge>
                ))}
                {toolProfile.allowed_tools.length > 5 && (
                  <Badge variant="secondary" className="text-xs">
                    +{toolProfile.allowed_tools.length - 5} more
                  </Badge>
                )}
              </div>
            )}
            {toolProfile.allowed_tools.includes("*") && (
              <Badge
                variant="secondary"
                className="bg-emerald-100 text-emerald-800 text-xs dark:bg-emerald-900/30 dark:text-emerald-400"
              >
                All tools allowed
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tool Profile Drawer */}
      <ProfileEditorDrawer
        isOpen={toolDrawerOpen}
        onClose={() => setToolDrawerOpen(false)}
        title="Edit Tool Profile"
        profile={toolProfile}
        onSave={handleToolProfileSave}
        businessId={businessId}
      />
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
