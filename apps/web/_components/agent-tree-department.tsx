"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";

interface TreeDepartment {
  id: string;
  name: string;
  type: string;
  leads: Array<{
    id: string;
    name: string;
    status: string;
    role: string | null;
    parent_agent_id: string | null;
    model_profile: Record<string, unknown>;
    skill_count: number;
    children: Array<unknown>;
    isCollapsed: boolean;
  }>;
  isCollapsed: boolean;
}

interface AgentTreeDepartmentProps {
  department: TreeDepartment;
  businessId: string;
  agentCount: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  registerRef: (nodeId: string, el: HTMLElement | null) => void;
}

/**
 * Bold header node for a department in the agent tree.
 * Shows department name, agent count, collapse chevron, and '+' button.
 */
export function AgentTreeDepartment({
  department,
  businessId,
  agentCount,
  isCollapsed,
  onToggleCollapse,
  registerRef,
}: AgentTreeDepartmentProps) {
  const router = useRouter();

  const refCallback = useCallback(
    (el: HTMLElement | null) => {
      registerRef(department.id, el);
    },
    [department.id, registerRef],
  );

  const handleAdd = useCallback(() => {
    router.push(
      `/businesses/${businessId}/agents/new?departmentId=${department.id}`,
    );
  }, [businessId, department.id, router]);

  return (
    <div
      ref={refCallback}
      data-node-id={department.id}
      className="group relative z-10 flex items-center gap-3 rounded-lg border-2 border-foreground/20 bg-muted/50 px-4 py-3"
    >
      {/* Collapse chevron */}
      <button
        onClick={onToggleCollapse}
        className="inline-flex items-center text-muted-foreground hover:text-foreground"
      >
        {isCollapsed ? (
          <ChevronRight className="size-4" />
        ) : (
          <ChevronDown className="size-4" />
        )}
      </button>

      {/* Department name */}
      <span className="text-base font-bold uppercase tracking-wide">
        {department.name}
      </span>

      {/* Agent count badge */}
      <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs font-medium text-muted-foreground">
        {agentCount} {agentCount === 1 ? "agent" : "agents"}
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Add agent button */}
      <button
        onClick={handleAdd}
        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-primary hover:text-primary-foreground group-hover:opacity-100"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
