"use client";

import type React from "react";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { AgentTreeDepartment } from "@/_components/agent-tree-department";
import { AgentTreeNode } from "@/_components/agent-tree-node";
import { AgentTreeLines } from "@/_components/agent-tree-lines";
import { AgentTreeSidebar } from "@/_components/agent-tree-sidebar";
import { reparentAgentAction } from "@/_actions/agent-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface OrgChartNode {
  id: string;
  name: string;
  role: string | null;
  status: string;
  type: "root" | "lead" | "sub-agent";
  departmentName: string | null;
  departmentType: string | null;
  departmentId: string | null;
  model_profile: Record<string, unknown>;
  skill_count: number;
  isCollapsed: boolean;
  children: OrgChartNode[];
}

interface ConnectionGroup {
  parentId: string;
  childIds: string[];
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
  businessName: string;
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
    case "active":
      return "bg-green-500";
    case "paused":
    case "frozen":
      return "bg-amber-500";
    case "error":
    case "retired":
      return "bg-red-500";
    case "provisioning":
      return "bg-blue-500";
    default:
      return "bg-muted-foreground";
  }
}

/**
 * Recursively search the org chart tree for a node by ID.
 */
function findNodeInTree(
  node: OrgChartNode,
  targetId: string,
): OrgChartNode | null {
  if (node.id === targetId) return node;
  for (const child of node.children) {
    const found = findNodeInTree(child, targetId);
    if (found) return found;
  }
  return null;
}

/**
 * Build a unified org chart tree from flat agent/department data.
 *
 * 1. Owner department's lead agent becomes the ROOT node.
 * 2. Other departments' lead agents become children of root.
 * 3. Sub-agents become children of their parent leads.
 * 4. If no Owner lead exists, a synthetic root is created.
 */
function buildOrgChart(
  agents: AgentTreeViewProps["agents"],
  departments: AgentTreeViewProps["departments"],
  businessName: string,
  collapsed: Record<string, boolean>,
): OrgChartNode {
  // Build sub-agent map: parentId -> children agents
  const subsByParent = new Map<string, AgentTreeViewProps["agents"]>();
  for (const agent of agents) {
    if (agent.parent_agent_id) {
      if (!subsByParent.has(agent.parent_agent_id))
        subsByParent.set(agent.parent_agent_id, []);
      subsByParent.get(agent.parent_agent_id)!.push(agent);
    }
  }

  // Convert flat agent to OrgChartNode (recursively includes sub-agents)
  function toOrgNode(
    a: AgentTreeViewProps["agents"][number],
    type: "lead" | "sub-agent",
  ): OrgChartNode {
    const subs = subsByParent.get(a.id) ?? [];
    return {
      id: a.id,
      name: a.name,
      role: a.role,
      status: a.status,
      type,
      departmentName: a.departments?.name ?? null,
      departmentType: a.departments?.type ?? null,
      departmentId: a.departments?.id ?? null,
      model_profile: a.model_profile,
      skill_count: a.skill_count,
      isCollapsed: collapsed[a.id] ?? false,
      children: subs.map((s) => toOrgNode(s, "sub-agent")),
    };
  }

  // Group lead agents by department
  const leadsByDept = new Map<string, AgentTreeViewProps["agents"]>();
  for (const agent of agents) {
    if (!agent.parent_agent_id && agent.departments) {
      const deptId = agent.departments.id;
      if (!leadsByDept.has(deptId)) leadsByDept.set(deptId, []);
      leadsByDept.get(deptId)!.push(agent);
    }
  }

  // Find owner department
  const ownerDept = departments.find((d) => d.type === "owner");
  const ownerLeads = ownerDept ? (leadsByDept.get(ownerDept.id) ?? []) : [];
  const ownerLead = ownerLeads[0]; // Primary owner lead

  // Sort non-owner departments by defined order
  const otherDepts = departments
    .filter((d) => d.type !== "owner")
    .sort(
      (a, b) =>
        (DEPARTMENT_ORDER[a.type] ?? 99) - (DEPARTMENT_ORDER[b.type] ?? 99),
    );

  // Build children of root: other department leads + owner sub-agents
  const rootChildren: OrgChartNode[] = [];

  // Owner's sub-agents (if owner lead exists, its subs are siblings of other dept leads)
  if (ownerLead) {
    const ownerSubs = subsByParent.get(ownerLead.id) ?? [];
    for (const sub of ownerSubs) {
      rootChildren.push(toOrgNode(sub, "sub-agent"));
    }
  }

  // Additional owner leads (beyond the first) as children
  for (let i = 1; i < ownerLeads.length; i++) {
    rootChildren.push(toOrgNode(ownerLeads[i], "lead"));
  }

  // Other department leads as children of root
  for (const dept of otherDepts) {
    const leads = leadsByDept.get(dept.id) ?? [];
    for (const lead of leads) {
      rootChildren.push(toOrgNode(lead, "lead"));
    }
  }

  // Create root node
  if (ownerLead) {
    return {
      id: ownerLead.id,
      name: ownerLead.name,
      role: ownerLead.role,
      status: ownerLead.status,
      type: "root",
      departmentName: ownerDept?.name ?? null,
      departmentType: "owner",
      departmentId: ownerDept?.id ?? null,
      model_profile: ownerLead.model_profile,
      skill_count: ownerLead.skill_count,
      isCollapsed: collapsed[ownerLead.id] ?? false,
      children: rootChildren,
    };
  }

  // Synthetic root when no owner lead exists
  return {
    id: "root",
    name: businessName,
    role: "Root",
    status: "active",
    type: "root",
    departmentName: null,
    departmentType: null,
    departmentId: null,
    model_profile: {},
    skill_count: 0,
    isCollapsed: collapsed["root"] ?? false,
    children: rootChildren,
  };
}

