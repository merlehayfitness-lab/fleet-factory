"use client";

import { useState } from "react";
import { Activity, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AuditLogEntry } from "@/_actions/log-actions";

interface AuditLogTimelineProps {
  logs: AuditLogEntry[];
}

/** Humanize action string: "emergency.agent_frozen" -> "Emergency Agent Frozen" */
function humanizeAction(action: string): string {
  return action
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

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

/** Color-code actions by category */
function actionColor(action: string): string {
  if (action.startsWith("emergency"))
    return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  if (action.includes("created") || action.includes("provisioned"))
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
  if (action.includes("updated") || action.includes("config"))
    return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
  if (action.includes("deleted") || action.includes("retired"))
    return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
  return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
}

/**
 * Activity timeline view for audit logs.
 * Vertical line on left, content cards on right.
 * Each entry shows humanized action, entity info, relative timestamp, and expandable metadata.
 */
export function AuditLogTimeline({ logs }: AuditLogTimelineProps) {
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground">
        <Activity className="mb-2 size-8" />
        <p>No audit log entries found</p>
      </div>
    );
  }

  return (
    <div className="relative space-y-0">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

      {logs.map((entry) => (
        <TimelineEntry key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

function TimelineEntry({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasMetadata =
    entry.metadata && Object.keys(entry.metadata).length > 0;

  const entityName =
    (entry.metadata?.agent_name as string) ??
    (entry.metadata?.business_name as string) ??
    (entry.entityId ? entry.entityId.slice(0, 8) + "..." : null);

  return (
    <div className="relative flex gap-3 py-3 pl-8">
      {/* Timeline dot */}
      <div className="absolute left-[13px] top-[18px] size-2.5 rounded-full bg-muted-foreground/40 ring-2 ring-background" />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="secondary"
                className={cn("text-[10px] px-1.5 py-0", actionColor(entry.action))}
              >
                {humanizeAction(entry.action)}
              </Badge>
              {entry.entityType && (
                <span className="text-xs text-muted-foreground">
                  {entry.entityType}
                  {entityName ? `: ${entityName}` : ""}
                </span>
              )}
            </div>

            {/* Actor info */}
            {entry.actorId && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                by {entry.actorId.slice(0, 8)}...
              </p>
            )}

            {/* Reason if present */}
            {typeof entry.metadata?.reason === "string" && (
              <p className="mt-1 text-xs text-muted-foreground italic">
                &quot;{entry.metadata.reason}&quot;
              </p>
            )}
          </div>

          <span className="shrink-0 text-[11px] text-muted-foreground">
            {relativeTime(entry.createdAt)}
          </span>
        </div>

        {/* Expandable metadata */}
        {hasMetadata && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? (
              <ChevronDown className="size-3" />
            ) : (
              <ChevronRight className="size-3" />
            )}
            Details
          </button>
        )}

        {expanded && hasMetadata && (
          <div className="mt-1.5 rounded-md bg-muted/50 p-2 text-[11px] font-mono">
            {Object.entries(entry.metadata).map(([key, value]) => (
              <div key={key} className="flex gap-2">
                <span className="text-muted-foreground shrink-0">{key}:</span>
                <span className="break-all">
                  {typeof value === "object"
                    ? JSON.stringify(value)
                    : String(value)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
