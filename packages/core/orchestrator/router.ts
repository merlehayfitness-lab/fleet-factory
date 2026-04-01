import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Select an active agent in a department for task assignment.
 * MVP: picks the first active agent (typically one per department).
 */
export async function selectAgent(
  supabase: SupabaseClient,
  departmentId: string,
  businessId: string,
) {
  const { data: agents, error } = await supabase
    .from("agents")
    .select("id, name, status, model_profile")
    .eq("department_id", departmentId)
    .eq("business_id", businessId)
    .eq("status", "active")
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch agents: ${error.message}`);
  }

  return agents && agents.length > 0 ? agents[0] : null;
}

/**
 * Route a task to the appropriate department agent.
 *
 * 1. Finds an active agent in the specified department
 * 2. Assigns the agent to the task
 * 3. Transitions the task to 'assigned'
 * 4. Creates an audit log entry
 */
export async function routeTask(
  supabase: SupabaseClient,
  businessId: string,
  taskId: string,
  departmentId: string,
) {
  // 1. Select an agent
  const agent = await selectAgent(supabase, departmentId, businessId);

  if (!agent) {
    throw new Error(
      "No active agents in department. Ensure the department has at least one active agent.",
    );
  }

  // 2. Update task with agent assignment and transition to 'assigned'
  const { error: updateError } = await supabase
    .from("tasks")
    .update({
      assigned_agent_id: agent.id,
      status: "assigned",
    })
    .eq("id", taskId);

  if (updateError) {
    throw new Error(`Failed to assign task to agent: ${updateError.message}`);
  }

  // 3. Audit log (best-effort)
  try {
    await supabase.from("audit_logs").insert({
      business_id: businessId,
      action: "task.routed",
      entity_type: "task",
      entity_id: taskId,
      metadata: {
        agent_id: agent.id,
        agent_name: agent.name,
        department_id: departmentId,
      },
    });
  } catch {
    console.error("Failed to create task routing audit log");
  }

  return agent;
}
