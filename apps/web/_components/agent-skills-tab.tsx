"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Layers, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SkillEditor } from "@/_components/skill-editor";
import { SkillAssignmentList } from "@/_components/skill-assignment-list";
import { SkillUsageCard } from "@/_components/skill-usage-card";
import { SkillTemplateBrowser } from "@/_components/skill-template-browser";
import { GitHubImportDialog } from "@/_components/github-import-dialog";
import {
  getSkillsForAgentAction,
  listSkillsForBusinessAction,
} from "@/_actions/skill-actions";
import type { Skill, SkillWithAssignment } from "@agency-factory/core";

interface AgentSkillsTabProps {
  businessId: string;
  agentId: string;
  departmentId: string;
  agentName: string;
}

/**
 * Skills tab content for agent detail page.
 * Header with "New Skill", "Add from Templates", "Import from GitHub" buttons.
 * Skill assignment list below. Click skill to open editor.
 */
export function AgentSkillsTab({
  businessId,
  agentId,
  departmentId,
  agentName,
}: AgentSkillsTabProps) {
  const [agentSkills, setAgentSkills] = useState<SkillWithAssignment[]>([]);
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorSkill, setEditorSkill] = useState<Skill | null | "new">(null);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [templateBrowserOpen, setTemplateBrowserOpen] = useState(false);
  const [githubImportOpen, setGithubImportOpen] = useState(false);

  const fetchSkills = useCallback(async () => {
    setLoading(true);
    const [agentResult, allResult] = await Promise.all([
      getSkillsForAgentAction(agentId, departmentId),
      listSkillsForBusinessAction(businessId),
    ]);

    if ("skills" in agentResult) {
      setAgentSkills(agentResult.skills);
    }
    if ("skills" in allResult) {
      setAllSkills(allResult.skills);
    }
    setLoading(false);
  }, [agentId, departmentId, businessId]);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  function handleSkillClick(skill: Skill) {
    setEditorSkill(skill);
    setSelectedSkillId(skill.id);
  }

  function handleEditorSave(savedSkill: Skill) {
    setEditorSkill(null);
    setSelectedSkillId(null);
    // Refetch to pick up any changes
    fetchSkills();
  }

  function handleEditorClose() {
    setEditorSkill(null);
    setSelectedSkillId(null);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-6 w-16 animate-pulse rounded bg-muted" />
          <div className="flex gap-2">
            <div className="h-9 w-24 animate-pulse rounded bg-muted" />
            <div className="h-9 w-36 animate-pulse rounded bg-muted" />
            <div className="h-9 w-40 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-md border bg-muted/30"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-semibold">Skills</h3>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => setEditorSkill("new")}
          >
            <Plus className="mr-1 size-3.5" />
            New Skill
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setTemplateBrowserOpen(true)}
          >
            <Layers className="mr-1 size-3.5" />
            Add from Templates
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setGithubImportOpen(true)}
          >
            <GitBranch className="mr-1 size-3.5" />
            Import from GitHub
          </Button>
        </div>
      </div>

      {/* Assignment list */}
      <SkillAssignmentList
        businessId={businessId}
        agentId={agentId}
        departmentId={departmentId}
        initialSkills={agentSkills}
        allBusinessSkills={allSkills}
        onSkillClick={handleSkillClick}
        onAssignmentChange={fetchSkills}
      />

      {/* Usage card for selected skill */}
      {selectedSkillId && !editorSkill && (
        <SkillUsageCard skillId={selectedSkillId} businessId={businessId} />
      )}

      {/* Skill editor dialog */}
      {editorSkill !== null && (
        <SkillEditor
          businessId={businessId}
          skill={editorSkill === "new" ? null : editorSkill}
          onSave={handleEditorSave}
          onClose={handleEditorClose}
        />
      )}

      {/* Template browser dialog */}
      <SkillTemplateBrowser
        businessId={businessId}
        agentId={agentId}
        onSkillAdded={fetchSkills}
        open={templateBrowserOpen}
        onOpenChange={setTemplateBrowserOpen}
      />

      {/* GitHub import dialog */}
      <GitHubImportDialog
        businessId={businessId}
        agentId={agentId}
        onImported={fetchSkills}
        open={githubImportOpen}
        onOpenChange={setGithubImportOpen}
      />
    </div>
  );
}