/**
 * Compute connection groups by walking the OrgChartNode tree recursively.
 */
function computeConnectionGroups(node: OrgChartNode): ConnectionGroup[] {
  const groups: ConnectionGroup[] = [];
  if (!node.isCollapsed && node.children.length > 0) {
    groups.push({
      parentId: node.id,
      childIds: node.children.map((c) => c.id),
    });
    for (const child of node.children) {
      groups.push(...computeConnectionGroups(child));
    }
  }
  return groups;
}

/**
 * Main tree container with unified org chart layout, collapse state,
 * SVG elbow connector overlay, responsive mobile fallback, and right sidebar panel.
 */
export function AgentTreeView({
  agents,
  departments,
  businessId,
  businessName,
}: AgentTreeViewProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  // Client-side hydration guard for DndContext
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

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
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Drag-and-drop state
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [isReparenting, setIsReparenting] = useState(false);

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

  // Build unified org chart tree
  const rootNode = useMemo(
    () => buildOrgChart(agents, departments, businessName, collapsed),
    [agents, departments, businessName, collapsed],
  );

  // Compute connection groups from tree
  const connectionGroups = useMemo(
    () => computeConnectionGroups(rootNode),
    [rootNode],
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

  // Recalculate positions after render and on resize
  useEffect(() => {
    function recalculate() {
      if (!containerRef.current) return;
      setContainerRect(containerRef.current.getBoundingClientRect());

      const nodes = containerRef.current.querySelectorAll("[data-node-id]");
      const newPositions = new Map<string, DOMRect>();
      nodes.forEach((node) => {
        const id = (node as HTMLElement).dataset.nodeId;
        if (id) newPositions.set(id, node.getBoundingClientRect());
      });
      nodeRefs.current = newPositions;
      setPositionVersion((v) => v + 1);
    }

    const timer = setTimeout(recalculate, 50);

    const observer = new ResizeObserver(recalculate);
    if (containerRef.current) observer.observe(containerRef.current);

    window.addEventListener("resize", recalculate);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener("resize", recalculate);
    };
  }, [collapsed, agents.length]);

  // Node select: open sidebar
  const handleSelectNode = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // Drag-and-drop handlers
  const draggedNode = useMemo(
    () => (activeDragId ? findNodeInTree(rootNode, activeDragId) : null),
    [activeDragId, rootNode],
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const agentId = active.id as string;
    const targetId = over.id as string;

    // Find the drop target in the tree
    const targetNode = findNodeInTree(rootNode, targetId);
    if (!targetNode) return;

    // Only allow dropping on root or lead nodes (not sub-agents)
    if (targetNode.type === "sub-agent") return;

    const draggedName =
      findNodeInTree(rootNode, agentId)?.name ?? "Agent";
    const targetLabel =
      targetNode.type === "root"
        ? targetNode.name
        : `under ${targetNode.name}`;

    toast(`Move ${draggedName} to ${targetLabel}?`, {
      action: {
        label: "Confirm",
        onClick: async () => {
          setIsReparenting(true);
          const newParentId =
            targetNode.type === "root" ? null : targetId;
          const newDeptId =
            targetNode.departmentId ?? "";
          const result = await reparentAgentAction(
            agentId,
            businessId,
            newParentId,
            newDeptId,
          );
          setIsReparenting(false);
          if (result?.error) {
            toast.error(result.error);
          } else {
            toast.success(`${draggedName} moved successfully`);
          }
        },
      },
      cancel: {
        label: "Cancel",
        onClick: () => {},
      },
      duration: 5000,
    });
  }

  // Selected node for sidebar
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return findNodeInTree(rootNode, selectedNodeId);
  }, [selectedNodeId, rootNode]);

  /**
   * Recursively render a node and its children as a centered tree.
   */
  function renderNode(node: OrgChartNode, depth: number): React.JSX.Element {
    return (
      <div key={node.id} className="flex flex-col items-center">
        {/* Department label above leads (subtle, not a full-width bar) */}
        {node.type === "lead" && node.departmentName && (
          <AgentTreeDepartment name={node.departmentName} />
        )}

        {/* The node box */}
        <AgentTreeNode
          node={node}
          businessId={businessId}
          onSelect={handleSelectNode}
          onToggleCollapse={() => toggleCollapse(node.id)}
          registerRef={registerNodeRef}
        />

        {/* Children row */}
        {!node.isCollapsed && node.children.length > 0 && (
          <div className="mt-10 flex items-start justify-center gap-10">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  /**
   * Flatten the org tree for mobile accordion: group by department.
   */
  function getMobileDepartments(): Array<{
    name: string;
    id: string;
    agents: OrgChartNode[];
  }> {
    const deptMap = new Map<string, { name: string; id: string; agents: OrgChartNode[] }>();

    function collectAgents(node: OrgChartNode) {
      if (node.type === "lead" || node.type === "sub-agent") {
        const deptKey = node.departmentId ?? "other";
        if (!deptMap.has(deptKey)) {
          deptMap.set(deptKey, {
            name: node.departmentName ?? "Other",
            id: deptKey,
            agents: [],
          });
        }
        deptMap.get(deptKey)!.agents.push(node);
      }
      for (const child of node.children) {
        collectAgents(child);
      }
    }

    // Include the root itself if it represents a real agent
    if (rootNode.type === "root" && rootNode.id !== "root") {
      const deptKey = rootNode.departmentId ?? "owner";
      deptMap.set(deptKey, {
        name: rootNode.departmentName ?? "Owner",
        id: deptKey,
        agents: [rootNode],
      });
    }

    for (const child of rootNode.children) {
      collectAgents(child);
    }

    return Array.from(deptMap.values());
  }

  if (departments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
        <p className="text-sm text-muted-foreground">No departments found.</p>
      </div>
    );
  }

  const sidebarIsOpen = selectedNode !== null;

  return (
    <>
      {/* Mobile: accordion list view */}
      {isMobile && (
        <div className="space-y-4">
          {getMobileDepartments().map((dept) => (
            <div key={dept.id} className="rounded-lg border">
              <button
                onClick={() => toggleCollapse(dept.id)}
                className="flex w-full items-center justify-between p-3 font-semibold"
              >
                <span className="uppercase tracking-wide">{dept.name}</span>
                <span className="text-xs text-muted-foreground">
                  {dept.agents.length}{" "}
                  {dept.agents.length === 1 ? "agent" : "agents"}
                </span>
              </button>
              {!collapsed[dept.id] && (
                <div className="space-y-1 px-3 pb-3">
                  {dept.agents.map((agent) => (
                    <div key={agent.id}>
                      <button
                        onClick={() => handleSelectNode(agent.id)}
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                      >
                        <span
                          className={cn(
                            "size-2 rounded-full",
                            statusColor(agent.status),
                          )}
                        />
                        <span className="truncate">{agent.name}</span>
                        {agent.role && (
                          <span className="text-muted-foreground">
                            ({agent.role})
                          </span>
                        )}
                      </button>
                      {agent.children.length > 0 && (
                        <div className="ml-4 space-y-1 border-l-2 border-muted pl-3">
                          {agent.children.map((child) => (
                            <button
                              key={child.id}
                              onClick={() => handleSelectNode(child.id)}
                              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                            >
                              <span
                                className={cn(
                                  "size-2 rounded-full",
                                  statusColor(child.status),
                                )}
                              />
                              <span className="truncate">{child.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Desktop: full org chart with DnD and elbow connectors */}
      {!isMobile && isClient && (
        <DndContext
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div
            className="relative flex justify-center overflow-x-auto py-8"
            ref={containerRef}
          >
            <AgentTreeLines
              nodePositions={nodeRefs.current}
              connectionGroups={connectionGroups}
              containerRect={containerRect}
            />
            {renderNode(rootNode, 0)}
          </div>

          <DragOverlay>
            {draggedNode && (
              <div className="flex min-w-[140px] max-w-[180px] flex-col items-center gap-1 rounded-lg border bg-popover px-4 py-3 text-center shadow-lg">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    statusColor(draggedNode.status),
                  )}
                />
                <p className="text-sm font-semibold">{draggedNode.name}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* SSR / pre-hydration placeholder */}
      {!isMobile && !isClient && (
        <div className="flex justify-center py-12">
          <p className="text-sm text-muted-foreground">
            Loading org chart...
          </p>
        </div>
      )}

      {/* Right sidebar panel */}
      <AgentTreeSidebar
        selectedNode={selectedNode}
        businessId={businessId}
        isOpen={sidebarIsOpen}
        onClose={handleCloseSidebar}
      />
    </>
  );
}
