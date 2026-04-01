import { createServerClient } from "@/_lib/supabase/server";
import { getCSuiteSummary, getLiveActivityFeed } from "@agency-factory/core/server";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function formatCost(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function CommandCenterPage() {
  const supabase = await createServerClient();
  const [summary, activity] = await Promise.all([
    getCSuiteSummary(supabase),
    getLiveActivityFeed(supabase, 15),
  ]);

  // Sort provider/model breakdowns by cost descending
  const topProviders = Object.entries(summary.totals.costByProvider)
    .sort(([, a], [, b]) => b - a);
  const topModels = Object.entries(summary.totals.costByModel)
    .sort(([, a], [, b]) => b - a);

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
          label="Cost Today"
          value={formatCost(summary.totals.totalCostToday)}
          subtitle={`${(summary.totals.totalTokensToday / 1000).toFixed(0)}k tokens`}
        />
      </div>

      {/* Cost Breakdown */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Cost by Period</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Today</span>
                <span className="font-mono font-medium">{formatCost(summary.totals.totalCostToday)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">This Week</span>
                <span className="font-mono font-medium">{formatCost(summary.totals.costThisWeek)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">This Month</span>
                <span className="font-mono font-medium">{formatCost(summary.totals.costThisMonth)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Cost by Provider</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topProviders.length > 0 ? (
                topProviders.map(([provider, cents]) => (
                  <div key={provider} className="flex items-center justify-between text-sm">
                    <span className="capitalize text-muted-foreground">{provider}</span>
                    <span className="font-mono font-medium">{formatCost(cents)}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">No usage recorded</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Cost by Model</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topModels.length > 0 ? (
                topModels.slice(0, 5).map(([model, cents]) => (
                  <div key={model} className="flex items-center justify-between text-sm">
                    <span className="truncate text-muted-foreground mr-2">{model}</span>
                    <span className="font-mono font-medium whitespace-nowrap">{formatCost(cents)}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">No usage recorded</p>
              )}
            </div>
          </CardContent>
        </Card>
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
  subtitle,
}: {
  label: string;
  value: string | number;
  alert?: boolean;
  subtitle?: string;
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
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
