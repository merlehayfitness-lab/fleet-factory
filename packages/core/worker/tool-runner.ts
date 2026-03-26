/**
 * Worker tool runner.
 *
 * Executes tools on behalf of agents with sandbox validation,
 * allowlist checks, mock results, and usage metering.
 *
 * IMPORTANT: Uses only the RLS-scoped Supabase client passed in.
 * Never creates a service_role client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TaskPriority } from "../types/index";
import { assertSandbox, validateToolAccess } from "./sandbox";
import { getMockResult, getToolRiskLevel, getToolsForDepartment } from "./tool-catalog";
import { estimateTokens, calculateCost, recordUsage } from "./metering";

interface ToolResult {
  success: boolean;
  toolName: string;
  result?: Record<string, unknown>;
  error?: string;
  riskLevel: "low" | "medium" | "high";
}

interface AgentTaskResult {
  taskId: string;
  agentId: string;
  status: "completed" | "needs_approval" | "failed";
  toolResults: ToolResult[];
  needsApproval?: boolean;
  approvalAction?: string;
  approvalRiskLevel?: string;
  approvalToolName?: string;
  tokenUsage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
  costCents?: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Single tool execution
// ---------------------------------------------------------------------------

/**
 * Execute a single tool on behalf of an agent.
 *
 * 1. Validates sandbox (rejects blocked capabilities)
 * 2. Validates tool access (department catalog + agent allowlist)
 * 3. Returns mock result from tool catalog
 *
 * NOTE: Does NOT check approvals -- approval gate check happens
 * in the executor before calling runTool.
 */
export function runTool(
  agentToolProfile: Record<string, unknown>,
  toolName: string,
  payload: Record<string, unknown>,
  departmentType: string,
): ToolResult {
  // 1. Sandbox validation
  assertSandbox(agentToolProfile);

  // 2. Tool access validation
  const hasAccess = validateToolAccess(toolName, agentToolProfile, departmentType);
  if (!hasAccess) {
    return {
      success: false,
      toolName,
      error: `Tool '${toolName}' not allowed for agent in '${departmentType}' department`,
      riskLevel: getToolRiskLevel(toolName),
    };
  }

  // 3. Execute with mock result
  const result = getMockResult(toolName, payload);
  const riskLevel = getToolRiskLevel(toolName);

  return {
    success: true,
    toolName,
    result,
    riskLevel,
  };
}

// ---------------------------------------------------------------------------
// Full agent task execution
// ---------------------------------------------------------------------------

/**
 * Execute a full agent task.
 *
 * Flow:
 * 1. Validate sandbox for this agent
 * 2. Determine which tools to use based on task payload and department
 * 3. For each tool, check risk level:
 *    - High risk: return { needsApproval: true } -- approval handled in 04-03
 *    - Medium risk + agent.is_trusted: auto-approve and execute
 *    - Medium risk + not trusted: return { needsApproval: true }
 *    - Low risk: auto-approve and execute
 * 4. Execute approved tools
 * 5. Record usage via metering
 * 6. Update task with result, token_usage, cost_cents
 * 7. Return execution result
 *
 * IMPORTANT: Uses RLS-scoped supabase client passed in. Never creates service_role client.
 */
export async function runAgentTask(
  supabase: SupabaseClient,
  businessId: string,
  task: {
    id: string;
    title: string;
    priority: string;
    payload: Record<string, unknown>;
  },
  agent: {
    id: string;
    name: string;
    tool_profile: Record<string, unknown>;
    is_trusted: boolean;
  },
  departmentType: string,
): Promise<AgentTaskResult> {
  const toolProfile = agent.tool_profile ?? {};

  // 1. Validate sandbox
  try {
    assertSandbox(toolProfile);
  } catch (err) {
    return {
      taskId: task.id,
      agentId: agent.id,
      status: "failed",
      toolResults: [],
      error: err instanceof Error ? err.message : "Sandbox validation failed",
    };
  }

  // 2. Determine which tools to use
  const requestedTools = resolveToolsForTask(task.payload, departmentType);

  if (requestedTools.length === 0) {
    // No specific tools requested -- use a default read tool for the department
    const departmentTools = getToolsForDepartment(departmentType);
    const defaultTool = departmentTools.find((t) => t.riskLevel === "low");
    if (defaultTool) {
      requestedTools.push(defaultTool.name);
    }
  }

  // 3. Check risk levels and approval requirements
  const toolResults: ToolResult[] = [];

  for (const toolName of requestedTools) {
    const riskLevel = getToolRiskLevel(toolName);

    // High risk: always needs approval
    if (riskLevel === "high") {
      return {
        taskId: task.id,
        agentId: agent.id,
        status: "needs_approval",
        toolResults,
        needsApproval: true,
        approvalAction: `Execute high-risk tool: ${toolName}`,
        approvalRiskLevel: riskLevel,
        approvalToolName: toolName,
      };
    }

    // Medium risk: needs approval unless agent is trusted
    if (riskLevel === "medium" && !agent.is_trusted) {
      return {
        taskId: task.id,
        agentId: agent.id,
        status: "needs_approval",
        toolResults,
        needsApproval: true,
        approvalAction: `Execute medium-risk tool: ${toolName} (agent not trusted)`,
        approvalRiskLevel: riskLevel,
        approvalToolName: toolName,
      };
    }

    // Low risk or medium+trusted: execute
    const result = runTool(toolProfile, toolName, task.payload, departmentType);
    toolResults.push(result);

    if (!result.success) {
      return {
        taskId: task.id,
        agentId: agent.id,
        status: "failed",
        toolResults,
        error: result.error,
      };
    }
  }

  // 5. Record usage via metering
  const tokens = estimateTokens(task.priority as TaskPriority, requestedTools.length);
  const costCents = calculateCost(tokens.prompt_tokens, tokens.completion_tokens);

  await recordUsage(supabase, businessId, task.id, agent.id, tokens);

  // 6. Update task with result and metering data
  try {
    await supabase
      .from("tasks")
      .update({
        result: {
          tools_used: toolResults.map((r) => r.toolName),
          tool_results: toolResults.map((r) => ({
            tool: r.toolName,
            success: r.success,
            result: r.result,
          })),
          completed_at: new Date().toISOString(),
        },
        token_usage: {
          prompt_tokens: tokens.prompt_tokens,
          completion_tokens: tokens.completion_tokens,
          model: "claude-sonnet",
        },
        cost_cents: costCents,
      })
      .eq("id", task.id);
  } catch (err) {
    console.error(
      "Failed to update task with execution result:",
      err instanceof Error ? err.message : "Unknown error",
    );
  }

  // 7. Return result
  return {
    taskId: task.id,
    agentId: agent.id,
    status: "completed",
    toolResults,
    tokenUsage: tokens,
    costCents,
  };
}

// ---------------------------------------------------------------------------
// Helper: Resolve tools for a task
// ---------------------------------------------------------------------------

/**
 * Determine which tools an agent should use for a task.
 *
 * Checks task.payload.tools (explicit list) or infers from task context
 * and department type. Returns tool names.
 */
function resolveToolsForTask(
  payload: Record<string, unknown>,
  departmentType: string,
): string[] {
  // Explicit tool list in payload
  if (Array.isArray(payload.tools)) {
    return payload.tools.filter((t): t is string => typeof t === "string");
  }

  // If action hint is provided, try to match to a department tool
  if (typeof payload.action === "string") {
    const departmentTools = getToolsForDepartment(departmentType);
    const match = departmentTools.find(
      (t) => t.name === payload.action || t.category === payload.action,
    );
    if (match) {
      return [match.name];
    }
  }

  return [];
}
