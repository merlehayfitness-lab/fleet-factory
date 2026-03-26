/**
 * Health metrics aggregation service for per-tenant observability.
 *
 * All queries are scoped by business_id and use an RLS-scoped Supabase client.
 * Accept SupabaseClient as first arg (follows existing service pattern).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

/** Agent with health metadata */
export interface AgentHealthItem {
  id: string;
  name: string;
  status: string;
  lastTaskAt: string | null;
  errorCount: number;
}

/** Department with its agents */
export interface DepartmentHealth {
  departmentId: string;
  departmentName: string;
  departmentType: string;
  agents: AgentHealthItem[];
}

/** Agent health summary grouped by department */
export interface AgentHealthSummary {
  departments: DepartmentHealth[];
}

/** Error rate metrics */
export interface ErrorRate {
  failedCount: number;
  totalCount: number;
  rate: number;
  assistanceRequestCount: number;
}

/** Task throughput metrics */
export interface TaskThroughput {
  completedCount: number;
  queuedCount: number;
  avgCompletionMinutes: number | null;
}

/** Recent activity entry from audit_logs */
export interface ActivityEntry {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  actorId: string | null;
}

/** Combined system health payload */
export interface SystemHealth {
  agentHealth: AgentHealthSummary;
  errorRate: ErrorRate;
  taskThroughput: TaskThroughput;
  recentActivity: ActivityEntry[];
  latestDeployment: {
    id: string;
    status: string;
    version: number;
    created_at: string;
  } | null;
  pendingApprovals: number;
  activeTasks: number;
}

/**
 * Get agent health summary grouped by department.
 * Excludes retired agents. Joins with departments for name/type,
 * and aggregates task data for lastTaskAt and errorCount.
 */
export async function getAgentHealthSummary(
  supabase: SupabaseClient,
  businessId: string,
): Promise<AgentHealthSummary> {
  // Fetch departments
  const { data: departments } = await supabase
    .from("departments")
    .select("id, name, type")
    .eq("business_id", businessId)
    .order("type");

  // Fetch non-retired agents
  const { data: agents } = await supabase
    .from("agents")
    .select("id, name, status, department_id")
    .eq("business_id", businessId)
    .neq("status", "retired");

  // Fetch last completed task per agent
  const { data: lastTasks } = await supabase
    .from("tasks")
    .select("assigned_agent_id, completed_at")
    .eq("business_id", businessId)
    .not("completed_at", "is", null)
    .not("assigned_agent_id", "is", null)
    .order("completed_at", { ascending: false });

  // Fetch failed task counts per agent
  const { data: failedTasks } = await supabase
    .from("tasks")
    .select("assigned_agent_id")
    .eq("business_id", businessId)
    .eq("status", "failed")
    .not("assigned_agent_id", "is", null);

  // Build lookup maps
  const lastTaskMap = new Map<string, string>();
  for (const task of lastTasks ?? []) {
    const agentId = task.assigned_agent_id as string;
    if (!lastTaskMap.has(agentId)) {
      lastTaskMap.set(agentId, task.completed_at as string);
    }
  }

  const errorCountMap = new Map<string, number>();
  for (const task of failedTasks ?? []) {
    const agentId = task.assigned_agent_id as string;
    errorCountMap.set(agentId, (errorCountMap.get(agentId) ?? 0) + 1);
  }

  // Group agents by department
  const deptMap = new Map<string, AgentHealthItem[]>();
  for (const agent of agents ?? []) {
    const deptId = agent.department_id as string;
    if (!deptMap.has(deptId)) {
      deptMap.set(deptId, []);
    }
    deptMap.get(deptId)!.push({
      id: agent.id as string,
      name: agent.name as string,
      status: agent.status as string,
      lastTaskAt: lastTaskMap.get(agent.id as string) ?? null,
      errorCount: errorCountMap.get(agent.id as string) ?? 0,
    });
  }

  const result: DepartmentHealth[] = (departments ?? []).map(
    (dept: { id: string; name: string; type: string }) => ({
      departmentId: dept.id,
      departmentName: dept.name,
      departmentType: dept.type,
      agents: deptMap.get(dept.id) ?? [],
    }),
  );

  return { departments: result };
}

