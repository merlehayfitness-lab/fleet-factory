"use client";

import { useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PromptRefinementPanel } from "@/_components/prompt-refinement-panel";
import { TestChatDialog } from "@/_components/test-chat-dialog";
import { ContextSuggestionUI } from "@/_components/context-suggestion-ui";
import { generatePromptAction } from "@/_actions/prompt-generator-actions";
import type { RoleDefinition, PromptSections } from "@agency-factory/core";

const SECTION_LABELS: Record<keyof PromptSections, string> = {
  identity: "Identity",
  instructions: "Instructions",
  tools: "Tools",
  constraints: "Constraints",
};

interface WizardPromptGenerationStepProps {
  agentId: string;
  businessId: string;
  roleDefinition: RoleDefinition;
  knowledgeDocTitles: string[];
  integrationNames: string[];
  promptSections: PromptSections | null;
  skillDefinition: string;
  onSectionsChange: (sections: PromptSections) => void;
  onSkillChange: (skill: string) => void;
}

/**
 * Wizard Step 4: Prompt Generation.
 *
 * Calls Claude to generate a system prompt + SKILL.md from the role
 * definition. Shows structured breakdown for confirmation, then
 * displays sections with refinement and test chat options.
 */
export function WizardPromptGenerationStep({
  agentId,
  businessId,
  roleDefinition,
  knowledgeDocTitles,
  integrationNames,
  promptSections,
  skillDefinition,
  onSectionsChange,
  onSkillChange,
}: WizardPromptGenerationStepProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [breakdown, setBreakdown] = useState<string | null>(null);
  const [showRefinement, setShowRefinement] = useState(false);

  // Context selection state (local to this step)
  const [selectedDocTitles, setSelectedDocTitles] =
    useState<string[]>(knowledgeDocTitles);
  const [selectedIntNames, setSelectedIntNames] =
    useState<string[]>(integrationNames);

  const handleContextChange = useCallback(
    (docTitles: string[], intNames: string[]) => {
      setSelectedDocTitles(docTitles);
      setSelectedIntNames(intNames);
    },
    [],
  );

  async function handleGenerate() {
    setIsGenerating(true);
    setBreakdown(null);

    try {
      const rd: RoleDefinition = {
        ...roleDefinition,
        linked_knowledge_docs: selectedDocTitles,
        linked_integrations: selectedIntNames,
      };

      const result = await generatePromptAction(
        agentId,
        businessId,
        rd,
        selectedDocTitles,
        selectedIntNames,
      );

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.data) {
        setBreakdown(result.data.structuredBreakdown);
        onSectionsChange(result.data.promptSections);
        onSkillChange(result.data.skillDefinition);
        toast.success("Prompt generated successfully");
      }
    } catch {
      toast.error("Failed to generate prompt");
    } finally {
      setIsGenerating(false);
    }
  }

  function handleRefinementAccept(updated: PromptSections) {
    onSectionsChange(updated);
    setShowRefinement(false);
    toast.success("Prompt updated");
  }

  // Build system prompt string for test chat
  const fullSystemPrompt = promptSections
    ? [
        promptSections.identity,
        promptSections.instructions,
        promptSections.tools,
        promptSections.constraints,
      ].join("\n\n")
    : "";

  // Context docs/integrations for the checkbox panel
  const contextDocs = knowledgeDocTitles.map((t, i) => ({
    id: `doc-${i}`,
    title: t,
  }));
  const contextInts = integrationNames.map((n, i) => ({
    id: `int-${i}`,
    name: n.split(" (")[0],
    type: n.includes("(") ? n.split("(")[1].replace(")", "") : "unknown",
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Prompt Generation</h2>
        <p className="text-sm text-muted-foreground">
          Claude will generate a system prompt and SKILL.md from the role
          definition. You can refine and test the output.
        </p>
      </div>

      {/* Context selection */}
      {(contextDocs.length > 0 || contextInts.length > 0) && (
        <ContextSuggestionUI
          knowledgeDocs={contextDocs}
          integrations={contextInts}
          onSelectionChange={handleContextChange}
        />
      )}

      {/* Generate button */}
      <Button
        onClick={handleGenerate}
        disabled={isGenerating}
        className="w-full"
      >
        {isGenerating && <Loader2 className="mr-2 size-4 animate-spin" />}
        {promptSections ? "Regenerate Prompt" : "Generate Prompt"}
      </Button>

      {/* Structured breakdown */}
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

      {/* Generated prompt display */}
      {promptSections && !showRefinement && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-sm">
              <span>System Prompt</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRefinement(true)}
                >
                  Refine
                </Button>
                <TestChatDialog
                  systemPrompt={fullSystemPrompt}
                  modelProfile={{}}
                />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-4 pr-4">
                {(
                  Object.keys(SECTION_LABELS) as Array<keyof PromptSections>
                ).map((key) => (
                  <div key={key}>
                    <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                      {SECTION_LABELS[key]}
                    </p>
                    <pre className="whitespace-pre-wrap rounded-lg bg-muted p-3 font-mono text-xs">
                      {promptSections[key]}
                    </pre>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Refinement panel */}
      {promptSections && showRefinement && (
        <PromptRefinementPanel
          initialSections={promptSections}
          onAccept={handleRefinementAccept}
          onClose={() => setShowRefinement(false)}
        />
      )}

      {/* SKILL.md preview */}
      {skillDefinition && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">SKILL.md Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-40">
              <pre className="whitespace-pre-wrap font-mono text-xs">
                {skillDefinition}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
