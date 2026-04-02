"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Plus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  getDepartmentSkillsAction,
  listSkillsForBusinessAction,
  assignSkillAction,
  unassignSkillAction,
} from "@/_actions/skill-actions";
import type { Skill } from "@fleet-factory/core";

interface DepartmentSkillsPanelProps {
  businessId: string;
  departmentId: string;
  departmentName: string;
}

interface DeptSkill extends Skill {
  assignment_id: string;
}

/**
 * Department-level skill assignment panel.
 * Shows assigned skills with add/remove capability.
 * Skills assigned here are inherited by all agents in the department.
 */
export function DepartmentSkillsPanel({
  businessId,
  departmentId,
  departmentName,
}: DepartmentSkillsPanelProps) {
  const [deptSkills, setDeptSkills] = useState<DeptSkill[]>([]);
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [confirmUnassign, setConfirmUnassign] = useState<DeptSkill | null>(null);
  const [pendingAction, setPendingAction] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const [deptResult, allResult] = await Promise.all([
      getDepartmentSkillsAction(departmentId),
      listSkillsForBusinessAction(businessId),
    ]);

    if ("skills" in deptResult) {
      setDeptSkills(deptResult.skills);
    }
    if ("skills" in allResult) {
      setAllSkills(allResult.skills);
    }

    setLoading(false);
  }, [departmentId, businessId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Skills available to add (in business library but not assigned to this department)
  const availableSkills = allSkills.filter(
    (s) => !deptSkills.some((ds) => ds.id === s.id),
  );

  async function handleAssign(skillId: string) {
    setAdding(false);
    setPendingAction(true);

    const result = await assignSkillAction(skillId, businessId, {
      department_id: departmentId,
    });

    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Skill assigned to department");
      const skill = allSkills.find((s) => s.id === skillId);
      if (skill) {
        setDeptSkills((prev) => [
          ...prev,
          { ...skill, assignment_id: result.assignment.id },
        ]);
      }
    }

    setPendingAction(false);
  }

  async function handleUnassign() {
    if (!confirmUnassign) return;
    setPendingAction(true);

    const result = await unassignSkillAction(confirmUnassign.assignment_id, businessId);

    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Skill removed from department");
      setDeptSkills((prev) => prev.filter((s) => s.id !== confirmUnassign.id));
    }

    setPendingAction(false);
    setConfirmUnassign(null);
  }

  if (loading) {
    return (
      <div className="pt-2">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t pt-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium">Department Skills</h4>
          <Badge variant="secondary" className="text-xs">
            {deptSkills.length}
          </Badge>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAdding(true)}
          disabled={availableSkills.length === 0 || pendingAction}
        >
          <Plus className="mr-1 size-3" />
          Add Skill
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Skills assigned here are inherited by all agents in {departmentName}.
      </p>

      {deptSkills.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          No skills assigned to this department.
        </p>
      ) : (
        <div className="space-y-1">
          {deptSkills.map((skill) => (
            <div
              key={skill.id}
              className="flex items-center justify-between rounded-md border px-3 py-1.5"
            >
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium truncate block">
                  {skill.name}
                </span>
                {skill.description && (
                  <span className="text-xs text-muted-foreground truncate block">
                    {skill.description}
                  </span>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="size-7 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmUnassign(skill)}
                disabled={pendingAction}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add skill selector */}
      {adding && availableSkills.length > 0 && (
        <div className="flex items-center gap-2">
          <Select
            onValueChange={(v: string | null) => {
              if (v) handleAssign(v);
            }}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select a skill..." />
            </SelectTrigger>
            <SelectContent>
              {availableSkills.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
            Cancel
          </Button>
        </div>
      )}

      {/* Unassign confirmation dialog */}
      <Dialog
        open={confirmUnassign !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmUnassign(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Department Skill</DialogTitle>
            <DialogDescription>
              Remove <strong>{confirmUnassign?.name}</strong> from{" "}
              {departmentName}? Agents in this department will no longer inherit
              this skill.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmUnassign(null)}
              disabled={pendingAction}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleUnassign}
              disabled={pendingAction}
            >
              {pendingAction ? (
                <>
                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