/**
 * Get error rate for the business within a time window.
 * Computes failed vs total tasks and open assistance request count.
 */
export async function getErrorRate(
  supabase: SupabaseClient,
  businessId: string,
  timeWindowHours = 24,
): Promise<ErrorRate> {
  const since = new Date(
    Date.now() - timeWindowHours * 60 * 60 * 1000,
  ).toISOString();

  const { count: totalCount } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .gte("created_at", since);

  const { count: failedCount } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("status", "failed")
    .gte("created_at", since);

  const { count: assistanceRequestCount } = await supabase
    .from("assistance_requests")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("status", "open");

  const total = totalCount ?? 0;
  const failed = failedCount ?? 0;

  return {
    failedCount: failed,
    totalCount: total,
    rate: total > 0 ? failed / total : 0,
    assistanceRequestCount: assistanceRequestCount ?? 0,
  };
}

/**
 * Get task throughput for the business within a time window.
 * Counts completed tasks, queued tasks (backlog), and average completion time.
 */
export async function getTaskThroughput(
  supabase: SupabaseClient,
  businessId: string,
  timeWindowHours = 24,
): Promise<TaskThroughput> {
  const since = new Date(
    Date.now() - timeWindowHours * 60 * 60 * 1000,
  ).toISOString();

  const { count: completedCount } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("status", "completed")
    .gte("completed_at", since);

  const { count: queuedCount } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .in("status", ["queued", "assigned"]);

  // Fetch tasks with both started_at and completed_at for avg calculation
  const { data: completedTasks } = await supabase
    .from("tasks")
    .select("started_at, completed_at")
    .eq("business_id", businessId)
    .eq("status", "completed")
    .not("started_at", "is", null)
    .not("completed_at", "is", null)
    .gte("completed_at", since);

  let avgCompletionMinutes: number | null = null;
  if (completedTasks && completedTasks.length > 0) {
    let totalMs = 0;
    for (const task of completedTasks) {
      const start = new Date(task.started_at as string).getTime();
      const end = new Date(task.completed_at as string).getTime();
      totalMs += end - start;
    }
    avgCompletionMinutes = Math.round(totalMs / completedTasks.length / 60000);
  }

  return {
    completedCount: completedCount ?? 0,
    queuedCount: queuedCount ?? 0,
    avgCompletionMinutes,
  };
}

/**
 * Get recent activity from audit_logs for the business.
 */
export async function getRecentActivity(
  supabase: SupabaseClient,
  businessId: string,
  limit = 10,
): Promise<ActivityEntry[]> {
  const { data } = await supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, metadata, created_at, actor_id")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map(
    (row: {
      id: string;
      action: string;
      entity_type: string | null;
      entity_id: string | null;
      metadata: Record<string, unknown>;
      created_at: string;
      actor_id: string | null;
    }) => ({
      id: row.id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
      actorId: row.actor_id,
    }),
  );
}

/**
 * Get combined system health payload for a business.
 * Aggregates agent health, error rate, task throughput, recent activity,
 * latest deployment, pending approvals, and active tasks.
 */
export async function getSystemHealth(
  supabase: SupabaseClient,
  businessId: string,
): Promise<SystemHealth> {
  // Run all queries in parallel
  const [
    agentHealth,
    errorRate,
    taskThroughput,
    recentActivity,
    deploymentResult,
    approvalResult,
    taskResult,
  ] = await Promise.all([
    getAgentHealthSummary(supabase, businessId),
    getErrorRate(supabase, businessId),
    getTaskThroughput(supabase, businessId),
    getRecentActivity(supabase, businessId),
    supabase
      .from("deployments")
      .select("id, status, version, created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("approvals")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "pending"),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .in("status", ["queued", "assigned", "in_progress", "waiting_approval"]),
  ]);

  return {
    agentHealth,
    errorRate,
    taskThroughput,
    recentActivity,
    latestDeployment: deploymentResult.data ?? null,
    pendingApprovals: approvalResult.count ?? 0,
    activeTasks: taskResult.count ?? 0,
  };
}
