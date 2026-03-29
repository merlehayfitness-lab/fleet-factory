"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AgentTreeDepartment } from "@/_components/agent-tree-department";
import { AgentTreeNode } from "@/_components/agent-tree-node";
import { AgentTreeLines } from "@/_components/agent-tree-lines";

interface TreeAgent {
  id: string;
  name: string;
  status: string;
  role: string | null;
  parent_agent_id: string | null;
  model_profile: Record<string, unknown>;
  skill_count: number;
  children: TreeAgent[];
  isCollapsed: boolean;
}

interface TreeDepartment {
  id: string;
  name: string;
  type: string;
  leads: TreeAgent[];
  isCollapsed: boolean;
}

interface AgentTreeViewProps {
  agents: Array<{
    id: string;
    name: string;
    status: string;
    role: string | null;
    parent_agent_id: string | null;
    model_profile: Record<string, unknown>;
    departments: { id: string; name: string; type: string } | null;
    skill_count: number;
  }>;
  departments: Array<{ id: string; name: string; type: string }>;
  businessId: string;
}

const DEPARTMENT_ORDER: Record<string, number> = {
  owner: 0,
  sales: 1,
  support: 2,
  operations: 3,
};

const COLLAPSE_KEY = (businessId: string) =>
  `agent-tree-collapse-${businessId}`;

function buildAgentTree(
  agents: AgentTreeViewProps["agents"],
  departments: AgentTreeViewProps["departments"],
  collapsed: Record<string, boolean>,
): TreeDepartment[] {
  // Group agents by department
  const byDept = new Map<string, AgentTreeViewProps["agents"]>();
  for (const agent of agents) {
    const deptId = agent.departments?.id ?? "unknown";
    if (!byDept.has(deptId)) byDept.set(deptId, []);
    byDept.get(deptId)!.push(agent);
  }

  // Build sub-agent map: parentId -> children
  const subsByParent = new Map<string, AgentTreeViewProps["agents"]>();
  for (const agent of agents) {
    if (agent.parent_agent_id) {
      if (!subsByParent.has(agent.parent_agent_id))
        subsByParent.set(agent.parent_agent_id, []);
      subsByParent.get(agent.parent_agent_id)!.push(agent);
    }
  }

  // Convert to TreeAgent with children
  function toTreeAgent(
    a: AgentTreeViewProps["agents"][number],
  ): TreeAgent {
    const subs = subsByParent.get(a.id) ?? [];
    return {
      id: a.id,
      name: a.name,
      status: a.status,
      role: a.role,
      parent_agent_id: a.parent_agent_id,
      model_profile: a.model_profile,
      skill_count: a.skill_count,
      isCollapsed: collapsed[a.id] ?? false,
      children: subs.map(toTreeAgent),
    };
  }

  // Build tree departments
  const treeDepts: TreeDepartment[] = departments.map((dept) => {
    const deptAgents = byDept.get(dept.id) ?? [];
    const leads = deptAgents
      .filter((a) => !a.parent_agent_id)
      .map(toTreeAgent);

    return {
      id: dept.id,
      name: dept.name,
      type: dept.type,
      leads,
      isCollapsed: collapsed[dept.id] ?? false,
    };
  });

  // Sort by department order
  treeDepts.sort(
    (a, b) =>
      (DEPARTMENT_ORDER[a.type] ?? 99) - (DEPARTMENT_ORDER[b.type] ?? 99),
  );

  return treeDepts;
}

/**
 * Main tree container with data transformation, collapse state, and SVG overlay.
 * Replaces AgentsList on the agents page.
 */
