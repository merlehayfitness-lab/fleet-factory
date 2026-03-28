"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  createProvisionalAgentAction,
  finalizeAgentAction,
} from "@/_actions/agent-wizard-actions";
import { WizardBasicInfoStep } from "@/_components/wizard-basic-info-step";
import { WizardKnowledgeStep } from "@/_components/wizard-knowledge-step";
import { WizardRoleDefinitionStep } from "@/_components/wizard-role-definition-step";
import { WizardPromptGenerationStep } from "@/_components/wizard-prompt-generation-step";
import { WizardReviewStep } from "@/_components/wizard-review-step";
import type { RoleDefinition, PromptSections } from "@agency-factory/core";

const STEPS = [
  { label: "Basic Info", key: "basic" },
  { label: "Knowledge", key: "knowledge" },
  { label: "Role Definition", key: "role" },
  { label: "Prompt Generation", key: "prompt" },
  { label: "Review", key: "review" },
] as const;

interface Department {
  id: string;
  name: string;
  type: string;
  agentCount: number;
  hasLead: boolean;
}

interface Integration {
  id: string;
  name: string;
  type: string;
}

interface KnowledgeDoc {
  id: string;
  title: string;
  status: string;
}

interface AgentSetupWizardProps {
  businessId: string;
  businessName: string;
  businessIndustry: string;
  departments: Department[];
  integrations: Integration[];
}

/**
 * Multi-step agent setup wizard managing all wizard state.
 *
 * 5 steps: Basic Info -> Knowledge Upload -> Role Definition ->
 * Prompt Generation -> Review & Create.
 */
