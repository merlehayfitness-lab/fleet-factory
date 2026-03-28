"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { assignSkillAction, unassignSkillAction } from "@/_actions/skill-actions";
import type { Skill, SkillWithAssignment } from "@agency-factory/core";

interface SkillAssignmentListProps {
  businessId: string;
  agentId: string;
  departmentId: string;
  initialSkills: SkillWithAssignment[];
  allBusinessSkills: Skill[];
  onSkillClick?: (skill: Skill) => void;
  onAssignmentChange?: () => void;
}

/**
 * Checkbox list for assigning/unassigning skills to an agent.
 * Department-inherited skills show "Inherited" badge with disabled checkbox.
 * Unassigning requires confirmation dialog.
 */
export function SkillAssignmentList({
  businessId,
  agentId,
  departmentId,
  initialSkills,
  allBusinessSkills,
  onSkillClick,
  onAssignmentChange,
}: SkillAssignmentListProps) {
  const [skills, setSkills] = useState(initialSkills);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [confirmUnassign, setConfirmUnassign] = useState<{
    assignmentId: string;
    skillName: string;
  } | null>(null);

  if (allBusinessSkills.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8">
        <p className="text-sm text-muted-foreground">
          No skills in library. Create one to get started.
        </p>
      </div>
    );
  }

  // Build a map of assigned skills for this agent
  const assignedMap = new Map<string, SkillWithAssignment>();
  for (const s of skills) {
    assignedMap.set(s.id, s);
  }

  async function handleAssign(skillId: string) {
    setPendingAction(skillId);
    const result = await assignSkillAction(skillId, businessId, {
      agent_id: agentId,
    });

    if ("error" in result) {
      toast.error(result.error);
    } else {
      // Find the full skill from business skills
      const fullSkill = allBusinessSkills.find((s) => s.id === skillId);
      if (fullSkill) {
        setSkills((prev) => [
          ...prev,
          {
            ...fullSkill,
            assignment_level: "agent" as const,
            assignment_id: result.assignment.id,
          },
        ]);
      }
      toast.success("Skill assigned");
      onAssignmentChange?.();
    }
    setPendingAction(null);
  }

  async function handleUnassign() {
    if (!confirmUnassign) return;

    setPendingAction(confirmUnassign.assignmentId);
    const result = await unassignSkillAction(
      confirmUnassign.assignmentId,
      businessId,
    );

    if ("error" in result) {
      toast.error(result.error);
    } else {
      setSkills((prev) =>
        prev.filter((s) => s.assignment_id !== confirmUnassign.assignmentId),
      );
      toast.success("Skill unassigned");
      onAssignmentChange?.();
    }
    setPendingAction(null);
    setConfirmUnassign(null);
  }

  function handleCheckboxChange(skill: Skill) {
    const assigned = assignedMap.get(skill.id);

    if (assigned) {
      // Already assigned -- unassign (with confirmation)
      if (assigned.assignment_level === "department") {
        // Cannot unassign department-inherited skills
        return;
      }
      setConfirmUnassign({
        assignmentId: assigned.assignment_id,
        skillName: skill.name,
      });
    } else {
      // Not assigned -- assign
      handleAssign(skill.id);
    }
  }

  return (
    <>
      <div className="space-y-1">
        {allBusinessSkills.map((skill) => {
          const assigned = assignedMap.get(skill.id);
          const isChecked = Boolean(assigned);
          const isInherited = assigned?.assignment_level === "department";
          const isPending = pendingAction === skill.id || pendingAction === assigned?.assignment_id;

          return (
            <div
              key={skill.id}
              className="flex items-center gap-3 rounded-md border px-3 py-2 hover:bg-muted/50"
            >
              <input
                type="checkbox"
                checked={isChecked}
                disabled={isInherited || isPending}
                onChange={() => handleCheckboxChange(skill)}
                className="size-4 rounded border-input accent-primary disabled:cursor-not-allowed disabled:opacity-50"
              />
              <div className="flex-1 min-w-0">
                <button
                  type="button"
                  className="text-sm font-medium text-left hover:underline truncate block"
                  onClick={() => onSkillClick?.(skill)}
                >
                  {skill.name}
                </button>
                {skill.description && (
                  <p className="text-xs text-muted-foreground truncate">
                    {skill.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {isInherited && (
                  <Badge variant="outline" className="text-xs">
                    Inherited
                  </Badge>
                )}
                <Badge variant="secondary" className="text-xs">
                  {skill.source_type}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  v{skill.version}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation dialog for unassign */}
      <Dialog
        open={confirmUnassign !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmUnassign(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Skill</DialogTitle>
            <DialogDescription>
              Remove <strong>{confirmUnassign?.skillName}</strong> from this
              agent? The skill will remain in your library.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmUnassign(null)}
              disabled={pendingAction !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleUnassign}
              disabled={pendingAction !== null}
            >
              {pendingAction ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
