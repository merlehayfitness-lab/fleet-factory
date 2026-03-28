"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, FileText, Loader2, Plug, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RoleDefinition, PromptSections } from "@agency-factory/core";

interface KnowledgeDoc {
  id: string;
  title: string;
  status: string;
}

interface Integration {
  id: string;
  name: string;
  type: string;
}

interface WizardReviewStepProps {
  agentName: string;
  departmentName: string;
  role: string;
  roleDefinition: RoleDefinition;
  promptSections: PromptSections | null;
  skillDefinition: string;
  knowledgeDocs: KnowledgeDoc[];
  integrations: Integration[];
  isCreating: boolean;
  onCreateAgent: () => void;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "ready":
      return "bg-green-500/10 text-green-600 border-green-500/20";
    case "processing":
      return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    case "failed":
      return "bg-red-500/10 text-red-600 border-red-500/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

/**
 * Collapsible section with toggle header.
 */
function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b last:border-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50"
      >
        {title}
        {isOpen ? (
          <ChevronUp className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" />
        )}
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

/**
 * Wizard Step 5: Review.
 *
 * Full summary of the agent configuration with collapsible sections.
 * Single "Create Agent" button finalizes the agent to status='active'.
 */
export function WizardReviewStep({
  agentName,
  departmentName,
  role,
  roleDefinition,
  promptSections,
  skillDefinition,
  knowledgeDocs,
  integrations,
  isCreating,
  onCreateAgent,
}: WizardReviewStepProps) {
  const focusAreas = roleDefinition.focus_areas.filter(Boolean);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Review &amp; Create</h2>
        <p className="text-sm text-muted-foreground">
          Review the agent configuration before creating it.
        </p>
      </div>

      <Card>
        {/* Agent header */}
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {agentName}
            <Badge variant="secondary">{departmentName}</Badge>
            {role && (
              <Badge variant="outline" className="font-normal">
                {role}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-0 p-0">
          {/* Role Definition */}
          <CollapsibleSection title="Role Definition">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Description
                </p>
                <p className="text-sm">{roleDefinition.description || "Not set"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Tone
                </p>
                <p className="text-sm capitalize">{roleDefinition.tone}</p>
              </div>
              {focusAreas.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    Focus Areas
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {focusAreas.map((area, i) => (
                      <Badge key={i} variant="secondary">
                        {area}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {roleDefinition.workflow_instructions && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Workflow Instructions
                  </p>
                  <pre className="whitespace-pre-wrap rounded bg-muted p-2 text-xs">
                    {roleDefinition.workflow_instructions}
                  </pre>
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* System Prompt */}
          {promptSections && (
            <>
              <CollapsibleSection title="System Prompt - Identity">
                <pre className="whitespace-pre-wrap rounded bg-muted p-3 font-mono text-xs">
                  {promptSections.identity}
                </pre>
              </CollapsibleSection>
              <CollapsibleSection title="System Prompt - Instructions">
                <pre className="whitespace-pre-wrap rounded bg-muted p-3 font-mono text-xs">
                  {promptSections.instructions}
                </pre>
              </CollapsibleSection>
              <CollapsibleSection title="System Prompt - Tools">
                <pre className="whitespace-pre-wrap rounded bg-muted p-3 font-mono text-xs">
                  {promptSections.tools}
                </pre>
              </CollapsibleSection>
              <CollapsibleSection title="System Prompt - Constraints">
                <pre className="whitespace-pre-wrap rounded bg-muted p-3 font-mono text-xs">
                  {promptSections.constraints}
                </pre>
              </CollapsibleSection>
            </>
          )}

          {/* SKILL.md */}
          {skillDefinition && (
            <CollapsibleSection title="SKILL.md Preview">
              <pre className="whitespace-pre-wrap rounded bg-muted p-3 font-mono text-xs">
                {skillDefinition}
              </pre>
            </CollapsibleSection>
          )}

          {/* Knowledge Documents */}
          <CollapsibleSection title={`Knowledge Documents (${knowledgeDocs.length})`}>
            {knowledgeDocs.length > 0 ? (
              <div className="space-y-2">
                {knowledgeDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <BookOpen className="size-3.5 text-muted-foreground" />
                      {doc.title}
                    </span>
                    <Badge
                      variant="outline"
                      className={statusBadgeClass(doc.status)}
                    >
                      {doc.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No knowledge documents uploaded.
              </p>
            )}
          </CollapsibleSection>

          {/* Integrations */}
          <CollapsibleSection title={`Integrations (${integrations.length})`}>
            {integrations.length > 0 ? (
              <div className="space-y-2">
                {integrations.map((int) => (
                  <div
                    key={int.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Plug className="size-3.5 text-muted-foreground" />
                    {int.name}
                    <span className="text-xs text-muted-foreground">
                      ({int.type})
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No integrations connected.
              </p>
            )}
          </CollapsibleSection>
        </CardContent>
      </Card>

      {/* Create Agent button */}
      <Button
        size="lg"
        className="w-full"
        onClick={onCreateAgent}
        disabled={isCreating || !promptSections}
      >
        {isCreating && <Loader2 className="mr-2 size-4 animate-spin" />}
        {isCreating ? "Creating Agent..." : "Create Agent"}
      </Button>

      {!promptSections && (
        <p className="text-center text-sm text-amber-600">
          Go back to Step 4 to generate a prompt before creating the agent.
        </p>
      )}
    </div>
  );
}
