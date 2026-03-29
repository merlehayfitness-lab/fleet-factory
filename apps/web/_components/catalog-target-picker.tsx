"use client";

interface Department {
  id: string;
  name: string;
  type: string;
}

interface Agent {
  id: string;
  name: string;
  department_id: string;
}

interface CatalogTargetPickerProps {
  departments: Department[];
  agents: Agent[];
  selectedDepartments: string[];
  selectedAgents: string[];
  onDepartmentsChange: (ids: string[]) => void;
  onAgentsChange: (ids: string[]) => void;
}

const DEPARTMENT_COLORS: Record<string, string> = {
  owner: "border-l-purple-500",
  sales: "border-l-blue-500",
  support: "border-l-green-500",
  operations: "border-l-orange-500",
  custom: "border-l-gray-500",
};

/**
 * Multi-select picker for departments and agents as assignment targets.
 * Groups agents under their departments with checkboxes for both levels.
 */
export function CatalogTargetPicker({
  departments,
  agents,
  selectedDepartments,
  selectedAgents,
  onDepartmentsChange,
  onAgentsChange,
}: CatalogTargetPickerProps) {
  const totalSelected = selectedDepartments.length + selectedAgents.length;

  function toggleDepartment(deptId: string) {
    if (selectedDepartments.includes(deptId)) {
      onDepartmentsChange(selectedDepartments.filter((id) => id !== deptId));
    } else {
      onDepartmentsChange([...selectedDepartments, deptId]);
    }
  }

  function toggleAgent(agentId: string) {
    if (selectedAgents.includes(agentId)) {
      onAgentsChange(selectedAgents.filter((id) => id !== agentId));
    } else {
      onAgentsChange([...selectedAgents, agentId]);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground">
        Select departments or individual agents
      </p>

      <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
        {departments.map((dept) => {
          const deptAgents = agents.filter(
            (a) => a.department_id === dept.id
          );
          const borderColor =
            DEPARTMENT_COLORS[dept.type] ?? DEPARTMENT_COLORS.custom;

          return (
            <div key={dept.id} className="space-y-0.5">
              {/* Department row */}
              <label
                className={`flex cursor-pointer items-center gap-2 rounded-md border-l-4 px-3 py-2 transition-colors hover:bg-accent/50 ${borderColor}`}
              >
                <input
                  type="checkbox"
                  checked={selectedDepartments.includes(dept.id)}
                  onChange={() => toggleDepartment(dept.id)}
                  className="size-4 rounded border-border"
                />
                <span className="text-sm font-medium">
                  Entire {dept.name} Department
                </span>
              </label>

              {/* Agent rows */}
              {deptAgents.map((agent) => (
                <label
                  key={agent.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md py-1.5 pl-10 pr-3 transition-colors hover:bg-accent/30"
                >
                  <input
                    type="checkbox"
                    checked={selectedAgents.includes(agent.id)}
                    onChange={() => toggleAgent(agent.id)}
                    className="size-3.5 rounded border-border"
                  />
                  <span className="text-xs text-muted-foreground">
                    {agent.name}
                  </span>
                </label>
              ))}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        {totalSelected} target{totalSelected !== 1 ? "s" : ""} selected
      </p>
    </div>
  );
}
