import { redirect } from "next/navigation";
import { createServerClient } from "@/_lib/supabase/server";
import {
  Bot,
  Users,
  CheckSquare,
  TrendingUp,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Business overview dashboard.
 *
 * This is the /dashboard route (served via the (dashboard) route group).
 * Fetches business-scoped stats and recent activity for the signed-in owner.
 */
export default async function DashboardPage() {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Resolve business membership
  const { data: membership } = await supabase
    .from("business_users")
    .select("business_id, businesses(id, name, status)")
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
          Contact your administrator.
        </p>
      </div>
    );
  }

  const biz = membership.businesses as unknown as {
    id: string;
    name: string;
    status: string;
  } | null;

  if (!biz) {
    redirect("/sign-in");
  }

  const businessId = biz.id;

  // Fetch stats in parallel
  const [
    { count: agentCount },
    { count: taskCount },
    { count: contactCount },
    { count: openDealCount },
    { data: recentActivity },
  ] = await Promise.all([
    supabase
      .from("agents")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "active"),

    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .in("status", ["pending", "in_progress"]),

    // TODO: replace with a real contacts table when CRM schema is added
    // Stubbed as 0 for MVP
    Promise.resolve({ count: 0 }),

    // TODO: replace with a real deals/pipeline table when CRM schema is added
    // Stubbed as 0 for MVP
    Promise.resolve({ count: 0 }),

    supabase
      .from("audit_logs")
      .select("id, action, entity_type, actor_id, created_at, metadata")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const stats: StatCard[] = [
    {
      label: "Active Agents",
      value: agentCount ?? 0,
      icon: Bot,
      description: "AI agents currently running",
    },
    {
      label: "Open Tasks",
      value: taskCount ?? 0,
      icon: CheckSquare,
      description: "Pending or in progress",
    },
    {
      label: "Contacts",
      value: contactCount ?? 0,
      icon: Users,
      description: "In your CRM",
    },
    {
      label: "Open Deals",
      value: openDealCount ?? 0,
      icon: TrendingUp,
      description: "Active pipeline",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{biz.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Business overview
          </p>
        </div>
        <StatusBadge status={biz.status} />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCardView key={stat.label} stat={stat} />
        ))}
      </div>

      {/* Recent activity */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Recent Activity
          </h2>
        </div>
        <div className="rounded-lg border">
          {recentActivity && recentActivity.length > 0 ? (
            <ul className="divide-y">
              {recentActivity.map((log) => (
                <ActivityRow key={log.id} log={log} />
              ))}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No activity recorded yet
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

// --------------------------------------------------------------------------
// Sub-components
// --------------------------------------------------------------------------

type StatCard = {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
};

function StatCardView({ stat }: { stat: StatCard }) {
  const Icon = stat.icon;
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {stat.label}
        </span>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-2xl font-bold">{stat.value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{stat.description}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    active: {
      label: "Active",
      className: "bg-green-100 text-green-800",
    },
    provisioning: {
      label: "Provisioning",
      className: "bg-blue-100 text-blue-800",
    },
    suspended: {
      label: "Suspended",
      className: "bg-amber-100 text-amber-800",
    },
    disabled: {
      label: "Disabled",
      className: "bg-red-100 text-red-800",
    },
  };

  const { label, className } = map[status] ?? {
    label: status,
    className: "bg-muted text-muted-foreground",
  };

  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-medium",
        className,
      )}
    >
      {label}
    </span>
  );
}

type ActivityLogRow = {
  id: string;
  action: string;
  entity_type: string | null;
  actor_id: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

function ActivityRow({ log }: { log: ActivityLogRow }) {
  const date = new Date(log.created_at);
  const timeLabel = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateLabel = date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });

  return (
    <li className="flex items-center justify-between px-4 py-3 text-sm">
      <div className="min-w-0 space-y-0.5">
        <p className="truncate font-medium">{log.action}</p>
        {log.entity_type && (
          <p className="truncate text-xs text-muted-foreground">
            {log.entity_type}
          </p>
        )}
      </div>
      <time
        dateTime={log.created_at}
        className="ml-4 shrink-0 text-xs text-muted-foreground"
      >
        {dateLabel} {timeLabel}
      </time>
    </li>
  );
}
