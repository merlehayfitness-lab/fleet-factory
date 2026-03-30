"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AitmplTargetPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  agents: Array<{ id: string; name: string; department_name?: string }>;
  departments: Array<{ id: string; name: string }>;
  componentName: string;
  componentType: string;
  preselectedAgentId?: string;
  onConfirm: (target: { agentId?: string; departmentId?: string }) => void;
}

export function AitmplTargetPicker({
  open,
  onOpenChange,
  agents,
  departments,
  componentName,
  componentType,
  preselectedAgentId,
  onConfirm,
}: AitmplTargetPickerProps) {
  const [assignTo, setAssignTo] = useState<"agent" | "department">("agent");
  const [selectedAgentId, setSelectedAgentId] = useState(preselectedAgentId ?? "");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");

  const isMcp = componentType === "mcp";

  function handleConfirm() {
    if (assignTo === "agent" && selectedAgentId) {
      onConfirm({ agentId: selectedAgentId });
    } else if (assignTo === "department" && selectedDepartmentId) {
      onConfirm({ departmentId: selectedDepartmentId });
    }
  }

  const canConfirm =
    (assignTo === "agent" && selectedAgentId) ||
    (assignTo === "department" && selectedDepartmentId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign to...</DialogTitle>
          <DialogDescription>
            Choose where to assign &quot;{componentName}&quot;
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Radio selection */}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="assignTo"
                checked={assignTo === "agent"}
                onChange={() => setAssignTo("agent")}
              />
              Agent
            </label>
            {!isMcp && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="assignTo"
                  checked={assignTo === "department"}
                  onChange={() => setAssignTo("department")}
                />
                Department
              </label>
            )}
          </div>

          {/* Agent selector */}
          {assignTo === "agent" && (
            <Select
              value={selectedAgentId}
              onValueChange={(v) => v && setSelectedAgentId(v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an agent..." />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                    {a.department_name ? ` (${a.department_name})` : ""}
                    {a.id === preselectedAgentId ? " (pre-selected)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Department selector */}
          {assignTo === "department" && (
            <Select
              value={selectedDepartmentId}
              onValueChange={(v) => v && setSelectedDepartmentId(v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a department..." />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* MCP note */}
          {isMcp && (
            <p className="text-xs text-muted-foreground">
              MCP servers will be merged into the selected agent&apos;s tool profile.
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={!canConfirm} onClick={handleConfirm}>
              Confirm
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
