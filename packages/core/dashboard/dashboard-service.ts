/**
 * Dashboard aggregation service.
 *
 * Provides cross-tenant (C-Suite) and per-tenant (RevOps) dashboard data.
 * Aggregates from businesses, agents, tasks, api_usage, and CRM data.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CSuiteSummary {
  businesses: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    agentCount: number;
    activeAgents: number;
    pendingTasks: number;
    tokenUsageToday: number;
  }>;
  totals: {
    totalBusinesses: number;
    totalAgents: number;
    totalActiveAgents: number;
    totalPendingTasks: number;
    totalTokensToday: number;
    totalCostToday: number;
    costThisWeek: number;
    costThisMonth: number;
    costByProvider: Record<string, number>;
    costByModel: Record<string, number>;
  };
  overdueTasks: Array<{
    id: string;
    title: string;
    businessId: string;
    businessName: string;
    priority: string;
    createdAt: string;
  }>;
  bottlenecks: Array<{
    businessId: string;
    businessName: string;
    type: "overdue_tasks" | "error_agents" | "budget_exceeded";
    detail: string;
  }>;
}

export interface RevOpsSummary {
  pipeline: {
    totalDeals: number;
    totalValue: number;
    byStage: Record<string, { count: number; value: number }>;
  };
  agentPerformance: Array<{
    agentId: string;
    agentName: string;
    department: string;
    tasksCompleted: number;
    tokensUsed: number;
    tokenBudget: number;
    budgetUtilization: number;
    costCents: number;
  }>;
  tokenUsage: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    budgetTotal: number;
    utilizationPercent: number;
    costToday: number;
    costThisMonth: number;
  };
  planTier: string;
  monthlyTokenLimit: number | null;
  flagged: Array<{
    agentId: string;
    agentName: string;
    reason: string;
    severity: "amber" | "red";
  }>;
}

export interface LiveActivityEntry {
  id: string;
  businessId: string;
  businessName?: string;
  agentName?: string;
  action: string;
  detail: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// C-Suite Dashboard (cross-tenant)
// ---------------------------------------------------------------------------

/**
 * Get C-Suite summary across all businesses.
 */
export async function getCSuiteSummary(
  supabase: SupabaseClient,
): Promise<CSuiteSummary> {
  // Fetch all businesses
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name, slug, status")
    .order("created_at", { ascending: false });

  const bizList = businesses ?? [];

  // Fetch agent counts per business
  const { data: agents } = await supabase
    .from("agents")
    .select("id, business_id, status");

  const agentsByBiz = new Map<string, { total: number; active: number }>();
  for (const a of agents ?? []) {
    const entry = agentsByBiz.get(a.business_id) ?? { total: 0, active: 0 };
    entry.total++;
    if (a.status === "active") entry.active++;
    agentsByBiz.set(a.business_id, entry);
  }

  // Fetch pending tasks per business
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, business_id, title, priority, status, created_at")
    .in("status", ["open", "in_progress"]);

  const tasksByBiz = new Map<string, number>();
  const overdueTasks: CSuiteSummary["overdueTasks"] = [];
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  for (const t of tasks ?? []) {
    tasksByBiz.set(t.business_id, (tasksByBiz.get(t.business_id) ?? 0) + 1);
    if (t.created_at < threeDaysAgo) {
      const biz = bizList.find((b) => b.id === t.business_id);
      overdueTasks.push({
        id: t.id,
        title: t.title,
        businessId: t.business_id,
        businessName: biz?.name ?? "Unknown",
        priority: t.priority,
        createdAt: t.created_at,
      });
    }
  }

  // Fetch month's usage for cost aggregation (covers today, week, month)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data: usage } = await supabase
    .from("api_usage")
    .select("business_id, prompt_tokens, completion_tokens, cost_cents, provider, model, created_at, status")
    .gte("created_at", monthStart.toISOString());

  const usageByBiz = new Map<string, number>();
  let totalCostToday = 0;
  let costThisWeek = 0;
  let costThisMonth = 0;
  const costByProvider: Record<string, number> = {};
  const costByModel: Record<string, number> = {};

  for (const u of usage ?? []) {
    if (u.business_id) {
      const tokens = u.prompt_tokens + u.completion_tokens;
      if (u.created_at >= todayStart.toISOString()) {
        usageByBiz.set(
          u.business_id,
          (usageByBiz.get(u.business_id) ?? 0) + tokens,
        );
      }
    }
    if (u.status === "completed") {
      const cents = Number(u.cost_cents);
      costThisMonth += cents;
      if (u.created_at >= weekStart.toISOString()) costThisWeek += cents;
      if (u.created_at >= todayStart.toISOString()) totalCostToday += cents;
      const provider = (u.provider as string) ?? "unknown";
      const model = (u.model as string) ?? "unknown";
      costByProvider[provider] = (costByProvider[provider] ?? 0) + cents;
      costByModel[model] = (costByModel[model] ?? 0) + cents;
    }
  }

  // Build business summaries
  const businessSummaries = bizList.map((biz) => {
    const agentInfo = agentsByBiz.get(biz.id) ?? { total: 0, active: 0 };
    return {
      id: biz.id,
      name: biz.name,
      slug: biz.slug,
      status: biz.status,
      agentCount: agentInfo.total,
      activeAgents: agentInfo.active,
      pendingTasks: tasksByBiz.get(biz.id) ?? 0,
      tokenUsageToday: usageByBiz.get(biz.id) ?? 0,
    };
  });

  // Build bottlenecks
  const bottlenecks: CSuiteSummary["bottlenecks"] = [];
  for (const biz of businessSummaries) {
    if (biz.pendingTasks > 10) {
      bottlenecks.push({
        businessId: biz.id,
        businessName: biz.name,
        type: "overdue_tasks",
        detail: `${biz.pendingTasks} pending tasks`,
      });
    }
    const agentInfo = agentsByBiz.get(biz.id);
    if (agentInfo && agentInfo.active < agentInfo.total * 0.5) {
      bottlenecks.push({
        businessId: biz.id,
        businessName: biz.name,
        type: "error_agents",
        detail: `Only ${agentInfo.active}/${agentInfo.total} agents active`,
      });
    }
  }

  // Totals
  const totals = {
    totalBusinesses: bizList.length,
    totalAgents: Array.from(agentsByBiz.values()).reduce((s, a) => s + a.total, 0),
    totalActiveAgents: Array.from(agentsByBiz.values()).reduce((s, a) => s + a.active, 0),
    totalPendingTasks: Array.from(tasksByBiz.values()).reduce((s, v) => s + v, 0),
    totalTokensToday: Array.from(usageByBiz.values()).reduce((s, v) => s + v, 0),
    totalCostToday,
    costThisWeek,
    costThisMonth,
    costByProvider,
    costByModel,
  };

  return { businesses: businessSummaries, totals, overdueTasks, bottlenecks };
}

