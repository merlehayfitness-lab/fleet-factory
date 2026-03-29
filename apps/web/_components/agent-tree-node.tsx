"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface AgentTreeNodeProps {
  agent: TreeAgent;
  businessId: string;
  departmentId: string;
  isLead: boolean;
  isCollapsed: boolean;
  childCount: number;
  onToggleCollapse?: () => void;
  onSelect: (agentId: string) => void;
  registerRef: (nodeId: string, el: HTMLElement | null) => void;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500",
  paused: "bg-amber-500",
  frozen: "bg-amber-500",
  error: "bg-red-500",
  retired: "bg-red-500",
  provisioning: "bg-blue-500",
};

/**
 * Compact pill node for an agent in the tree view.
 * Shows status dot (Slack-style), name, collapse chevron for leads, and '+' button.
 */
export function AgentTreeNode({
  agent,
  businessId,
  departmentId,
  isLead,
  isCollapsed,
  childCount,
  onToggleCollapse,
  onSelect,
  registerRef,
}: AgentTreeNodeProps) {
  const router = useRouter();

  const refCallback = useCallback(
    (el: HTMLElement | null) => {
      registerRef(agent.id, el);
    },
    [agent.id, registerRef],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // Don't trigger select if clicking chevron or plus button
      const target = e.target as HTMLElement;
      if (target.closest("[data-action]")) return;
      onSelect(agent.id);
    },
    [agent.id, onSelect],
  );

  const handleAddChild = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const params = new URLSearchParams({
        departmentId,
        parentAgentId: agent.id,
      });
      router.push(`/businesses/${businessId}/agents/new?${params.toString()}`);
    },
    [businessId, departmentId, agent.id, router],
  );

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleCollapse?.();
    },
    [onToggleCollapse],
  );

  const dotColor = STATUS_COLORS[agent.status] ?? "bg-muted-foreground";

  return (
    <div
      ref={refCallback}
      data-node-id={agent.id}
      onClick={handleClick}
      className={cn(
        "group relative z-10 inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors hover:bg-accent",
        isLead && "border-foreground/20",
      )}
    >
      {/* Status dot */}
      <span className={cn("size-2 shrink-0 rounded-full", dotColor)} />

      {/* Name */}
      <span className="max-w-[120px] truncate">{agent.name}</span>

      {/* Collapse chevron for leads with children */}
      {isLead && childCount > 0 && (
        <button
          data-action="toggle"
          onClick={handleToggle}
          className="inline-flex items-center text-muted-foreground hover:text-foreground"
        >
          {isCollapsed ? (
            <>
              <span className="mr-0.5 text-xs text-muted-foreground">
                ({childCount})
              </span>
              <ChevronRight className="size-3" />
            </>
          ) : (
            <ChevronDown className="size-3" />
          )}
        </button>
      )}

      {/* Add sub-agent button for leads */}
      {isLead && (
        <button
          data-action="add"
          onClick={handleAddChild}
          className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-primary hover:text-primary-foreground group-hover:opacity-100"
        >
          <Plus className="size-3" />
        </button>
      )}
    </div>
  );
}