export function AgentTreeView({
  agents,
  departments,
  businessId,
}: AgentTreeViewProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  // Collapse state with localStorage persistence
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);
  const nodeRefs = useRef(new Map<string, DOMRect>());
  const [positionVersion, setPositionVersion] = useState(0);

  // Load collapse state from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(COLLAPSE_KEY(businessId));
      if (stored) setCollapsed(JSON.parse(stored));
    } catch {
      // Ignore parse errors
    }
  }, [businessId]);

  const toggleCollapse = useCallback(
    (nodeId: string) => {
      setCollapsed((prev) => {
        const next = { ...prev, [nodeId]: !prev[nodeId] };
        try {
          localStorage.setItem(COLLAPSE_KEY(businessId), JSON.stringify(next));
        } catch {
          // Ignore storage errors
        }
        return next;
      });
    },
    [businessId],
  );

  // Build tree data
  const treeDepartments = useMemo(
    () => buildAgentTree(agents, departments, collapsed),
    [agents, departments, collapsed],
  );

  // Register node refs for position tracking
  const registerNodeRef = useCallback(
    (nodeId: string, el: HTMLElement | null) => {
      if (el) {
        nodeRefs.current.set(nodeId, el.getBoundingClientRect());
      } else {
        nodeRefs.current.delete(nodeId);
      }
    },
    [],
  );

  // Compute connections from visible tree
  const connections = useMemo(() => {
    const conns: { parentId: string; childId: string }[] = [];
    for (const dept of treeDepartments) {
      if (dept.isCollapsed) continue;
      for (const lead of dept.leads) {
        // Department -> lead connection
        conns.push({ parentId: dept.id, childId: lead.id });
        if (!lead.isCollapsed) {
          for (const child of lead.children) {
            conns.push({ parentId: lead.id, childId: child.id });
          }
        }
      }
    }
    return conns;
  }, [treeDepartments]);

  // Recalculate positions after render and on resize
  useEffect(() => {
    function recalculate() {
      if (!containerRef.current) return;
      setContainerRect(containerRef.current.getBoundingClientRect());

      // Update all node positions
      const nodes = containerRef.current.querySelectorAll("[data-node-id]");
      const newPositions = new Map<string, DOMRect>();
      nodes.forEach((node) => {
        const id = (node as HTMLElement).dataset.nodeId;
        if (id) newPositions.set(id, node.getBoundingClientRect());
      });
      nodeRefs.current = newPositions;
      setPositionVersion((v) => v + 1);
    }

    // Initial calculation after paint
    const timer = setTimeout(recalculate, 50);

    // Watch for resizes
    const observer = new ResizeObserver(recalculate);
    if (containerRef.current) observer.observe(containerRef.current);

    window.addEventListener("resize", recalculate);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener("resize", recalculate);
    };
  }, [collapsed, agents.length]);

  const handleSelectAgent = useCallback(
    (agentId: string) => {
      router.push(`/businesses/${businessId}/agents/${agentId}`);
    },
    [businessId, router],
  );

  // Count total agents per department (leads + their children)
  function countAgentsInDept(dept: TreeDepartment): number {
    let count = 0;
    for (const lead of dept.leads) {
      count += 1 + lead.children.length;
    }
    return count;
  }

  if (departments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
        <p className="text-sm text-muted-foreground">No departments found.</p>
      </div>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <AgentTreeLines
        nodePositions={nodeRefs.current}
        connections={connections}
        containerRect={containerRect}
      />
      <div className="space-y-8">
        {treeDepartments.map((dept) => (
          <div key={dept.id}>
            <AgentTreeDepartment
              department={dept}
              businessId={businessId}
              agentCount={countAgentsInDept(dept)}
              isCollapsed={dept.isCollapsed}
              onToggleCollapse={() => toggleCollapse(dept.id)}
              registerRef={registerNodeRef}
            />
            {!dept.isCollapsed && (
              <div className="mt-4 flex flex-wrap justify-center gap-x-10 gap-y-6 pl-8">
                {dept.leads.map((lead) => (
                  <div key={lead.id} className="flex flex-col items-center">
                    <AgentTreeNode
                      agent={lead}
                      businessId={businessId}
                      departmentId={dept.id}
                      isLead={true}
                      isCollapsed={lead.isCollapsed}
                      childCount={lead.children.length}
                      onToggleCollapse={() => toggleCollapse(lead.id)}
                      onSelect={handleSelectAgent}
                      registerRef={registerNodeRef}
                    />
                    {!lead.isCollapsed && lead.children.length > 0 && (
                      <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-4">
                        {lead.children.map((child) => (
                          <AgentTreeNode
                            key={child.id}
                            agent={child}
                            businessId={businessId}
                            departmentId={dept.id}
                            isLead={false}
                            isCollapsed={false}
                            childCount={0}
                            onSelect={handleSelectAgent}
                            registerRef={registerNodeRef}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {dept.leads.length === 0 && (
                  <p className="py-4 text-xs text-muted-foreground">
                    No agents in this department
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
