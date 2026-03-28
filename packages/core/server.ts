// @agency-factory/core/server
// Server-only exports that depend on Node.js APIs (crypto, runtime generators).
// Import from "@agency-factory/core/server" in Server Components and Server Actions.
// Do NOT import from this file in Client Components.

// Crypto (uses node:crypto)
export { encrypt, decrypt } from "./crypto/encryption";

// Deployment service (imports from @agency-factory/runtime, uses crypto indirectly)
export {
  triggerDeployment,
  retryDeployment,
  rollbackDeployment,
  getDeploymentHistory,
} from "./deployment/service";

// Secrets service (uses crypto for encrypt/decrypt)
export {
  getSecrets,
  saveSecret,
  deleteSecret,
  decryptSecretsForDeployment,
} from "./secrets/service";

// Task service (CRUD operations for tasks and assistance requests)
export {
  createTask,
  getTasksForBusiness,
  getTaskById,
  updateTaskStatus,
  getSubtasks,
  createAssistanceRequest,
  respondToAssistanceRequest,
} from "./task/task-service";

// Orchestrator (task routing, decomposition, execution)
export { routeTask, selectAgent } from "./orchestrator/router";
export { decomposeTask } from "./orchestrator/decomposer";
export type { DecompositionPlan } from "./orchestrator/decomposer";
export { executeTask } from "./orchestrator/executor";

// Worker tool runner (server-only -- executes tools on behalf of agents)
export { runTool, runAgentTask } from "./worker/tool-runner";

// Worker sandbox validation (server-only operations)
export { validateSandbox, validateToolAccess, assertSandbox } from "./worker/sandbox";

// Worker metering (server-only -- records to database)
export { recordUsage, estimateTokens, calculateCost, getUsageSummary } from "./worker/metering";
export type { UsageSummary } from "./worker/metering";

// Approval service (server-only -- database operations)
export {
  createApproval,
  getApprovalsForBusiness,
  getApprovalById,
  approveAction,
  rejectAction,
  provideGuidance,
  bulkApprove,
  bulkReject,
} from "./approval/approval-service";

// Policy engine (server-only -- database operations)
export {
  evaluateRisk,
  checkAgentTrust,
  shouldAutoApprove,
} from "./approval/policy-engine";

// Health service (server-only -- database aggregation)
export {
  getAgentHealthSummary,
  getErrorRate,
  getTaskThroughput,
  getRecentActivity,
  getSystemHealth,
} from "./health/health-service";
export type {
  AgentHealthSummary,
  DepartmentHealth,
  AgentHealthItem,
  ErrorRate,
  TaskThroughput,
  ActivityEntry,
  SystemHealth,
} from "./health/health-service";

// Emergency service (server-only -- emergency actions with audit logging)
export {
  freezeAgentWithReason,
  revokeToolAccess,
  disableAgent,
  restoreAgent,
  disableTenant,
  restoreTenant,
} from "./emergency/emergency-service";

// Chat service (server-only -- database operations)
export {
  getOrCreateConversation,
  sendMessage,
  getMessages,
  getConversationsForBusiness,
  archiveConversation,
  getDepartmentChannels,
  routeAndRespond,
} from "./chat/chat-service";

// Chat stub (server-only -- simulated responses)
export { generateStubResponse } from "./chat/chat-stub";

// VPS client (server-only -- HTTP calls to VPS)
export { vpsPost, vpsGet, createVpsWebSocket } from "./vps/vps-client";
export {
  checkVpsHealth,
  checkAgentHealth,
  updateVpsStatus,
  updateAgentVpsStatus,
  getVpsStatus,
} from "./vps/vps-health";
export { getVpsConfig, isVpsConfigured } from "./vps/vps-config";

// VPS chat routing (server-only -- sends messages to VPS agents)
export { sendChatToVps, getVpsAgentId, getVpsChatWsUrl } from "./vps/vps-chat";

// VPS task routing (server-only -- sends tasks to VPS agents)
export { sendTaskToVps } from "./vps/vps-task";

// VPS deploy service (server-only -- pushes deployment packages to VPS)
export {
  pushDeploymentToVps,
  pushAgentToVps,
  pushRollbackToVps,
  runPostDeployHealthCheck,
} from "./vps/vps-deploy";

// Health types
export type { VpsHealthData } from "./health/health-service";

// Knowledge service (server-only -- database + OpenAI operations)
export {
  createDocument,
  listDocuments,
  deleteDocument,
  updateDocumentStatus,
  getDocumentChunks,
  processDocument,
  reIndexDocument,
} from "./knowledge/knowledge-service";
export { retrieveKnowledgeContext } from "./knowledge/retriever";
export { extractText } from "./knowledge/text-extractor";
export { chunkText } from "./knowledge/chunker";
export { generateEmbedding, generateEmbeddings } from "./knowledge/embedder";

// Prompt generator services (server-only -- Anthropic API)
export { generatePromptAndSkill } from "./prompt-generator/generator-service";
export { refinePrompt } from "./prompt-generator/refinement-service";
export { sendTestMessage } from "./prompt-generator/test-chat-service";

// OpenClaw workspace generator (re-exported for server-only use in web app)
export { generateOpenClawWorkspace } from "@agency-factory/runtime";
