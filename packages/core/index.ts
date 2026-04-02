// @fleet-factory/core
// Shared domain logic for Fleet Factory

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
  VpsStatus,
  VpsContainerStatus,
  DeployTarget,
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
  getIntegrationsForDepartment,
  getEffectiveIntegrationsForAgent,
  bulkCreateIntegrations,
  upsertIntegration,
  deleteIntegration,
} from "./integrations/service";
export type {
  Integration as IntegrationRecord,
  IntegrationWithAgent,
  IntegrationWithDepartment,
} from "./integrations/service";

// Integration catalog (client-safe)
export type { CatalogEntry } from "./integrations/catalog";
export { INTEGRATION_CATALOG, getCatalogByCategory, getCatalogEntry } from "./integrations/catalog";

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

// VPS types (client-safe)
export type {
  VpsDeployPayload,
  VpsDeployResult,
  VpsHealthStatus,
  VpsAgentHealthStatus,
  VpsDeployProgressEvent,
  VpsChatRequest,
  VpsChatResponse,
  VpsTaskRequest,
  VpsTaskResult,
  WorkspaceFile,
} from "./vps/vps-types";
export type { VpsConfig } from "./vps/vps-config";

// VPS naming convention (client-safe, used by runtime generators)
export { deriveVpsAgentId } from "./vps/vps-naming";

// Knowledge types (client-safe)
export type {
  KnowledgeDocument,
  KnowledgeChunk,
  KnowledgeSource,
  RetrievedContext,
  TextChunk,
  DocumentStatus,
  KnowledgeFileType,
} from "./knowledge/knowledge-types";

// Prompt generator types (client-safe)
export type {
  RoleDefinition,
  GenerationResult,
  RefinementRequest,
  RefinementResult,
  PromptSections,
  TestChatMessage,
} from "./prompt-generator/generator-types";

// Role template library (client-safe static data)
export type { RoleTemplate } from "./prompt-generator/templates/role-templates";
export {
  ROLE_TEMPLATES,
  getRoleTemplatesForDepartment,
} from "./prompt-generator/templates/role-templates";

// Skill types (client-safe)
export type {
  Skill,
  SkillAssignment,
  SkillTemplate,
  CompiledSkill,
  SkillWithAssignment,
  SkillUsage,
  GitHubUrlInfo,
  GitHubImportResult,
} from "./skill/skill-types";

// Model constants (client-safe)
export type { ClaudeModel } from "./agent/model-constants";
export {
  CLAUDE_MODELS,
  DEPARTMENT_DEFAULT_MODELS,
  getModelById,
  getModelFriendlyName,
  getLatestModels,
  getDefaultModelForDepartment,
} from "./agent/model-constants";

// Tool profile types and constants (client-safe)
export type { McpServerConfig, ToolProfileShape } from "./agent/tool-profile-schema";
export type { KnownMcpServer } from "./agent/tool-profile-schema";
export {
  EMPTY_TOOL_PROFILE,
  KNOWN_MCP_SERVERS,
  DEPARTMENT_DEFAULT_TOOL_PROFILES,
} from "./agent/tool-profile-schema";

// Slack types (client-safe)
export type {
  SlackInstallation,
  SlackChannelMapping,
  SlackConnectionStatus,
} from "./slack/slack-types";

// AITMPL catalog types (client-safe)
export type {
  AitmplComponentType,
  CatalogSearchResult,
  AitmplImportOptions,
  AitmplImportResult,
} from "./aitmpl/catalog-types";

// AITMPL category mapping (client-safe static data)
export {
  DEPARTMENT_CATEGORY_MAP,
  getRecommendedCategories,
  isDepartmentRecommended,
} from "./aitmpl/category-mapping";

// Dashboard types (client-safe -- types only, no runtime code)
export type {
  UsageAnalytics,
  CSuiteSummary,
  RevOpsSummary,
} from "./dashboard/dashboard-service";

// NOTE: Server-only exports (crypto, deployment service, task service, orchestrator, worker, approval service)
// are in "@fleet-factory/core/server" to prevent node:crypto from being bundled in client components.
