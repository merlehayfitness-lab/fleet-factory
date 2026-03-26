import { notFound } from "next/navigation";
import { createServerClient } from "@/_lib/supabase/server";
import { BusinessOverview } from "@/_components/business-overview";
import type { UsageSummaryData } from "@/_components/usage-summary";

/**
 * Business overview dashboard page.
 *
 * Server Component that fetches business details, agent count,
 * department count, latest deployment, usage summary, and live counts.
 * All queries use RLS-scoped Supabase client.
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

  // Fetch agent count
  const { count: agentCount } = await supabase
    .from("agents")
    .select("id", { count: "exact", head: true })
    .eq("business_id", id);

  // Fetch department count
  const { count: departmentCount } = await supabase
    .from("departments")
    .select("id", { count: "exact", head: true })
    .eq("business_id", id);

  // Fetch latest deployment
  const { data: latestDeployment } = await supabase
    .from("deployments")
    .select("*")
    .eq("business_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Fetch pending approval count
  const { count: pendingApprovalCount } = await supabase
    .from("approvals")
    .select("id", { count: "exact", head: true })
    .eq("business_id", id)
    .eq("status", "pending");

  // Fetch active task count (queued, assigned, in_progress, waiting_approval)
  const { count: activeTaskCount } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("business_id", id)
    .in("status", ["queued", "assigned", "in_progress", "waiting_approval"]);

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
    <BusinessOverview
      business={business}
      agentCount={agentCount ?? 0}
      departmentCount={departmentCount ?? 0}
      latestDeployment={latestDeployment}
      pendingApprovalCount={pendingApprovalCount ?? 0}
      activeTaskCount={activeTaskCount ?? 0}
      usageSummary={usageSummary}
    />
  );
}
