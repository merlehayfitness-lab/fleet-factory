import { createServerClient } from "@/_lib/supabase/server";
import { getCSuiteSummary, getLiveActivityFeed } from "@agency-factory/core/server";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function CommandCenterPage() {
  const supabase = await createServerClient();
  const [summary, activity] = await Promise.all([
    getCSuiteSummary(supabase),
    getLiveActivityFeed(supabase, 15),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Command Center</h1>
        <p className="text-sm text-muted-foreground">
          Cross-tenant mission control — all businesses at a glance
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Businesses"
          value={summary.totals.totalBusinesses}
        />
        <StatCard
          label="Active Agents"
          value={`${summary.totals.totalActiveAgents}/${summary.totals.totalAgents}`}
        />
        <StatCard
          label="Pending Tasks"
          value={summary.totals.totalPendingTasks}
          alert={summary.totals.totalPendingTasks > 20}
        />
        <StatCard
          label="Tokens Today"
          value={`${(summary.totals.totalTokensToday / 1000).toFixed(0)}k`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Businesses overview */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">All Businesses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {summary.businesses.map((biz) => (
                  <a
                    key={biz.id}
                    href={`/businesses/${biz.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div>
                      <span className="font-medium">{biz.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {biz.slug}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span>{biz.activeAgents} agents</span>
                      <span>{biz.pendingTasks} tasks</span>
                      <Badge
                        variant={biz.status === "active" ? "secondary" : "outline"}
                        className="text-[10px]"
                      >
                        {biz.status}
                      </Badge>
                    </div>
                  </a>
                ))}
                {summary.businesses.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No businesses yet.{" "}
                    <a href="/businesses/new" className="text-primary underline">
                      Create one
                    </a>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Bottlenecks */}
          {summary.bottlenecks.length > 0 && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-base text-amber-600">
                  Bottlenecks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {summary.bottlenecks.map((b, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/20"
                    >
                      <span className="font-medium">{b.businessName}</span>
                      <span className="text-muted-foreground">{b.detail}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Live Activity Feed */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Live Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activity.map((entry) => (
                <div key={entry.id} className="border-l-2 border-muted pl-3">
                  <p className="text-xs font-medium">{entry.action}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {entry.detail}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleString()}
                  </p>
                </div>
              ))}
              {activity.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  No recent activity
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  alert,
}: {
  label: string;
  value: string | number;
  alert?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p
          className={`text-2xl font-bold ${alert ? "text-amber-600" : ""}`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
