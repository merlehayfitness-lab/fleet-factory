"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrgChartNode } from "@/_components/agent-tree-view";

interface AgentTreeNodeProps {
  node: OrgChartNode;
  businessId: string;
  onSelect: (nodeId: string) => void;
  onToggleCollapse: () => void;
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
 * Rectangular box node for the org chart.
 * Shows status dot, name, role, collapse chevron, and '+' add-child button.
 * Draggable via @dnd-kit/core. Root and lead nodes are also drop targets.
 */
export function AgentTreeNode({
  node,
  businessId,
  onSelect,
  onToggleCollapse,
  registerRef,
}: AgentTreeNodeProps) {
  const router = useRouter();

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({ id: node.id, disabled: node.type === "root" && node.id === "root" });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: node.id,
    disabled: node.type === "sub-agent",
  });

  const setRef = useCallback(
    (el: HTMLElement | null) => {
      setDragRef(el);
      if (node.type !== "sub-agent") setDropRef(el);
      registerRef(node.id, el);
    },
    [node.id, node.type, setDragRef, setDropRef, registerRef],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-action]")) return;
      if (e.defaultPrevented) return;
      onSelect(node.id);
    },
    [node.id, onSelect],
  );

  const handleAddChild = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (node.type === "root") {
        router.push(`/businesses/${businessId}/agents/new`);
      } else {
        const params = new URLSearchParams();
        if (node.departmentId) params.set("departmentId", node.departmentId);
        params.set("parentAgentId", node.id);
        router.push(`/businesses/${businessId}/agents/new?${params.toString()}`);
      }
    },
    [businessId, node.id, node.type, node.departmentId, router],
  );

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleCollapse();
    },
    [onToggleCollapse],
  );

  const dotColor = STATUS_COLORS[node.status] ?? "bg-muted-foreground";

  return (
    <div
      ref={setRef}
      data-node-id={node.id}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={cn(
        "group relative z-10 flex min-w-[140px] max-w-[180px] cursor-grab flex-col items-center gap-1 rounded-lg border bg-card px-4 py-3 text-center shadow-sm transition-[box-shadow,opacity] hover:shadow-md",
        isDragging && "cursor-grabbing opacity-50",
        isOver && "ring-2 ring-primary border-primary bg-primary/5",
        node.type === "root" && "min-w-[160px] border-primary/40 bg-primary/5",
      )}
    >
      {/* Status dot + status text */}
      <div className="flex items-center gap-2">
        <span className={cn("size-2 shrink-0 rounded-full", dotColor)} />
        <span className="text-xs font-medium capitalize text-muted-foreground">
          {node.status}
        </span>
      </div>

      {/* Name */}
      <p className="text-sm font-semibold leading-tight">{node.name}</p>

      {/* Role */}
      {node.role && (
        <p className="text-[11px] leading-tight text-muted-foreground">
          {node.role}
        </p>
      )}

      {/* Collapse indicator + child count */}
      {node.children.length > 0 && (
        <button
          data-action="toggle"
          onClick={handleToggle}
          className="mt-1 inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground"
        >
          {node.isCollapsed ? (
            <>
              <ChevronDown className="size-3" />
              <span className="text-[10px]">({node.children.length})</span>
            </>
          ) : (
            <ChevronUp className="size-3" />
          )}
        </button>
      )}

      {/* '+' add child button (on hover) */}
      {(node.type === "root" || node.type === "lead") && (
        <button
          data-action="add"
          onClick={handleAddChild}
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 inline-flex size-6 items-center justify-center rounded-full border bg-card text-muted-foreground opacity-0 shadow-sm transition-opacity hover:bg-primary hover:text-primary-foreground group-hover:opacity-100"
        >
          <Plus className="size-3" />
        </button>
      )}
    </div>
  );
}
