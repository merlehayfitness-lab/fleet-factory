import { redirect } from "next/navigation";
import { createServerClient } from "@/_lib/supabase/server";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Activity feed page.
 *
 * Shows agent-generated audit logs and system events for the business.
 * Reads from the shared `audit_logs` table, scoped to the business owner's workspace.
 */
export default async function ActivityPage() {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Resolve business
  const { data: membership } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (!membership) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg font-medium">No business found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your account is not associated with a business workspace yet.
        </p>
      </div>
    );
  }

  const businessId = membership.business_id as string;

  // Fetch audit logs (most recent 50)
  const { data: logs } = await supabase
    .from("audit_logs")
    .select(
      "id, action, entity_type, entity_id, actor_id, metadata, created_at",
    )
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="text-sm text-muted-foreground">
          Agent activity and system events
        </p>
      </div>

      {/* Activity feed */}
      <div className="rounded-lg border">
        {!logs || logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Activity className="size-8 text-muted-foreground/40" />
            <p className="mt-2 text-sm font-medium text-muted-foreground">
              No activity yet
            </p>
            <p className="text-xs text-muted-foreground">
              Events from your agents and system will appear here.
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {logs.map((log) => (
              <ActivityItem key={log.id} log={log} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Types and sub-components
// --------------------------------------------------------------------------

type LogRow = {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  actor_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

/** Map action prefixes to color classes for the dot indicator */
function actionColor(action: string): string {
  if (action.startsWith("agent.")) return "bg-blue-500";
  if (action.startsWith("deployment.")) return "bg-violet-500";
  if (action.startsWith("task.")) return "bg-amber-500";
  if (action.startsWith("approval.")) return "bg-green-500";
  if (action.startsWith("emergency.")) return "bg-red-500";
  return "bg-muted-foreground/40";
}

function ActivityItem({ log }: { log: LogRow }) {
  const date = new Date(log.created_at);
  const timeLabel = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateLabel = date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });

  // Extract a human-readable description from metadata if available
  const meta = log.metadata ?? {};
  const description =
    (meta.message as string) ??
    (meta.reason as string) ??
    (log.entity_type ? `${log.entity_type} ${log.entity_id ?? ""}`.trim() : null);

  return (
    <li className="flex items-start gap-4 px-4 py-3">
      {/* Status dot */}
      <span
        className={cn(
          "mt-1.5 size-2 shrink-0 rounded-full",
          actionColor(log.action),
        )}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate text-sm font-medium">{log.action}</p>
        {description && (
          <p className="truncate text-xs text-muted-foreground">{description}</p>
        )}
      </div>

      {/* Timestamp */}
      <time
        dateTime={log.created_at}
        className="ml-4 shrink-0 text-xs text-muted-foreground"
      >
        {dateLabel} {timeLabel}
      </time>
    </li>
  );
}
