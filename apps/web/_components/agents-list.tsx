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
  role: string | null;
  parent_agent_id: string | null;
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
 * Agents grouped by department with lead/sub-agent hierarchy.
 *
 * Departments are ordered: owner, sales, support, operations, then custom.
 * Within each department, lead agents (no parent) are shown first,
 * with sub-agents indented below their parent lead.
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
      {sortedDepts.map(([deptName, { agents: deptAgents }]) => {
        // Separate leads (no parent) and sub-agents
        const leads = deptAgents.filter((a) => !a.parent_agent_id);
        const subAgents = deptAgents.filter((a) => !!a.parent_agent_id);

        // Build a map: parentId -> sub-agents
        const subsByParent = new Map<string, Agent[]>();
        for (const sub of subAgents) {
          const parentId = sub.parent_agent_id!;
          if (!subsByParent.has(parentId)) {
            subsByParent.set(parentId, []);
          }
          subsByParent.get(parentId)!.push(sub);
        }

        // Orphaned sub-agents (parent not in this department)
        const orphans = subAgents.filter(
          (sub) => !leads.some((lead) => lead.id === sub.parent_agent_id),
        );

        return (
          <section key={deptName}>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-lg font-semibold">{deptName}</h2>
              <Badge variant="secondary">{deptAgents.length}</Badge>
            </div>
            <div className="space-y-2">
              {leads.map((lead) => {
                const children = subsByParent.get(lead.id) ?? [];
                return (
                  <div key={lead.id}>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <AgentCard
                        agent={lead}
                        businessId={businessId}
                        role={lead.role}
                      />
                    </div>
                    {children.length > 0 && (
                      <div className="mt-2 border-l-2 border-muted pl-6">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {children.map((child) => (
                            <AgentCard
                              key={child.id}
                              agent={child}
                              businessId={businessId}
                              role={child.role}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Orphaned sub-agents shown flat */}
              {orphans.length > 0 && leads.length > 0 && (
                <div className="mt-2 border-l-2 border-muted pl-6">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {orphans.map((orphan) => (
                      <AgentCard
                        key={orphan.id}
                        agent={orphan}
                        businessId={businessId}
                        role={orphan.role}
                      />
                    ))}
                  </div>
                </div>
              )}
              {/* If all agents are sub-agents (no lead), show flat */}
              {leads.length === 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {deptAgents.map((agent) => (
                    <AgentCard
                      key={agent.id}
                      agent={agent}
                      businessId={businessId}
                      role={agent.role}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
