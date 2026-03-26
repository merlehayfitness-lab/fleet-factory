// @agency-factory/core
// Shared domain logic for Agency Factory

// Domain types
export type {
  BusinessStatus,
  UserRole,
  DepartmentType,
  AgentStatus,
  DeploymentStatus,
  IntegrationType,
  IntegrationStatus,
  SecretCategory,
} from "./types/index";

// Tenant provisioning
export { createBusinessSchema } from "./tenant/schema";
export type { CreateBusinessInput } from "./tenant/schema";
export { provisionBusinessTenant } from "./tenant/provision";

// Agent lifecycle
export {
  canTransition,
  assertTransition,
  getValidTransitions,
  VALID_TRANSITIONS,
} from "./agent/lifecycle";

// Agent service
export {
  transitionAgentStatus,
  updateAgentConfig,
} from "./agent/service";

// Template schema
export {
  createTemplateSchema,
  updateTemplateSchema,
} from "./agent/template-schema";
export type {
  CreateTemplateInput,
  UpdateTemplateInput,
} from "./agent/template-schema";

// Template service
export {
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from "./agent/template-service";

// Integration adapter
export type { IntegrationAdapter } from "./integrations/adapter";

// Integration registry
export { getAdapter, MOCK_ADAPTERS } from "./integrations/index";

// Integration CRUD service
export {
  getIntegrationsForAgent,
  getIntegrationsForBusiness,
  upsertIntegration,
  deleteIntegration,
} from "./integrations/service";

// Deployment lifecycle (pure functions, no Node.js deps)
export {
  DEPLOYMENT_TRANSITIONS,
  canTransitionDeployment,
  assertDeploymentTransition,
  getValidDeploymentTransitions,
} from "./deployment/lifecycle";

// Deployment snapshot (pure functions, no Node.js deps)
export { createConfigSnapshot, restoreFromSnapshot } from "./deployment/snapshot";
export type { ConfigSnapshot } from "./deployment/snapshot";

// Task types
export type {
  TaskPriority,
  TaskStatus,
  TaskSource,
  AssistanceRequestStatus,
} from "./types/index";

// Task lifecycle
export {
  TASK_TRANSITIONS,
  canTransitionTask,
  assertTaskTransition,
  getValidTaskTransitions,
} from "./task/task-lifecycle";

// Task schema
export { createTaskSchema, updateTaskSchema } from "./task/task-schema";
export type { CreateTaskInput, UpdateTaskInput } from "./task/task-schema";

// Worker sandbox (client-safe constants)
export { BLOCKED_CAPABILITIES } from "./worker/sandbox";
export type { BlockedCapability } from "./worker/sandbox";

// Worker tool catalog (client-safe)
export { TOOL_CATALOG, getToolsForDepartment } from "./worker/tool-catalog";
export type { ToolDefinition } from "./worker/tool-catalog";

// Conversation / Message types
export type { ConversationStatus, MessageRole } from "./types/index";

// Approval types
export type { ApprovalStatus, RiskLevel } from "./types/index";

// Approval lifecycle
export {
  APPROVAL_TRANSITIONS,
  canTransitionApproval,
  assertApprovalTransition,
  getValidApprovalTransitions,
} from "./approval/approval-lifecycle";

// Approval schema
export {
  approveActionSchema,
  rejectActionSchema,
  bulkActionSchema,
} from "./approval/approval-schema";
export type {
  ApproveActionInput,
  RejectActionInput,
  BulkActionInput,
} from "./approval/approval-schema";

// Chat types (client-safe)
export type {
  ChatMessage,
  ChatConversation,
  ToolCallTrace,
  StubResponse,
  DepartmentChannel,
} from "./chat/chat-types";

// NOTE: Server-only exports (crypto, deployment service, task service, orchestrator, worker, approval service)
// are in "@agency-factory/core/server" to prevent node:crypto from being bundled in client components.
