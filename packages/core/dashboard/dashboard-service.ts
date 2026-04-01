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
  }>;
  tokenUsage: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    budgetTotal: number;
    utilizationPercent: number;
  };
  flagged: Array<{
    agentId: string;
    agentName: string;
    reason: string;
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

  // Fetch today's token usage per business
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: usage } = await supabase
    .from("api_usage")
    .select("business_id, prompt_tokens, completion_tokens")
    .gte("created_at", todayStart.toISOString());

  const usageByBiz = new Map<string, number>();
  for (const u of usage ?? []) {
    if (u.business_id) {
      usageByBiz.set(
        u.business_id,
        (usageByBiz.get(u.business_id) ?? 0) + u.prompt_tokens + u.completion_tokens,
      );
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
    totalCostToday: 0, // TODO: calculate from api_usage.cost_cents
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
  // Agent performance
  const { data: agents } = await supabase
    .from("agents")
    .select("id, name, status")
    .eq("business_id", businessId);

  const { data: depts } = await supabase
    .from("departments")
    .select("id, type")
    .eq("business_id", businessId);

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
    .select("agent_id, prompt_tokens, completion_tokens, created_at")
    .eq("business_id", businessId)
    .gte("created_at", monthStart.toISOString());

  let todayTokens = 0;
  let weekTokens = 0;
  let monthTokens = 0;
  const agentTokens = new Map<string, number>();

  for (const u of monthUsage ?? []) {
    const tokens = u.prompt_tokens + u.completion_tokens;
    monthTokens += tokens;
    if (u.created_at >= weekStart.toISOString()) weekTokens += tokens;
    if (u.created_at >= todayStart.toISOString()) todayTokens += tokens;
    if (u.agent_id) {
      agentTokens.set(u.agent_id, (agentTokens.get(u.agent_id) ?? 0) + tokens);
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

  // Build agent performance
  const agentPerformance = (agents ?? []).map((agent) => {
    const tokensUsed = agentTokens.get(agent.id) ?? 0;
    const tokenBudget = 100000; // TODO: pull from template
    return {
      agentId: agent.id,
      agentName: agent.name,
      department: depts?.find((d) => d.id)?.type ?? "unknown",
      tasksCompleted: agentTaskCounts.get(agent.id) ?? 0,
      tokensUsed,
      tokenBudget,
      budgetUtilization: tokenBudget > 0 ? (tokensUsed / tokenBudget) * 100 : 0,
    };
  });

  // Flagged agents (< 50% budget utilization or errors)
  const flagged = agentPerformance
    .filter((a) => a.budgetUtilization > 0 && a.budgetUtilization < 50)
    .map((a) => ({
      agentId: a.agentId,
      agentName: a.agentName,
      reason: `Low utilization: ${a.budgetUtilization.toFixed(0)}% of budget`,
    }));

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
    },
    flagged,
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
