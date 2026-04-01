"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DepartmentTemplate {
  id: string;
  name: string;
  departmentType: string;
  description: string;
  roleLevel: number;
  reportingChain: string;
  tokenBudget: number;
  modelProfile?: string;
  children?: DepartmentTemplate[];
}

interface Props {
  templates: DepartmentTemplate[];
  selected: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
}

// ---------------------------------------------------------------------------
// Role label helpers
// ---------------------------------------------------------------------------

const ROLE_LABELS: Record<number, string> = {
  0: "C-Suite (Level 0)",
  1: "Department Head (Level 1)",
  2: "Specialist (Level 2)",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DepartmentTreeSelect({
  templates,
  selected,
  onSelectionChange,
}: Props) {
  // Default: all departments expanded so user sees full hierarchy
  const allExpandable = useMemo(() => {
    const ids = new Set<string>();
    for (const t of templates) {
      if (t.roleLevel <= 1) ids.add(t.id);
    }
    return ids;
  }, [templates]);

  const [expanded, setExpanded] = useState<Set<string>>(allExpandable);

  // Build tree from flat list
  const tree = buildTree(templates);

  function toggleExpand(id: string) {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  }

  function toggleSelect(template: DepartmentTemplate) {
    // CEO is always selected
    if (template.departmentType === "executive" && template.roleLevel === 0) return;

    const next = new Set(selected);

    if (next.has(template.id)) {
      // Deselect this and all children
      next.delete(template.id);
      if (template.children) {
        for (const child of template.children) {
          next.delete(child.id);
        }
      }
    } else {
      // Select this and all children
      next.add(template.id);
      if (template.children) {
        for (const child of template.children) {
          next.add(child.id);
        }
      }
    }

    onSelectionChange(next);
  }

  function toggleChild(childId: string) {
    const next = new Set(selected);
    if (next.has(childId)) {
      next.delete(childId);
    } else {
      next.add(childId);
    }
    onSelectionChange(next);
  }

  const selectedCount = selected.size;
  const totalCount = templates.length;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        {tree.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            selected={selected}
            expanded={expanded}
            onToggleExpand={toggleExpand}
            onToggleSelect={toggleSelect}
            onToggleChild={toggleChild}
            depth={0}
          />
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        {selectedCount} of {totalCount} agents selected
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tree node
// ---------------------------------------------------------------------------

function TreeNode({
  node,
  selected,
  expanded,
  onToggleExpand,
  onToggleSelect,
  onToggleChild,
  depth,
}: {
  node: DepartmentTemplate;
  selected: Set<string>;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  onToggleSelect: (node: DepartmentTemplate) => void;
  onToggleChild: (id: string) => void;
  depth: number;
}) {
  const isSelected = selected.has(node.id);
  const isCeo = node.departmentType === "executive" && node.roleLevel === 0;
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expanded.has(node.id);

  const levelColors: Record<number, string> = {
    0: "bg-amber-500/10 border-amber-500/30",
    1: "bg-blue-500/10 border-blue-500/30",
    2: "bg-slate-500/5 border-slate-500/20",
  };

  const levelBadgeColors: Record<number, "default" | "secondary" | "outline"> = {
    0: "default",
    1: "secondary",
    2: "outline",
  };

  const roleLabel = ROLE_LABELS[node.roleLevel] ?? `Level ${node.roleLevel}`;
  const budgetLabel = `${(node.tokenBudget / 1000).toFixed(0)}K tokens/month`;

  return (
    <div style={{ marginLeft: depth * 20 }}>
      <div
        className={`group relative flex items-center gap-3 rounded-lg border p-3 transition-colors ${
          levelColors[node.roleLevel] ?? "border-border"
        } ${isSelected || isCeo ? "ring-1 ring-primary/30" : ""}`}
      >
        {/* Expand/collapse toggle */}
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggleExpand(node.id)}
            className="flex h-5 w-5 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            {isExpanded ? "\u25BE" : "\u25B8"}
          </button>
        ) : (
          <span className="w-5" />
        )}

        {/* Checkbox */}
        <input
          type="checkbox"
          checked={isSelected || isCeo}
          disabled={isCeo}
          onChange={() =>
            hasChildren && depth < 2
              ? onToggleSelect(node)
              : onToggleChild(node.id)
          }
          className="h-4 w-4 rounded border-gray-300"
        />

        {/* Name and role badge only */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{node.name}</span>
            <Badge variant={levelBadgeColors[node.roleLevel] ?? "outline"} className="text-[10px]">
              {node.departmentType}
            </Badge>
            {isCeo && (
              <Badge variant="default" className="text-[10px] bg-amber-600">
                Required
              </Badge>
            )}
          </div>
        </div>

        {/* Hover tooltip — appears to the right */}
        <div className="invisible group-hover:visible absolute left-full ml-2 top-0 z-50 w-72 rounded-md border bg-popover p-3 text-sm shadow-md pointer-events-none">
          <p className="font-medium text-foreground">{node.name}</p>
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            {roleLabel}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {node.description}
          </p>
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span>Budget: {budgetLabel}</span>
            {node.modelProfile && (
              <span>Model: {node.modelProfile}</span>
            )}
          </div>
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="mt-1 space-y-1">
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              selected={selected}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
              onToggleSelect={onToggleSelect}
              onToggleChild={onToggleChild}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildTree(templates: DepartmentTemplate[]): DepartmentTemplate[] {
  // Group by reporting chain depth
  const roots: DepartmentTemplate[] = [];
  const deptHeads = new Map<string, DepartmentTemplate>();
  const specialists: DepartmentTemplate[] = [];

  for (const t of templates) {
    if (t.roleLevel === 0) {
      roots.push({ ...t, children: [] });
    } else if (t.roleLevel === 1) {
      deptHeads.set(t.departmentType, { ...t, children: [] });
    } else {
      specialists.push(t);
    }
  }

  // Assign specialists to department heads
  for (const spec of specialists) {
    const head = deptHeads.get(spec.departmentType);
    if (head) {
      head.children!.push(spec);
    }
  }

  // Assign department heads as children of CEO
  if (roots.length > 0) {
    roots[0].children = Array.from(deptHeads.values());
  }

  return roots;
}
