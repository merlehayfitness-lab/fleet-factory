import { createServerClient } from "@/_lib/supabase/server";
import { getRevOpsSummary } from "@agency-factory/core/server";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
      <div>
        <h1 className="text-2xl font-bold">Revenue Operations</h1>
        <p className="text-sm text-muted-foreground">
          Pipeline, agent performance, and token usage
        </p>
      </div>

      {/* Token Usage KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tokens Today" value={`${(summary.tokenUsage.today / 1000).toFixed(0)}k`} />
        <StatCard label="Tokens This Week" value={`${(summary.tokenUsage.thisWeek / 1000).toFixed(0)}k`} />
        <StatCard label="Tokens This Month" value={`${(summary.tokenUsage.thisMonth / 1000).toFixed(0)}k`} />
        <StatCard
          label="Budget Utilization"
          value={`${summary.tokenUsage.utilizationPercent.toFixed(0)}%`}
          alert={summary.tokenUsage.utilizationPercent > 80}
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
              {summary.agentPerformance.map((agent) => (
                <div
                  key={agent.agentId}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{agent.agentName}</p>
                    <p className="text-xs text-muted-foreground">
                      {agent.tasksCompleted} tasks completed
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono">
                      {(agent.tokensUsed / 1000).toFixed(0)}k / {(agent.tokenBudget / 1000).toFixed(0)}k
                    </p>
                    <div className="mt-1 h-1.5 w-20 rounded-full bg-muted">
                      <div
                        className={`h-1.5 rounded-full ${
                          agent.budgetUtilization > 80
                            ? "bg-red-500"
                            : agent.budgetUtilization > 50
                              ? "bg-amber-500"
                              : "bg-green-500"
                        }`}
                        style={{
                          width: `${Math.min(100, agent.budgetUtilization)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
              {summary.agentPerformance.length === 0 && (
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
                  className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900 dark:bg-amber-950/20"
                >
                  <Badge variant="outline" className="text-amber-600 text-xs">
                    Low Usage
                  </Badge>
                  <div>
                    <p className="text-sm font-medium">{f.agentName}</p>
                    <p className="text-xs text-muted-foreground">{f.reason}</p>
                  </div>
                </div>
              ))}
              {summary.flagged.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No flagged agents
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline (placeholder — populated when CRM is connected) */}
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
}: {
  label: string;
  value: string | number;
  alert?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold ${alert ? "text-amber-600" : ""}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
