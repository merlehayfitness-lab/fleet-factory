"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AgentTreeDepartment } from "@/_components/agent-tree-department";
import { AgentTreeNode } from "@/_components/agent-tree-node";
import { AgentTreeLines } from "@/_components/agent-tree-lines";
import { AgentTreeSidebar } from "@/_components/agent-tree-sidebar";
import { cn } from "@/lib/utils";

export interface TreeAgent {
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

export interface TreeDepartment {
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

export function statusColor(status: string): string {
  switch (status) {
    case "active": return "bg-green-500";
    case "paused": case "frozen": return "bg-amber-500";
    case "error": case "retired": return "bg-red-500";
    case "provisioning": return "bg-blue-500";
    default: return "bg-muted-foreground";
  }
}

export function findAgentInTree(depts: TreeDepartment[], agentId: string): TreeAgent | null {
  for (const dept of depts) {
    for (const lead of dept.leads) {
      if (lead.id === agentId) return lead;
      const child = lead.children.find(c => c.id === agentId);
      if (child) return child;
    }
  }
  return null;
}

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
 * Main tree container with data transformation, collapse state, SVG overlay,
 * responsive mobile fallback, and right sidebar panel.
 */
export function AgentTreeView({
  agents,
  departments,
  businessId,
}: AgentTreeViewProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  // Responsive detection
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Collapse state with localStorage persistence
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);
  const nodeRefs = useRef(new Map<string, DOMRect>());
  const [positionVersion, setPositionVersion] = useState(0);

  // Sidebar state
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);

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

  // Agent select: open sidebar instead of navigating
  const handleSelectAgent = useCallback((agentId: string) => {
    setSelectedDeptId(null);
    setSelectedAgentId(agentId);
  }, []);

  const handleSelectDept = useCallback((deptId: string) => {
    setSelectedAgentId(null);
    setSelectedDeptId(deptId);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setSelectedAgentId(null);
    setSelectedDeptId(null);
  }, []);

  // Compute selected node data for sidebar
  const selectedAgent = useMemo(() => {
    if (!selectedAgentId) return null;
    return findAgentInTree(treeDepartments, selectedAgentId);
  }, [selectedAgentId, treeDepartments]);

  const selectedDepartment = useMemo(() => {
    if (!selectedDeptId) return null;
    const dept = treeDepartments.find(d => d.id === selectedDeptId);
    if (!dept) return null;
    let agentCount = 0;
    for (const lead of dept.leads) {
      agentCount += 1 + lead.children.length;
    }
    return { id: dept.id, name: dept.name, type: dept.type, agentCount };
  }, [selectedDeptId, treeDepartments]);

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

  const sidebarIsOpen = selectedAgent !== null || selectedDepartment !== null;

  return (
    <>
      {/* Mobile: accordion list view */}
      {isMobile && (
        <div className="space-y-4">
          {treeDepartments.map((dept) => {
            const agentCount = countAgentsInDept(dept);
            return (
              <div key={dept.id} className="rounded-lg border">
                <button
                  onClick={() => toggleCollapse(dept.id)}
                  className="flex w-full items-center justify-between p-3 font-semibold"
                >
                  <span className="uppercase tracking-wide">{dept.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {agentCount} {agentCount === 1 ? "agent" : "agents"}
                  </span>
                </button>
                {!dept.isCollapsed && (
                  <div className="px-3 pb-3 space-y-1">
                    {dept.leads.map((lead) => (
                      <div key={lead.id}>
                        <button
                          onClick={() => handleSelectAgent(lead.id)}
                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                        >
                          <span className={cn("size-2 rounded-full", statusColor(lead.status))} />
                          <span className="truncate">{lead.name}</span>
                          {lead.role && (
                            <span className="text-muted-foreground">({lead.role})</span>
                          )}
                        </button>
                        {lead.children.length > 0 && (
                          <div className="ml-4 border-l-2 border-muted pl-3 space-y-1">
                            {lead.children.map((child) => (
                              <button
                                key={child.id}
                                onClick={() => handleSelectAgent(child.id)}
                                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                              >
                                <span className={cn("size-2 rounded-full", statusColor(child.status))} />
                                <span className="truncate">{child.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    {dept.leads.length === 0 && (
                      <p className="py-2 text-xs text-muted-foreground">
                        No agents in this department
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Desktop: full tree with SVG lines */}
      {!isMobile && (
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
                  onSelect={() => handleSelectDept(dept.id)}
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
      )}

      {/* Right sidebar panel */}
      <AgentTreeSidebar
        selectedAgent={selectedAgent}
        selectedDepartment={selectedDepartment}
        businessId={businessId}
        isOpen={sidebarIsOpen}
        onClose={handleCloseSidebar}
      />
    </>
  );
}