export function AgentSetupWizard({
  businessId,
  businessName,
  businessIndustry,
  departments,
  integrations,
}: AgentSetupWizardProps) {
  const router = useRouter();

  // Step navigation
  const [currentStep, setCurrentStep] = useState(0);

  // Step 1: Basic Info
  const [agentName, setAgentName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [role, setRole] = useState("");
  const [parentAgentId, setParentAgentId] = useState<string | null>(null);

  // Step 2: Knowledge
  const [provisionalAgentId, setProvisionalAgentId] = useState<string | null>(
    null,
  );
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDoc[]>([]);
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);

  // Step 3: Role Definition
  const [roleDefinition, setRoleDefinition] = useState<RoleDefinition>({
    description: "",
    tone: "professional",
    focus_areas: [],
    workflow_instructions: "",
    linked_integrations: [],
    linked_knowledge_docs: [],
  });

  // Step 4: Prompt Generation
  const [promptSections, setPromptSections] = useState<PromptSections | null>(
    null,
  );
  const [skillDefinition, setSkillDefinition] = useState("");

  // Step 5: Creating
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Derived
  const selectedDept = departments.find((d) => d.id === departmentId);
  const departmentType = selectedDept?.type ?? "";

  // Navigation validation
  function canAdvance(): boolean {
    switch (currentStep) {
      case 0: // Basic Info
        return agentName.trim().length > 0 && departmentId.length > 0;
      case 1: // Knowledge
        // Block if any doc is still uploading/processing
        return !knowledgeDocs.some(
          (d) => d.status === "uploading" || d.status === "processing",
        );
      case 2: // Role Definition
        return roleDefinition.description.trim().length > 0;
      case 3: // Prompt Generation
        return promptSections !== null;
      case 4: // Review (no next, only create)
        return false;
      default:
        return false;
    }
  }

  async function handleNext() {
    if (!canAdvance()) return;

    // Before entering step 2 (Knowledge), create provisional agent
    if (currentStep === 0 && !provisionalAgentId) {
      setIsCreatingAgent(true);
      try {
        // Determine parent agent if department has a lead
        const dept = departments.find((d) => d.id === departmentId);
        const effectiveParentAgentId = dept?.hasLead ? parentAgentId : null;

        const result = await createProvisionalAgentAction(
          businessId,
          agentName,
          departmentId,
          role || undefined,
          effectiveParentAgentId,
        );

        if ("error" in result) {
          toast.error(result.error);
          setIsCreatingAgent(false);
          return;
        }

        setProvisionalAgentId(result.agent.id);
      } catch {
        toast.error("Failed to create provisional agent");
        setIsCreatingAgent(false);
        return;
      }
      setIsCreatingAgent(false);
    }

    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  }

  function handleBack() {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }

  const handleDocsChange = useCallback((docs: KnowledgeDoc[]) => {
    setKnowledgeDocs(docs);
  }, []);

  async function handleCreateAgent() {
    if (!provisionalAgentId || !promptSections) return;

    setIsFinalizing(true);

    const systemPrompt = [
      promptSections.identity,
      promptSections.instructions,
      promptSections.tools,
      promptSections.constraints,
    ].join("\n\n");

    const result = await finalizeAgentAction(
      provisionalAgentId,
      businessId,
      systemPrompt,
      skillDefinition,
      roleDefinition as unknown as Record<string, unknown>,
    );

    if ("error" in result) {
      toast.error(result.error);
      setIsFinalizing(false);
      return;
    }

    toast.success(`${agentName} created successfully`);
    router.push(`/businesses/${businessId}/agents/${provisionalAgentId}`);
  }

  return (
    <div className="space-y-8">
      {/* Step indicator */}
      <nav className="flex items-center justify-between">
        {STEPS.map((step, idx) => {
          const isComplete = idx < currentStep;
          const isCurrent = idx === currentStep;

          return (
            <div key={step.key} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors",
                    isComplete &&
                      "border-primary bg-primary text-primary-foreground",
                    isCurrent && "border-primary text-primary",
                    !isComplete &&
                      !isCurrent &&
                      "border-muted-foreground/25 text-muted-foreground",
                  )}
                >
                  {isComplete ? <Check className="size-4" /> : idx + 1}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium",
                    isCurrent
                      ? "text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={cn(
                    "mx-2 h-px flex-1",
                    idx < currentStep ? "bg-primary" : "bg-border",
                  )}
                />
              )}
            </div>
          );
        })}
      </nav>

      {/* Step content */}
      <div className="min-h-[400px]">
        {currentStep === 0 && (
          <WizardBasicInfoStep
            departments={departments}
            agentName={agentName}
            departmentId={departmentId}
            role={role}
            onNameChange={setAgentName}
            onDepartmentChange={(id) => {
              setDepartmentId(id);
              // Auto-set parentAgentId if department already has a lead
              const dept = departments.find((d) => d.id === id);
              if (dept?.hasLead) {
                setParentAgentId(null); // Will be auto-detected on the server
              } else {
                setParentAgentId(null);
              }
            }}
            onRoleChange={setRole}
          />
        )}

        {currentStep === 1 && (
          <WizardKnowledgeStep
            businessId={businessId}
            provisionalAgentId={provisionalAgentId}
            onDocsChange={handleDocsChange}
          />
        )}

        {currentStep === 2 && (
          <WizardRoleDefinitionStep
            departmentType={departmentType}
            roleDefinition={roleDefinition}
            onRoleDefinitionChange={setRoleDefinition}
          />
        )}

        {currentStep === 3 && provisionalAgentId && (
          <WizardPromptGenerationStep
            agentId={provisionalAgentId}
            businessId={businessId}
            roleDefinition={roleDefinition}
            knowledgeDocTitles={knowledgeDocs
              .filter((d) => d.status === "ready")
              .map((d) => d.title)}
            integrationNames={integrations.map(
              (i) => `${i.name} (${i.type})`,
            )}
            promptSections={promptSections}
            skillDefinition={skillDefinition}
            onSectionsChange={setPromptSections}
            onSkillChange={setSkillDefinition}
          />
        )}

        {currentStep === 4 && (
          <WizardReviewStep
            agentName={agentName}
            departmentName={selectedDept?.name ?? "Unknown"}
            role={role}
            roleDefinition={roleDefinition}
            promptSections={promptSections}
            skillDefinition={skillDefinition}
            knowledgeDocs={knowledgeDocs}
            integrations={integrations}
            isCreating={isFinalizing}
            onCreateAgent={handleCreateAgent}
          />
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between border-t pt-4">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 0}
        >
          Back
        </Button>

        {currentStep < STEPS.length - 1 ? (
          <Button
            onClick={handleNext}
            disabled={!canAdvance() || isCreatingAgent}
          >
            {isCreatingAgent ? "Creating..." : "Next"}
          </Button>
        ) : (
          <div /> // Review step handles its own "Create Agent" button
        )}
      </div>
    </div>
  );
}
