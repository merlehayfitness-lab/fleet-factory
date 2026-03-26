import type { SupabaseClient } from "@supabase/supabase-js";
import { routeTask } from "./router";
import { decomposeTask, type DecompositionPlan } from "./decomposer";

interface ExecutionResult {
  taskId: string;
  agentId: string | null;
  status: string;
  subtasks?: string[];
  decompositionPlan?: DecompositionPlan[];
  isPreview?: boolean;
}

/**
 * Execute a task through the orchestrator pipeline.
 *
 * Flow:
 * 1. Fetch the task
 * 2. Check if decomposition is needed (based on payload)
 *    - High priority with decomposition: return preview plan for admin confirmation
 *    - Low/medium with decomposition: auto-decompose and route subtasks
 * 3. Route task to department agent
 * 4. Transition to assigned (routing handles this)
 *
 * NOTE: Actual tool execution (worker) is wired in Plan 04-02.
 * This executor handles routing and status management only.
 */
export async function executeTask(
  supabase: SupabaseClient,
  businessId: string,
  taskId: string,
): Promise<ExecutionResult> {
  // 1. Fetch the task
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .single();

  if (taskError || !task) {
    throw new Error(
      `Task not found: ${taskError?.message ?? "No task with that ID"}`,
    );
  }

  // 2. Fetch departments for potential decomposition
  const { data: departments } = await supabase
    .from("departments")
    .select("id, name, type")
    .eq("business_id", businessId);

  // 3. Check if decomposition is needed
  const payload = (task.payload as Record<string, unknown>) ?? {};
  const hasDepartments =
    Array.isArray(payload.departments) && payload.departments.length > 0;

  if (hasDepartments && departments) {
    const { plan, subtaskIds, isPreview } = await decomposeTask(
      supabase,
      {
        id: task.id as string,
        business_id: task.business_id as string,
        title: task.title as string,
        description: task.description as string | null,
        priority: task.priority as string,
        payload: payload,
        created_by: task.created_by as string | null,
      },
      departments.map((d) => ({
        id: d.id as string,
        name: d.name as string,
        type: d.type as string,
      })),
    );

    // High priority preview: return plan without executing
    if (isPreview) {
      return {
        taskId: task.id as string,
        agentId: null,
        status: "queued",
        decompositionPlan: plan,
        isPreview: true,
      };
    }

    // Decomposed: route each subtask
    if (subtaskIds.length > 0) {
      for (const subtaskId of subtaskIds) {
        try {
          // Fetch the subtask to get its department_id
          const { data: subtask } = await supabase
            .from("tasks")
            .select("department_id")
            .eq("id", subtaskId)
            .single();

          if (subtask?.department_id) {
            await routeTask(
              supabase,
              businessId,
              subtaskId,
              subtask.department_id as string,
            );
          }
        } catch (err) {
          // Log routing failure but continue with other subtasks
          console.error(
            `Failed to route subtask ${subtaskId}:`,
            err instanceof Error ? err.message : "Unknown error",
          );
        }
      }

      return {
        taskId: task.id as string,
        agentId: null,
        status: "assigned",
        subtasks: subtaskIds,
      };
    }
  }

  // 4. Simple task: route directly to agent
  if (!task.department_id) {
    throw new Error(
      "Task has no department_id. A department must be specified for routing.",
    );
  }

  const agent = await routeTask(
    supabase,
    businessId,
    taskId,
    task.department_id as string,
  );

  return {
    taskId: task.id as string,
    agentId: agent.id as string,
    status: "assigned",
  };
}
