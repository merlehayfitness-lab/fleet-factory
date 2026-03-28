"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


interface Department {
  id: string;
  name: string;
  type: string;
  agentCount: number;
  hasLead: boolean;
}

interface WizardBasicInfoStepProps {
  departments: Department[];
  agentName: string;
  departmentId: string;
  role: string;
  onNameChange: (name: string) => void;
  onDepartmentChange: (id: string) => void;
  onRoleChange: (role: string) => void;
}

/**
 * Wizard Step 1: Basic Info.
 *
 * Collects agent name, department (with agent count badges and
 * sub-agent detection), and optional role description.
 */
export function WizardBasicInfoStep({
  departments,
  agentName,
  departmentId,
  role,
  onNameChange,
  onDepartmentChange,
  onRoleChange,
}: WizardBasicInfoStepProps) {
  const selectedDept = departments.find((d) => d.id === departmentId);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Basic Information</h2>
        <p className="text-sm text-muted-foreground">
          Name the agent and assign it to a department.
        </p>
      </div>

      {/* Agent name */}
      <div className="space-y-2">
        <Label htmlFor="agent-name">
          Agent Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="agent-name"
          placeholder="e.g., Sales Outreach Bot"
          value={agentName}
          onChange={(e) => onNameChange(e.target.value)}
          autoFocus
        />
      </div>

      {/* Department selector */}
      <div className="space-y-2">
        <Label htmlFor="department">
          Department <span className="text-destructive">*</span>
        </Label>
        <select
          id="department"
          value={departmentId}
          onChange={(e) => onDepartmentChange(e.target.value)}
          className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">Select a department</option>
          {departments.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {dept.name}
              {dept.agentCount > 0
                ? ` (${dept.agentCount} agent${dept.agentCount !== 1 ? "s" : ""})`
                : ""}
            </option>
          ))}
        </select>

        {/* Sub-agent info */}
        {selectedDept?.hasLead && (
          <p className="rounded-md border border-blue-200 bg-blue-50/50 px-3 py-2 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/10 dark:text-blue-200">
            This department already has a lead agent. The new agent will be
            created as a sub-agent.
          </p>
        )}
      </div>

      {/* Role */}
      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <Input
          id="role"
          placeholder="e.g., Paid Ads Specialist"
          value={role}
          onChange={(e) => onRoleChange(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          A short descriptor for the agent&apos;s position within the
          department (optional).
        </p>
      </div>
    </div>
  );
}
