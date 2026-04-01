"use client";

import { cn } from "@/lib/utils";
import { StatusBadge } from "@/_components/status-badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Deployment {
  id: string;
  version: number;
  status: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  config_snapshot: Record<string, unknown> | null;
}

interface DeploymentListProps {
  deployments: Deployment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${diffDay}d ago`;
}

/**
 * Compute a brief diff summary between two deployments' config snapshots.
 * Compares agent IDs and statuses between consecutive deployments.
 */
function computeDeploymentDiff(
  current: Record<string, unknown> | null,
  previous: Record<string, unknown> | null
): string {
  if (!previous || !current) return "Initial deployment";

  const currentAgents = Array.isArray(current.agents) ? current.agents : [];
  const previousAgents = Array.isArray(previous.agents) ? previous.agents : [];

  const currentIds = new Set(
    currentAgents.map((a: Record<string, unknown>) => a.id)
  );
  const previousIds = new Set(
    previousAgents.map((a: Record<string, unknown>) => a.id)
  );

  let added = 0;
  let removed = 0;
  let modified = 0;

  for (const id of currentIds) {
    if (!previousIds.has(id)) {
      added++;
    }
  }
  for (const id of previousIds) {
    if (!currentIds.has(id)) {
      removed++;
    }
  }

  // Check for modified agents (same ID, different status)
  const prevMap = new Map(
    previousAgents.map((a: Record<string, unknown>) => [a.id, a.status])
  );
  for (const agent of currentAgents) {
    const a = agent as Record<string, unknown>;
    if (previousIds.has(a.id) && prevMap.get(a.id) !== a.status) {
      modified++;
    }
  }

  const parts: string[] = [];
  if (added > 0) parts.push(`+${added} agent${added !== 1 ? "s" : ""}`);
  if (removed > 0) parts.push(`-${removed} agent${removed !== 1 ? "s" : ""}`);
  if (modified > 0)
    parts.push(`${modified} modified`);

  return parts.length > 0 ? parts.join(", ") : "No changes";
}

/**
 * Left panel deployment history list.
 * Shows version, status badge, relative timestamp, agent count, and config diff.
 */
export function DeploymentList({
  deployments,
  selectedId,
  onSelect,
}: DeploymentListProps) {
  if (deployments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground">
        No deployments yet
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-14rem)]">
      <div className="space-y-1 pr-3">
        {deployments.map((deployment, idx) => {
          const isSelected = selectedId === deployment.id;
          const agentCount = Array.isArray(deployment.config_snapshot?.agents)
            ? (deployment.config_snapshot.agents as unknown[]).length
            : 0;
          const prevDeployment = idx < deployments.length - 1 ? deployments[idx + 1] : null;
          const diffSummary = computeDeploymentDiff(
            deployment.config_snapshot,
            prevDeployment?.config_snapshot ?? null
          );

          return (
            <button
              key={deployment.id}
              type="button"
              onClick={() => onSelect(deployment.id)}
              className={cn(
                "flex w-full flex-col gap-0.5 rounded-md border px-3 py-2.5 text-left text-sm transition-colors",
                isSelected
                  ? "border-primary/30 bg-accent"
                  : "border-transparent hover:bg-accent/50"
              )}
            >
              {/* Version + badge: keep together, badge right-aligned */}
              <div className="flex min-w-0 items-center gap-2">
                <span className="font-semibold">v{deployment.version}</span>
                <span className="ml-auto shrink-0">
                  <StatusBadge status={deployment.status} />
                </span>
              </div>
              {/* Timestamp + agent count */}
              <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                <span className="shrink-0">{formatRelativeTime(deployment.created_at)}</span>
                <span className="text-muted-foreground/40">&middot;</span>
                <span className="truncate">
                  {agentCount} agent{agentCount !== 1 ? "s" : ""} &middot; Manual
                </span>
              </div>
              {/* Diff summary */}
              <span className="truncate text-xs text-muted-foreground/60">
                {diffSummary}
              </span>
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}
