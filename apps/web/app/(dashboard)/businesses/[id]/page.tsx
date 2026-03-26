import { notFound } from "next/navigation";
import { createServerClient } from "@/_lib/supabase/server";
import { HealthDashboard } from "@/_components/health-dashboard";
import { getSystemHealth } from "@agency-factory/core/server";
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

  return (
    <HealthDashboard
      business={business}
      initialHealth={health}
      usageSummary={usageSummary}
    />
  );
}