// ---------------------------------------------------------------------------
// RevOps Dashboard (per-tenant)
// ---------------------------------------------------------------------------

/**
 * Get RevOps summary for a specific business.
 */
export async function getRevOpsSummary(
  supabase: SupabaseClient,
  businessId: string,
): Promise<RevOpsSummary> {
  // Agent performance — join with templates for real token_budget
  const { data: agents } = await supabase
    .from("agents")
    .select("id, name, status, department_id, token_budget, template_id, agent_templates(token_budget)")
    .eq("business_id", businessId);

  const { data: depts } = await supabase
    .from("departments")
    .select("id, type")
    .eq("business_id", businessId);

  // Business plan info
  const { data: bizData } = await supabase
    .from("businesses")
    .select("plan_tier, monthly_token_limit")
    .eq("id", businessId)
    .single();
  const planTier = bizData?.plan_tier ?? "pro";
  const monthlyTokenLimit = bizData?.monthly_token_limit ?? null;

  // Token usage periods
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(now);
  monthStart.setDate(1);

  const { data: monthUsage } = await supabase
    .from("api_usage")
    .select("agent_id, prompt_tokens, completion_tokens, cost_cents, created_at, status")
    .eq("business_id", businessId)
    .gte("created_at", monthStart.toISOString());

  let todayTokens = 0;
  let weekTokens = 0;
  let monthTokens = 0;
  let costToday = 0;
  let costThisMonth = 0;
  const agentTokens = new Map<string, number>();
  const agentCosts = new Map<string, number>();

  for (const u of monthUsage ?? []) {
    const tokens = u.prompt_tokens + u.completion_tokens;
    monthTokens += tokens;
    if (u.created_at >= weekStart.toISOString()) weekTokens += tokens;
    if (u.created_at >= todayStart.toISOString()) todayTokens += tokens;
    if (u.agent_id) {
      agentTokens.set(u.agent_id, (agentTokens.get(u.agent_id) ?? 0) + tokens);
    }
    if (u.status === "completed") {
      const cents = Number(u.cost_cents);
      costThisMonth += cents;
      if (u.created_at >= todayStart.toISOString()) costToday += cents;
      if (u.agent_id) {
        agentCosts.set(u.agent_id, (agentCosts.get(u.agent_id) ?? 0) + cents);
      }
    }
  }

  // Task completion counts
  const { data: completedTasks } = await supabase
    .from("tasks")
    .select("assigned_to")
    .eq("business_id", businessId)
    .eq("status", "completed");

  const agentTaskCounts = new Map<string, number>();
  for (const t of completedTasks ?? []) {
    if (t.assigned_to) {
      agentTaskCounts.set(t.assigned_to, (agentTaskCounts.get(t.assigned_to) ?? 0) + 1);
    }
  }

  // Build department lookup
  const deptMap = new Map<string, string>();
  for (const d of depts ?? []) {
    deptMap.set(d.id, d.type);
  }

  // Build agent performance with real budgets
  const agentPerformance = (agents ?? []).map((agent) => {
    const tokensUsed = agentTokens.get(agent.id) ?? 0;
    // COALESCE: agent override -> template default -> 100k fallback
    const templateBudget = (agent.agent_templates as unknown as { token_budget?: number } | null)?.token_budget;
    const tokenBudget = agent.token_budget ?? templateBudget ?? 100000;
    return {
      agentId: agent.id,
      agentName: agent.name,
      department: deptMap.get(agent.department_id) ?? "unknown",
      tasksCompleted: agentTaskCounts.get(agent.id) ?? 0,
      tokensUsed,
      tokenBudget,
      budgetUtilization: tokenBudget > 0 ? (tokensUsed / tokenBudget) * 100 : 0,
      costCents: agentCosts.get(agent.id) ?? 0,
    };
  });

  // Flagged agents: >80% amber, >100% red
  const flagged: RevOpsSummary["flagged"] = [];
  for (const a of agentPerformance) {
    if (a.budgetUtilization > 100) {
      flagged.push({
        agentId: a.agentId,
        agentName: a.agentName,
        reason: `Budget exceeded: ${a.budgetUtilization.toFixed(0)}% of ${(a.tokenBudget / 1000).toFixed(0)}k tokens`,
        severity: "red",
      });
    } else if (a.budgetUtilization > 80) {
      flagged.push({
        agentId: a.agentId,
        agentName: a.agentName,
        reason: `High utilization: ${a.budgetUtilization.toFixed(0)}% of ${(a.tokenBudget / 1000).toFixed(0)}k tokens`,
        severity: "amber",
      });
    }
  }

  const budgetTotal = agentPerformance.reduce((s, a) => s + a.tokenBudget, 0);

  return {
    pipeline: {
      totalDeals: 0,
      totalValue: 0,
      byStage: {},
    },
    agentPerformance,
    tokenUsage: {
      today: todayTokens,
      thisWeek: weekTokens,
      thisMonth: monthTokens,
      budgetTotal,
      utilizationPercent: budgetTotal > 0 ? (monthTokens / budgetTotal) * 100 : 0,
      costToday,
      costThisMonth,
    },
    planTier,
    monthlyTokenLimit,
    flagged,
  };
}

