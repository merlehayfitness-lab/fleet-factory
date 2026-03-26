import type { SupabaseClient } from "@supabase/supabase-js";
import type { TaskStatus, TaskSource } from "../types/index";
import type { CreateTaskInput, UpdateTaskInput } from "./task-schema";
import { assertTaskTransition } from "./task-lifecycle";

/**
 * Create a new task for a business.
 * Inserts with status 'queued' and creates an audit log entry.
 */
export async function createTask(
  supabase: SupabaseClient,
  businessId: string,
  input: CreateTaskInput,
  createdBy: string,
  source: TaskSource = "admin",
  parentTaskId?: string,
) {
  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      business_id: businessId,
      parent_task_id: parentTaskId ?? null,
      department_id: input.department_id,
      created_by: createdBy,
      title: input.title,
      description: input.description ?? null,
      payload: input.payload ?? {},
      priority: input.priority ?? "medium",
      status: "queued",
      source,
    })
    .select("*")
    .single();

  if (error || !task) {
    throw new Error(
      `Failed to create task: ${error?.message ?? "Unknown error"}`,
    );
  }

  // Audit log (best-effort)
  try {
    await supabase.from("audit_logs").insert({
      business_id: businessId,
      actor_id: createdBy,
      action: "task.created",
      entity_type: "task",
      entity_id: task.id,
      metadata: {
        title: input.title,
        priority: input.priority ?? "medium",
        source,
        department_id: input.department_id,
      },
    });
  } catch {
    console.error("Failed to create task audit log");
  }

  return task;
}

/**
 * Fetch tasks for a business with optional filters.
 * Joins department and agent names for display.
 */
