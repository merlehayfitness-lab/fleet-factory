/** Agent workspace file in a deployment package */
export interface WorkspaceFile {
  path: string; // e.g. "workspace-sales/AGENTS.md"
  content: string;
}

/** Full deployment payload sent to VPS */
export interface VpsDeployPayload {
  businessId: string;
  businessSlug: string;
  deploymentId: string;
  version: number;
  isRollback: boolean;
  skipOptimization: boolean; // true for rollbacks
  agents: Array<{
    agentId: string;
    vpsAgentId: string; // namespaced: {slug}-{dept}-{prefix}
    departmentType: string;
    model: string;
  }>;
  workspaceFiles: WorkspaceFile[];
  openclawConfig: string; // stringified openclaw.json
}

/** Result from VPS after deployment */
export interface VpsDeployResult {
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

/** VPS health check response */
export interface VpsHealthStatus {
  status: "online" | "offline" | "degraded";
  timestamp: string;
  agentCount: number;
  details?: Record<string, unknown>;
}

/** Per-agent health from VPS */
export interface VpsAgentHealthStatus {
  vpsAgentId: string;
  status: "running" | "stopped" | "error";
  lastResponseAt?: string;
  metadata?: Record<string, unknown>;
}

/** Deployment progress event from WebSocket */
export interface VpsDeployProgressEvent {
  type: "phase" | "detail" | "agent_status" | "complete" | "error";
  phase?: string;
  message: string;
  agentId?: string;
  timestamp: string;
}

/** Chat request to VPS agent */
export interface VpsChatRequest {
  businessId: string;
  agentId: string;
  vpsAgentId: string;
  conversationId: string;
  message: string;
  knowledgeContext?: string; // RAG context from knowledge base retrieval
  metadata?: Record<string, unknown>;
}

/** Chat response from VPS agent */
export interface VpsChatResponse {
  content: string;
  agentId: string;
  toolCalls?: Array<{
    toolName: string;
    summary: string;
    inputs?: Record<string, unknown>;
    outputs?: Record<string, unknown>;
  }>;
}

/** Async chat submit response from VPS (returned immediately) */
export interface AsyncChatSubmitResponse {
  requestId: string;
  status: "processing";
}

/** Async chat poll response from VPS */
export interface AsyncChatPollResponse {
  requestId: string;
  status: "processing" | "complete" | "failed";
  result?: VpsChatResponse;
  error?: string;
}

/** Task execution request to VPS */
export interface VpsTaskRequest {
  businessId: string;
  agentId: string;
  vpsAgentId: string;
  taskId: string;
  title: string;
  payload: Record<string, unknown>;
  knowledgeContext?: string; // RAG context from knowledge base retrieval
}

/** Task execution result from VPS */
export interface VpsTaskResult {
  taskId: string;
  success: boolean;
  result?: Record<string, unknown>;
  toolsUsed?: string[];
  tokenUsage?: { prompt_tokens: number; completion_tokens: number };
  error?: string;
}
