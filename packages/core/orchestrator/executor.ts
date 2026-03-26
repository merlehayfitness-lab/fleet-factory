import type { SupabaseClient } from "@supabase/supabase-js";
import { routeTask } from "./router";
import { decomposeTask, type DecompositionPlan } from "./decomposer";
import { runAgentTask } from "../worker/tool-runner";
import { createAssistanceRequest } from "../task/task-service";

interface ExecutionResult {
  taskId: string;
  agentId: string | null;
  status: string;
  subtasks?: string[];
  decompositionPlan?: DecompositionPlan[];
  isPreview?: boolean;
  needsApproval?: boolean;
  approvalAction?: string;
  approvalRiskLevel?: string;
  approvalToolName?: string;
  tokenUsage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
  costCents?: number;
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
 * 4. Execute task via worker (runAgentTask)
 *    - If worker returns needsApproval: transition to 'waiting_approval'
 *    - If worker succeeds: transition to 'completed'
 *    - If worker fails: create assistance request
 * 5. Record token usage and cost
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
    // No department -- create assistance request instead of throwing
    try {
      await createAssistanceRequest(
        supabase,
        businessId,
        taskId,
        "system",
        `Task "${task.title}" has no department_id`,
        "A department must be specified for routing. Please assign a department and retry.",
      );
    } catch {
      // Best-effort
    }
    return {
      taskId: task.id as string,
      agentId: null,
      status: "assistance_requested",
    };
  }

  let agent;
  try {
    agent = await routeTask(
      supabase,
      businessId,
      taskId,
      task.department_id as string,
    );
  } catch (routeErr) {
    // Routing failed (no active agents) -- create assistance request
    const routeMessage = routeErr instanceof Error ? routeErr.message : "Routing failed";
    try {
      await createAssistanceRequest(
        supabase,
        businessId,
        taskId,
        "system",
        `Task "${task.title}" could not be routed`,
        routeMessage,
      );
    } catch {
      // Best-effort
    }
    return {
      taskId: task.id as string,
      agentId: null,
      status: "assistance_requested",
    };
  }

  // 5. Fetch full agent record with tool_profile and is_trusted
  const { data: agentRecord } = await supabase
    .from("agents")
    .select("id, name, tool_profile, is_trusted")
    .eq("id", agent.id)
    .single();

  if (!agentRecord) {
    // Agent disappeared after routing -- create assistance request
    try {
      await createAssistanceRequest(
        supabase,
        businessId,
        taskId,
        "system",
        `Agent not found after routing for task "${task.title}"`,
        `Agent ID ${agent.id} was selected but could not be fetched.`,
      );
    } catch {
      // Best-effort
    }
    return {
      taskId: task.id as string,
      agentId: agent.id,
      status: "assistance_requested",
    };
  }

  // 6. Fetch the department type for tool catalog lookup
  const { data: dept } = await supabase
    .from("departments")
    .select("type")
    .eq("id", task.department_id)
    .single();

  const departmentType = (dept?.type as string) ?? "operations";

  // 7. Transition task to in_progress before execution
  await supabase
    .from("tasks")
    .update({
      status: "in_progress",
      started_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  // 8. Execute via worker
  const workerResult = await runAgentTask(
    supabase,
    businessId,
    {
      id: task.id as string,
      title: task.title as string,
      priority: task.priority as string,
      payload,
    },
    {
      id: agentRecord.id as string,
      name: agentRecord.name as string,
      tool_profile: (agentRecord.tool_profile as Record<string, unknown>) ?? {},
      is_trusted: (agentRecord.is_trusted as boolean) ?? false,
    },
    departmentType,
  );

  // 9. Handle worker result
  if (workerResult.needsApproval) {
    // Transition to waiting_approval -- approval creation happens in 04-03
    await supabase
      .from("tasks")
      .update({ status: "waiting_approval" })
      .eq("id", taskId);

    return {
      taskId: task.id as string,
      agentId: agentRecord.id as string,
      status: "waiting_approval",
      needsApproval: true,
      approvalAction: workerResult.approvalAction,
      approvalRiskLevel: workerResult.approvalRiskLevel,
      approvalToolName: workerResult.approvalToolName,
    };
  }

  if (workerResult.status === "failed") {
    // Create assistance request instead of auto-failing (per CONTEXT decisions)
    try {
      await createAssistanceRequest(
        supabase,
        businessId,
        task.id as string,
        agentRecord.id as string,
        `Task "${task.title}" failed during tool execution`,
        workerResult.error ?? "Tool execution failed",
      );
    } catch (err) {
      // If assistance request also fails, transition to failed
      console.error(
        "Failed to create assistance request, marking task as failed:",
        err instanceof Error ? err.message : "Unknown error",
      );
      await supabase
        .from("tasks")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", taskId);
    }

    return {
      taskId: task.id as string,
      agentId: agentRecord.id as string,
      status: "assistance_requested",
      tokenUsage: workerResult.tokenUsage,
      costCents: workerResult.costCents,
    };
  }

  // Success: transition to completed
  await supabase
    .from("tasks")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  return {
    taskId: task.id as string,
    agentId: agentRecord.id as string,
    status: "completed",
    tokenUsage: workerResult.tokenUsage,
    costCents: workerResult.costCents,
  };
}
