/**
 * VPS task execution routing service.
 *
 * Routes task execution from the admin app to real VPS agents
 * for actual tool execution instead of mock results.
 */

import { vpsPost } from "./vps-client";
import type { VpsTaskResult } from "./vps-types";

/**
 * Send a task to a VPS agent for execution.
 *
 * POSTs to /api/agents/{vpsAgentId}/task on the VPS.
 * On error, returns a failure result indicating the VPS agent is unreachable.
 */
export async function sendTaskToVps(
  businessId: string,
  agentId: string,
  vpsAgentId: string,
  task: {
    id: string;
    title: string;
    priority: string;
    payload: Record<string, unknown>;
  },
  knowledgeContext?: string,
): Promise<VpsTaskResult> {
  try {
    const payload: Record<string, unknown> = {
      businessId,
      agentId,
      vpsAgentId,
      taskId: task.id,
      title: task.title,
      priority: task.priority,
      payload: task.payload,
    };
    if (knowledgeContext) {
      payload.knowledgeContext = knowledgeContext;
    }
    const result = await vpsPost<VpsTaskResult>(
      `/api/agents/${encodeURIComponent(vpsAgentId)}/task`,
      payload,
    );

    if (result.error) {
      return {
        taskId: task.id,
        success: false,
        error: `VPS agent error: ${result.error}`,
      };
    }

    return {
      taskId: result.taskId ?? task.id,
      success: result.success ?? false,
      result: result.result,
      toolsUsed: result.toolsUsed,
      tokenUsage: result.tokenUsage,
      error: result.error,
    };
  } catch {
    return {
      taskId: task.id,
      success: false,
      error: "VPS agent unreachable",
    };
  }
}