export async function getTasksForBusiness(
  supabase: SupabaseClient,
  businessId: string,
  filters?: {
    status?: TaskStatus;
    priority?: string;
    departmentId?: string;
    agentId?: string;
  },
) {
  let query = supabase
    .from("tasks")
    .select(
      "*, departments:department_id(name), agents:assigned_agent_id(name)",
    )
    .eq("business_id", businessId)
    .is("parent_task_id", null) // Only top-level tasks by default
    .order("created_at", { ascending: false });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.priority) {
    query = query.eq("priority", filters.priority);
  }
  if (filters?.departmentId) {
    query = query.eq("department_id", filters.departmentId);
  }
  if (filters?.agentId) {
    query = query.eq("assigned_agent_id", filters.agentId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch tasks: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Fetch a single task by ID with department and agent names.
 */
export async function getTaskById(
  supabase: SupabaseClient,
  taskId: string,
) {
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "*, departments:department_id(name), agents:assigned_agent_id(name)",
    )
    .eq("id", taskId)
    .single();

  if (error || !data) {
    throw new Error(
      `Task not found: ${error?.message ?? "No task with that ID"}`,
    );
  }

  return data;
}

/**
 * Update a task's status with state machine validation.
 * Sets started_at on transition to in_progress, completed_at on completed/failed.
 */
export async function updateTaskStatus(
  supabase: SupabaseClient,
  taskId: string,
  newStatus: TaskStatus,
  updates?: Partial<UpdateTaskInput>,
) {
  // 1. Fetch current task
  const { data: task, error: fetchError } = await supabase
    .from("tasks")
    .select("id, status, business_id, title")
    .eq("id", taskId)
    .single();

  if (fetchError || !task) {
    throw new Error(
      `Task not found: ${fetchError?.message ?? "No task with that ID"}`,
    );
  }

  const previousStatus = task.status as TaskStatus;

  // 2. Validate transition
  assertTaskTransition(previousStatus, newStatus);

  // 3. Build update payload
  const updatePayload: Record<string, unknown> = {
    status: newStatus,
    ...updates,
  };

  // Set timestamps based on transition
  if (newStatus === "in_progress" && previousStatus !== "in_progress") {
    updatePayload.started_at = new Date().toISOString();
  }
  if (newStatus === "completed" || newStatus === "failed") {
    updatePayload.completed_at = new Date().toISOString();
  }

  // 4. Update
  const { data: updated, error: updateError } = await supabase
    .from("tasks")
    .update(updatePayload)
    .eq("id", taskId)
    .select("*")
    .single();

  if (updateError) {
    throw new Error(`Failed to update task status: ${updateError.message}`);
  }

  // 5. Audit log (best-effort)
  try {
    await supabase.from("audit_logs").insert({
      business_id: task.business_id,
      action: "task.status_changed",
      entity_type: "task",
      entity_id: taskId,
      metadata: {
        previous_status: previousStatus,
        new_status: newStatus,
        title: task.title,
      },
    });
  } catch {
    console.error("Failed to create task status audit log");
  }

  return updated;
}

/**
 * Fetch subtasks for a parent task, ordered by creation time.
 */
export async function getSubtasks(
  supabase: SupabaseClient,
  parentTaskId: string,
) {
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "*, departments:department_id(name), agents:assigned_agent_id(name)",
    )
    .eq("parent_task_id", parentTaskId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch subtasks: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Create an assistance request when an agent is blocked.
 * Transitions the task to 'assistance_requested' status.
 */
export async function createAssistanceRequest(
  supabase: SupabaseClient,
  businessId: string,
  taskId: string,
  agentId: string,
  context: string,
  blockingReason: string,
) {
  // Transition task to assistance_requested
  await updateTaskStatus(supabase, taskId, "assistance_requested");

  // Create the request
  const { data: request, error } = await supabase
    .from("assistance_requests")
    .insert({
      business_id: businessId,
      task_id: taskId,
      agent_id: agentId,
      context,
      blocking_reason: blockingReason,
      status: "open",
    })
    .select("*")
    .single();

  if (error || !request) {
    throw new Error(
      `Failed to create assistance request: ${error?.message ?? "Unknown error"}`,
    );
  }

  // Audit log (best-effort)
  try {
    await supabase.from("audit_logs").insert({
      business_id: businessId,
      action: "assistance.requested",
      entity_type: "assistance_request",
      entity_id: request.id,
      metadata: {
        task_id: taskId,
        agent_id: agentId,
        blocking_reason: blockingReason,
      },
    });
  } catch {
    console.error("Failed to create assistance request audit log");
  }

  return request;
}

/**
 * Respond to an assistance request, unblocking the agent.
 * Transitions the task back to 'in_progress'.
 */
export async function respondToAssistanceRequest(
  supabase: SupabaseClient,
  requestId: string,
  response: string,
  respondedBy: string,
) {
  // 1. Fetch the request
  const { data: request, error: fetchError } = await supabase
    .from("assistance_requests")
    .select("id, task_id, business_id, status")
    .eq("id", requestId)
    .single();

  if (fetchError || !request) {
    throw new Error(
      `Assistance request not found: ${fetchError?.message ?? "No request with that ID"}`,
    );
  }

  if (request.status !== "open") {
    throw new Error(
      `Cannot respond to request: status is '${request.status}', expected 'open'`,
    );
  }

  // 2. Update the request
  const { error: updateError } = await supabase
    .from("assistance_requests")
    .update({
      admin_response: response,
      responded_by: respondedBy,
      responded_at: new Date().toISOString(),
      status: "responded",
    })
    .eq("id", requestId);

  if (updateError) {
    throw new Error(
      `Failed to update assistance request: ${updateError.message}`,
    );
  }

  // 3. Transition task back to in_progress
  await updateTaskStatus(supabase, request.task_id, "in_progress");

  // 4. Audit log (best-effort)
  try {
    await supabase.from("audit_logs").insert({
      business_id: request.business_id,
      actor_id: respondedBy,
      action: "assistance.responded",
      entity_type: "assistance_request",
      entity_id: requestId,
      metadata: {
        task_id: request.task_id,
      },
    });
  } catch {
    console.error("Failed to create assistance response audit log");
  }
}