// ---------------------------------------------------------------------------
// Usage Analytics (per-tenant, for /businesses/[id]/usage page)
// ---------------------------------------------------------------------------

export interface UsageAnalytics {
  timeSeries: Array<{ date: string; tokens: number; costCents: number; calls: number }>;
  byModel: Array<{ model: string; tokens: number; costCents: number; calls: number }>;
  byProvider: Array<{ provider: string; tokens: number; costCents: number; calls: number }>;
  byAgent: Array<{ agentId: string; agentName: string; tokens: number; costCents: number; calls: number }>;
  byKeySource: Array<{ source: string; tokens: number; costCents: number; calls: number }>;
  summary: {
    totalCalls: number;
    totalTokens: number;
    totalCostCents: number;
    avgLatencyMs: number;
    failedCalls: number;
  };
}

/**
 * Get usage analytics for a specific business over a time period.
 */
export async function getUsageAnalytics(
  supabase: SupabaseClient,
  businessId: string,
  period: "24h" | "7d" | "30d" | "mtd" | "ytd",
): Promise<UsageAnalytics> {
  const now = new Date();
  let from: Date;
  switch (period) {
    case "24h":
      from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "7d":
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "mtd":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "ytd":
      from = new Date(now.getFullYear(), 0, 1);
      break;
  }

  // Fetch all api_usage rows for this business in the period
  const { data } = await supabase
    .from("api_usage")
    .select("model, provider, agent_id, prompt_tokens, completion_tokens, cost_cents, latency_ms, status, key_source, created_at")
    .eq("business_id", businessId)
    .gte("created_at", from.toISOString())
    .order("created_at", { ascending: true });

  const rows = data ?? [];

  // Fetch agent names for lookup
  const agentIds = [...new Set(rows.filter((r) => r.agent_id).map((r) => r.agent_id as string))];
  const agentNameMap = new Map<string, string>();
  if (agentIds.length > 0) {
    const { data: agentData } = await supabase
      .from("agents")
      .select("id, name")
      .in("id", agentIds);
    for (const a of agentData ?? []) {
      agentNameMap.set(a.id, a.name);
    }
  }

  // Determine grouping: by hour for 24h, by day otherwise
  const groupByHour = period === "24h";

  // Aggregation maps
  const timeMap = new Map<string, { tokens: number; costCents: number; calls: number }>();
  const modelMap = new Map<string, { tokens: number; costCents: number; calls: number }>();
  const providerMap = new Map<string, { tokens: number; costCents: number; calls: number }>();
  const agentMap = new Map<string, { agentName: string; tokens: number; costCents: number; calls: number }>();
  const keySourceMap = new Map<string, { tokens: number; costCents: number; calls: number }>();

  let totalCalls = 0;
  let totalTokens = 0;
  let totalCostCents = 0;
  let totalLatency = 0;
  let latencyCount = 0;
  let failedCalls = 0;

  for (const row of rows) {
    const tokens = row.prompt_tokens + row.completion_tokens;
    const cost = Number(row.cost_cents);
    totalCalls++;
    totalTokens += tokens;
    totalCostCents += cost;
    if (row.latency_ms != null) {
      totalLatency += row.latency_ms;
      latencyCount++;
    }
    if (row.status === "failed") failedCalls++;

    // Time series
    const d = new Date(row.created_at);
    const timeKey = groupByHour
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:00`
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const ts = timeMap.get(timeKey) ?? { tokens: 0, costCents: 0, calls: 0 };
    ts.tokens += tokens;
    ts.costCents += cost;
    ts.calls++;
    timeMap.set(timeKey, ts);

    // By model
    const model = (row.model as string) ?? "unknown";
    const ms = modelMap.get(model) ?? { tokens: 0, costCents: 0, calls: 0 };
    ms.tokens += tokens;
    ms.costCents += cost;
    ms.calls++;
    modelMap.set(model, ms);

    // By provider
    const provider = (row.provider as string) ?? "unknown";
    const ps = providerMap.get(provider) ?? { tokens: 0, costCents: 0, calls: 0 };
    ps.tokens += tokens;
    ps.costCents += cost;
    ps.calls++;
    providerMap.set(provider, ps);

    // By agent
    if (row.agent_id) {
      const aid = row.agent_id as string;
      const as_ = agentMap.get(aid) ?? {
        agentName: agentNameMap.get(aid) ?? "Unknown",
        tokens: 0,
        costCents: 0,
        calls: 0,
      };
      as_.tokens += tokens;
      as_.costCents += cost;
      as_.calls++;
      agentMap.set(aid, as_);
    }

    // By key source
    const ks = (row.key_source as string) ?? "platform";
    const kss = keySourceMap.get(ks) ?? { tokens: 0, costCents: 0, calls: 0 };
    kss.tokens += tokens;
    kss.costCents += cost;
    kss.calls++;
    keySourceMap.set(ks, kss);
  }

  // Build sorted arrays
  const timeSeries = [...timeMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  const byModel = [...modelMap.entries()]
    .sort(([, a], [, b]) => b.costCents - a.costCents)
    .map(([model, v]) => ({ model, ...v }));

  const byProvider = [...providerMap.entries()]
    .sort(([, a], [, b]) => b.costCents - a.costCents)
    .map(([provider, v]) => ({ provider, ...v }));

  const byAgent = [...agentMap.entries()]
    .sort(([, a], [, b]) => b.costCents - a.costCents)
    .map(([agentId, v]) => ({ agentId, ...v }));

  const byKeySource = [...keySourceMap.entries()]
    .sort(([, a], [, b]) => b.costCents - a.costCents)
    .map(([source, v]) => ({ source, ...v }));

  return {
    timeSeries,
    byModel,
    byProvider,
    byAgent,
    byKeySource,
    summary: {
      totalCalls,
      totalTokens,
      totalCostCents,
      avgLatencyMs: latencyCount > 0 ? Math.round(totalLatency / latencyCount) : 0,
      failedCalls,
    },
  };
}

// ---------------------------------------------------------------------------
// Live Activity Feed
// ---------------------------------------------------------------------------

/**
 * Get recent activity across all businesses (for C-Suite live feed).
 */
export async function getLiveActivityFeed(
  supabase: SupabaseClient,
  limit = 20,
): Promise<LiveActivityEntry[]> {
  const { data: logs } = await supabase
    .from("audit_logs")
    .select("id, business_id, action, details, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (logs ?? []).map((log) => ({
    id: log.id,
    businessId: log.business_id,
    action: log.action,
    detail: typeof log.details === "string" ? log.details : JSON.stringify(log.details),
    timestamp: log.created_at,
  }));
}
