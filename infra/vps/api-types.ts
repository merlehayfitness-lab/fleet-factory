/**
 * VPS API proxy type definitions.
 *
 * Re-defined locally to avoid monorepo dependency.
 * These mirror packages/core/vps/vps-types.ts and MUST stay in sync.
 */

/** Full deployment payload sent from admin app */
export interface DeployPayload {
  businessId: string;
  businessSlug: string;
  deploymentId: string;
  version: number;
  isRollback: boolean;
  skipOptimization: boolean;
  agents: Array<{
    agentId: string;
    vpsAgentId: string;
    departmentType: string;
    model: string;
  }>;
  workspaceFiles: Array<{ path: string; content: string }>;
  openclawConfig: string;
}

/** Result returned after deployment */
export interface DeployResult {
  success: boolean;
  deployId: string;
  agentResults: Array<{
    agentId: string;
    vpsAgentId: string;
    status: "deployed" | "failed";
    error?: string;
  }>;
  optimizationReport?: {
    changes: Array<{ file: string; description: string }>;
    summary: string;
  };
  error?: string;
}

/** Chat request from admin app */
export interface ChatRequest {
  businessId: string;
  agentId: string;
  vpsAgentId: string;
  conversationId: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/** Chat response to admin app */
export interface ChatResponse {
  content: string;
  agentId: string;
  toolCalls?: Array<{
    toolName: string;
    summary: string;
    inputs?: Record<string, unknown>;
    outputs?: Record<string, unknown>;
  }>;
}

/** Task execution request from admin app */
export interface TaskRequest {
  businessId: string;
  agentId: string;
  vpsAgentId: string;
  taskId: string;
  title: string;
  priority?: string;
  payload: Record<string, unknown>;
}

/** Task execution result */
export interface TaskResult {
  taskId: string;
  success: boolean;
  result?: Record<string, unknown>;
  toolsUsed?: string[];
  tokenUsage?: { prompt_tokens: number; completion_tokens: number };
  error?: string;
}

/** VPS health status */
export interface HealthStatus {
  status: "online" | "offline" | "degraded";
  timestamp: string;
  agentCount: number;
  details?: Record<string, unknown>;
}

/** Per-agent health status */
export interface AgentHealthStatus {
  vpsAgentId: string;
  status: "running" | "stopped" | "error";
  lastResponseAt?: string;
  metadata?: Record<string, unknown>;
}

/** Deployment progress event for WebSocket streaming */
export interface DeployProgressEvent {
  type: "phase" | "detail" | "agent_status" | "complete" | "error";
  phase?: string;
  message: string;
  agentId?: string;
  timestamp: string;
}

/** Chat streaming event for WebSocket */
export interface ChatStreamEvent {
  type: "token" | "complete" | "error";
  content?: string;
  agentId?: string;
  error?: string;
  timestamp: string;
}

/** In-memory deployment state tracking */
export interface DeploymentState {
  deployId: string;
  status: "in_progress" | "completed" | "failed" | "cancelled";
  startedAt: string;
  completedAt?: string;
  result?: DeployResult;
}

/** Terminal WebSocket message from client */
export interface TerminalMessage {
  type: "resize" | "input";
  cols?: number;
  rows?: number;
  data?: string;
}

/** Tenant stop/resume request */
export interface TenantLifecycleRequest {
  businessId: string;
  businessSlug: string;
}

/** Tenant stop/resume response */
export interface TenantLifecycleResponse {
  success: boolean;
  stoppedCount?: number;
  resumedCount?: number;
  error?: string;
}
