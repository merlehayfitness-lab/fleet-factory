"use client";

import { useState } from "react";
import Link from "next/link";
import { Bot, AlertTriangle, ChevronDown, ExternalLink } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { DepartmentHealth, AgentHealthItem } from "@agency-factory/core/server";

interface AgentHealthGridProps {
  departments: DepartmentHealth[];
  businessId: string;
}

/**
 * 5-state status mapping for agent health display.
 * active -> Active (green), paused -> Idle (gray), error -> Error (red),
 * frozen -> Frozen (slate+red), provisioning -> Deploying (amber)
 */
const AGENT_STATUS_MAP: Record<
  string,
  { label: string; className: string }
> = {
  active: {
    label: "Active",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  paused: {
    label: "Idle",
    className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  },
  error: {
    label: "Error",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
  frozen: {
    label: "Frozen",
    className: "bg-slate-200 text-slate-600 ring-1 ring-red-300 dark:bg-slate-800 dark:text-slate-400 dark:ring-red-800",
  },
  provisioning: {
    label: "Deploying",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },
};

/** Department type to display badge color */
const DEPT_TYPE_COLORS: Record<string, string> = {
  owner: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  sales: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  support: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  operations: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  custom: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400",
};

/** Format relative time from ISO string */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Agent health grid grouped by department with expandable cards.
 *
 * Each department section shows its name and type badge.
 * Agent cards show name, status badge (5-state), last task time, and error count.
 * Clicking a card expands to show quick link to agent detail page.
 */
export function AgentHealthGrid({
  departments,
  businessId,
}: AgentHealthGridProps) {
  return (
    <div className="space-y-4">
      {departments.map((dept) => (
        <div key={dept.departmentId}>
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-sm font-semibold">{dept.departmentName}</h3>
            <Badge
              variant="secondary"
              className={cn(
                "text-[10px] px-1.5 py-0",
                DEPT_TYPE_COLORS[dept.departmentType] ?? DEPT_TYPE_COLORS.custom,
              )}
            >
              {dept.departmentType}
            </Badge>
          </div>

          {dept.agents.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-4 text-xs text-muted-foreground">
                <Bot className="mr-1.5 size-3.5" />
                No agents provisioned
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {dept.agents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  businessId={businessId}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AgentCard({
  agent,
  businessId,
}: {
  agent: AgentHealthItem;
  businessId: string;
}) {
  const [open, setOpen] = useState(false);
  const statusConfig = AGENT_STATUS_MAP[agent.status] ?? {
    label: agent.status,
    className: "bg-gray-100 text-gray-600",
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger className="w-full text-left">
          <CardHeader className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Bot className="size-4 shrink-0 text-muted-foreground" />
                <CardTitle className="text-sm truncate">{agent.name}</CardTitle>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge
                  variant="secondary"
                  className={cn("text-[10px] px-1.5 py-0", statusConfig.className)}
                >
                  {statusConfig.label}
                </Badge>
                <ChevronDown
                  className={cn(
                    "size-3.5 text-muted-foreground transition-transform",
                    open && "rotate-180",
                  )}
                />
              </div>
            </div>
            <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground pl-6">
              {agent.lastTaskAt && (
                <span>Last task: {relativeTime(agent.lastTaskAt)}</span>
              )}
              {agent.errorCount > 0 && (
                <span className="flex items-center gap-0.5 text-red-600">
                  <AlertTriangle className="size-3" />
                  {agent.errorCount} error{agent.errorCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="border-t bg-muted/20 px-3 py-2.5">
            <div className="flex items-center justify-between text-xs">
              <div className="space-y-1 text-muted-foreground">
                <p>Status: {statusConfig.label}</p>
                {agent.lastTaskAt && (
                  <p>Last completed: {relativeTime(agent.lastTaskAt)}</p>
                )}
                <p>Failed tasks: {agent.errorCount}</p>
              </div>
              <Link
                href={`/businesses/${businessId}/agents/${agent.id}`}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                View details
                <ExternalLink className="size-3" />
              </Link>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
