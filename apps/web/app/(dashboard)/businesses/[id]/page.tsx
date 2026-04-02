import { notFound } from "next/navigation";
import { XCircle } from "lucide-react";
import { createServerClient } from "@/_lib/supabase/server";
import { HealthDashboard } from "@/_components/health-dashboard";
import { getSystemHealth, checkBudget } from "@fleet-factory/core/server";
import type { UsageSummaryData } from "@/_components/usage-summary";

/**
 * Business overview dashboard page.
 *
 * Server Component that fetches business details and system health,
 * then passes data to the HealthDashboard client component which
 * handles auto-refresh polling.
 */
export default async function BusinessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  // Fetch business details
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", id)
    .single();

  if (businessError || !business) {
    notFound();
  }

  // Fetch combined health payload via the health service
  const health = await getSystemHealth(supabase, id);

  // If business is disabled/suspended, check for VPS warning in latest disable audit log
  let vpsWarning: string | null = null;
  const isBusinessDisabled =
    business.status === "disabled" || business.status === "suspended";
  if (isBusinessDisabled) {
    const { data: lastDisableLog } = await supabase
      .from("audit_logs")
      .select("metadata")
      .eq("business_id", business.id)
      .eq("action", "emergency.tenant_disabled")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    const meta = lastDisableLog?.metadata as Record<string, unknown> | null;
    vpsWarning = (meta?.vps_warning as string) ?? null;
  }

  // Fetch agents (with department name) and departments for AITMPL banner
  const [{ data: bannerAgents }, { data: bannerDepartments }] =
    await Promise.all([
      supabase
        .from("agents")
        .select("id, name, departments(name)")
        .eq("business_id", id)
        .eq("status", "active"),
      supabase
        .from("departments")
        .select("id, name")
        .eq("business_id", id),
    ]);

  const agentsForBanner = (bannerAgents ?? []).map((a) => ({
    id: a.id as string,
    name: a.name as string,
    department_name: (a.departments as unknown as { name: string } | null)?.name,
  }));

  const departmentsForBanner = (bannerDepartments ?? []).map((d) => ({
    id: d.id as string,
    name: d.name as string,
  }));

  // Fetch usage summary: aggregate from usage_records grouped by agent
  const { data: usageRecords } = await supabase
    .from("usage_records")
    .select("agent_id, prompt_tokens, completion_tokens, cost_cents")
    .eq("business_id", id);

  // Fetch agent names for usage display
  const agentIds = [
    ...new Set((usageRecords ?? []).map((r) => r.agent_id as string)),
  ];
  const agentNameMap = new Map<string, string>();
  if (agentIds.length > 0) {
    const { data: agents } = await supabase
      .from("agents")
      .select("id, name")
      .in("id", agentIds);
    for (const agent of agents ?? []) {
      agentNameMap.set(agent.id as string, agent.name as string);
    }
  }

  // Aggregate usage data
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalCostCents = 0;
  const agentUsageMap = new Map<
    string,
    { promptTokens: number; completionTokens: number; costCents: number }
  >();

  for (const record of usageRecords ?? []) {
    totalPromptTokens += record.prompt_tokens;
    totalCompletionTokens += record.completion_tokens;
    totalCostCents += record.cost_cents;

    const agentId = record.agent_id as string;
    const existing = agentUsageMap.get(agentId) ?? {
      promptTokens: 0,
      completionTokens: 0,
      costCents: 0,
    };
    existing.promptTokens += record.prompt_tokens;
    existing.completionTokens += record.completion_tokens;
    existing.costCents += record.cost_cents;
    agentUsageMap.set(agentId, existing);
  }

  const usageSummary: UsageSummaryData = {
    totalPromptTokens,
    totalCompletionTokens,
    totalCostCents,
    byAgent: Array.from(agentUsageMap.entries()).map(
      ([agentId, stats]) => ({
        agentId,
        agentName: agentNameMap.get(agentId) ?? "Unknown Agent",
        ...stats,
      }),
    ),
  };

  // If VPS is configured but DB has no status row yet, provide a placeholder
  // so the Terminal icon renders immediately
  const vpsConfigured = !!(process.env.VPS_API_URL && process.env.VPS_API_KEY);
  const effectiveVpsStatus = health.vpsStatus ?? (vpsConfigured ? { status: "checking", lastCheckedAt: new Date().toISOString() } : null);

  // Check business-level budget (no agentId = business-wide check)
  const budgetInfo = await checkBudget(supabase, id);

  return (
    <div className="space-y-0">
      {/* Business-level budget banner */}
      {budgetInfo.warningLevel === "red" && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <XCircle className="size-4 shrink-0" />
          <div>
            <p className="font-medium">Monthly token limit reached</p>
            <p className="mt-1 text-destructive/80">
              All agents are blocked from making API calls.
              Upgrade your plan or add credits via the Anthropic console.
              Usage resets on the 1st of next month.
            </p>
          </div>
        </div>
      )}

      {/* Plan tier badge and utilization indicator */}
      <div className="mb-4 flex items-center gap-3">
        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
          {((business.plan_tier as string) ?? "PRO").toUpperCase()} Plan
        </span>
        {budgetInfo.businessUtilization != null && budgetInfo.businessUtilization > 50 && (
          <p className="text-xs text-muted-foreground">
            {budgetInfo.businessTokensUsed?.toLocaleString()} / {budgetInfo.businessTokenLimit?.toLocaleString()} tokens used this month
            ({budgetInfo.businessUtilization}%)
          </p>
        )}
      </div>

      <HealthDashboard
        business={business}
        initialHealth={health}
        usageSummary={usageSummary}
        vpsStatus={effectiveVpsStatus}
        vpsWarning={vpsWarning}
        bannerAgents={agentsForBanner}
        bannerDepartments={departmentsForBanner}
      />
    </div>
  );
}
