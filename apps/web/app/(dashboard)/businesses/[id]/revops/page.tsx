import { createServerClient } from "@/_lib/supabase/server";
import { getRevOpsSummary } from "@fleet-factory/core/server";
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

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

const TIER_LABELS: Record<string, string> = {
  trial: "Trial",
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
};

export default async function RevOpsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();
  const summary = await getRevOpsSummary(supabase, id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Revenue Operations</h1>
          <p className="text-sm text-muted-foreground">
            Pipeline, agent performance, cost tracking, and budget utilization
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {TIER_LABELS[summary.planTier] ?? summary.planTier} Plan
        </Badge>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Cost Today"
          value={formatCost(summary.tokenUsage.costToday)}
        />
        <StatCard
          label="Cost This Month"
          value={formatCost(summary.tokenUsage.costThisMonth)}
        />
        <StatCard
          label="Tokens This Month"
          value={formatTokens(summary.tokenUsage.thisMonth)}
          subtitle={
            summary.monthlyTokenLimit
              ? `of ${formatTokens(summary.monthlyTokenLimit)}`
              : "unlimited"
          }
        />
        <StatCard
          label="Budget Utilization"
          value={`${summary.tokenUsage.utilizationPercent.toFixed(0)}%`}
          alert={summary.tokenUsage.utilizationPercent > 80}
        />
        <StatCard
          label="Plan Token Limit"
          value={
            summary.monthlyTokenLimit
              ? formatTokens(summary.monthlyTokenLimit)
              : "Unlimited"
          }
          subtitle={TIER_LABELS[summary.planTier] ?? summary.planTier}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Agent Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agent Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.agentPerformance.length > 0 ? (
                <div className="space-y-2">
                  {/* Table header */}
                  <div className="grid grid-cols-[1fr_80px_80px_60px] gap-2 text-xs text-muted-foreground px-3 pb-1 border-b">
                    <span>Agent</span>
                    <span className="text-right">Tokens</span>
                    <span className="text-right">Cost</span>
                    <span className="text-right">Budget</span>
                  </div>
                  {summary.agentPerformance.map((agent) => {
                    const costColor =
                      agent.budgetUtilization > 80
                        ? "text-red-500"
                        : agent.budgetUtilization > 50
                          ? "text-amber-500"
                          : "text-green-600";
                    return (
                      <div
                        key={agent.agentId}
                        className="grid grid-cols-[1fr_80px_80px_60px] items-center gap-2 rounded-lg border p-3"
                      >
                        <div>
                          <p className="text-sm font-medium">{agent.agentName}</p>
                          <p className="text-xs text-muted-foreground">
                            {agent.department} &middot; {agent.tasksCompleted} tasks
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-mono">
                            {formatTokens(agent.tokensUsed)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            / {formatTokens(agent.tokenBudget)}
                          </p>
                        </div>
                        <p className={`text-sm font-mono text-right ${costColor}`}>
                          {formatCost(agent.costCents)}
                        </p>
                        <div className="text-right">
                          <p className={`text-xs font-medium ${costColor}`}>
                            {agent.budgetUtilization.toFixed(0)}%
                          </p>
                          <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                            <div
                              className={`h-1.5 rounded-full ${
                                agent.budgetUtilization > 100
                                  ? "bg-red-500"
                                  : agent.budgetUtilization > 80
                                    ? "bg-amber-500"
                                    : agent.budgetUtilization > 50
                                      ? "bg-amber-400"
                                      : "bg-green-500"
                              }`}
                              style={{
                                width: `${Math.min(100, agent.budgetUtilization)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No agent data yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Flagged Agents */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Flagged Agents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.flagged.map((f) => (
                <div
                  key={f.agentId}
                  className={`flex items-center gap-3 rounded-lg border p-3 ${
                    f.severity === "red"
                      ? "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20"
                      : "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20"
                  }`}
                >
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      f.severity === "red"
                        ? "text-red-600"
                        : "text-amber-600"
                    }`}
                  >
                    {f.severity === "red" ? "Exceeded" : "Warning"}
                  </Badge>
                  <div>
                    <p className="text-sm font-medium">{f.agentName}</p>
                    <p className="text-xs text-muted-foreground">{f.reason}</p>
                  </div>
                </div>
              ))}
              {summary.flagged.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No flagged agents — all agents within budget
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline (placeholder -- populated when CRM is connected) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.pipeline.totalDeals > 0 ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Total Deals</p>
                <p className="text-2xl font-bold">{summary.pipeline.totalDeals}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">
                  ${summary.pipeline.totalValue.toLocaleString()}
                </p>
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Connect Twenty CRM to see pipeline data
            </p>
          )}
        </CardContent>
      </Card>
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
        <p className={`text-2xl font-bold ${alert ? "text-amber-600" : ""}`}>
          {value}
        </p>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
