"use client";

import { Badge } from "@/components/ui/badge";
import { AgentCard } from "@/_components/agent-card";

/** Department ordering for consistent display. */
const DEPARTMENT_ORDER: Record<string, number> = {
  owner: 0,
  sales: 1,
  support: 2,
  operations: 3,
};

interface Agent {
  id: string;
  name: string;
  status: string;
  system_prompt: string;
  tool_profile: Record<string, unknown>;
  model_profile: Record<string, unknown>;
  created_at: string;
  departments: { id: string; name: string; type: string } | null;
  agent_templates: { id: string; name: string } | null;
}

interface AgentsListProps {
  agents: Agent[];
  businessId: string;
}

/**
 * Agents grouped by department in a responsive card grid.
 *
 * Departments are ordered: owner, sales, support, operations, then custom.
 */
export function AgentsList({ agents, businessId }: AgentsListProps) {
  // Group agents by department name
  const grouped = new Map<string, { type: string; agents: Agent[] }>();

  for (const agent of agents) {
    const deptName = agent.departments?.name ?? "Unassigned";
    const deptType = agent.departments?.type ?? "custom";

    if (!grouped.has(deptName)) {
      grouped.set(deptName, { type: deptType, agents: [] });
    }
    grouped.get(deptName)!.agents.push(agent);
  }

  // Sort departments by type order
  const sortedDepts = Array.from(grouped.entries()).sort(([, a], [, b]) => {
    const orderA = DEPARTMENT_ORDER[a.type] ?? 99;
    const orderB = DEPARTMENT_ORDER[b.type] ?? 99;
    return orderA - orderB;
  });

  return (
    <div className="space-y-8">
      {sortedDepts.map(([deptName, { agents: deptAgents }]) => (
        <section key={deptName}>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-lg font-semibold">{deptName}</h2>
            <Badge variant="secondary">{deptAgents.length}</Badge>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {deptAgents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} businessId={businessId} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
