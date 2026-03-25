import { Clock } from "lucide-react";

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface AgentActivityProps {
  auditLogs: AuditLog[];
}

/** Format an action string for display: "agent.frozen" -> "Agent Frozen" */
function formatAction(action: string): string {
  return action
    .replace(/^agent\./, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Format a timestamp as a relative time string. */
function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? "s" : ""} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? "s" : ""} ago`;
  if (diffDay < 30) return `${diffDay} day${diffDay !== 1 ? "s" : ""} ago`;

  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Activity tab showing a timeline of recent audit log entries.
 *
 * Displays up to 20 entries with formatted action names and relative timestamps.
 */
export function AgentActivity({ auditLogs }: AgentActivityProps) {
  if (auditLogs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Clock className="mb-3 size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No activity recorded yet
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1 pt-4">
      {auditLogs.map((log) => {
        const metadata = log.metadata as Record<string, string> | null;

        return (
          <div
            key={log.id}
            className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50"
          >
            <div className="mt-0.5 size-2 shrink-0 rounded-full bg-primary" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium">
                  {formatAction(log.action)}
                </p>
                <p className="shrink-0 text-xs text-muted-foreground">
                  {formatRelativeTime(log.created_at)}
                </p>
              </div>
              {metadata && (metadata.previous_status || metadata.new_status) && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {metadata.previous_status && (
                    <span>{metadata.previous_status}</span>
                  )}
                  {metadata.previous_status && metadata.new_status && (
                    <span> &rarr; </span>
                  )}
                  {metadata.new_status && <span>{metadata.new_status}</span>}
                </p>
              )}
            </div>
          </div>
        );
      })}

      {auditLogs.length >= 20 && (
        <p className="px-3 py-2 text-xs text-muted-foreground">
          Showing most recent 20 entries
        </p>
      )}
    </div>
  );
}
