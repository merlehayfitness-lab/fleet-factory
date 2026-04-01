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
  getSecretsByProvider,
  revealSecret,
  saveProviderCredentials,
  deleteProviderSecrets,
} from "./secrets/service";

// Test connection service (mock for MVP)
export { testConnection } from "./secrets/test-connection";

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

// VPS lifecycle (server-only -- container pause/resume)
export { pauseTenantContainers, resumeTenantContainers } from "./vps/vps-lifecycle";

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

// SSH client + deploy — NOT barrel-exported (native node-ssh/ssh2 binary breaks webpack).
// Use dynamic import: const { isSshConfigured } = await import("@agency-factory/core/vps/ssh-client");
// Types re-exported for convenience (types are erased at runtime, no native dep issue).
export type { SshConfig, SshCommandResult, SshProgressCallback } from "./vps/ssh-client";
export type { SshDeployOptions, SshDeployAgent, SshDeployResult } from "./vps/ssh-deploy";

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

// Skill service (server-only -- database operations)
export {
  createSkill,
  updateSkill,
  softDeleteSkill,
  getSkill,
  listSkillsForBusiness,
  assignSkill,
  unassignSkill,
  getSkillsForAgent,
  getSkillsForDepartment,
  getSkillUsage,
  getSkillTemplates,
  createSkillFromTemplate,
} from "./skill/skill-service";
export { compileSkills } from "./skill/skill-compiler";
export { parseGitHubUrl, fetchGitHubFile, fetchGitHubDirectory } from "./skill/github-import";

// Tool profile validation (server-only -- uses fetch)
export { validateMcpServerUrl } from "./agent/tool-profile-schema";

// MCP auto-assignment service (server-only -- database operations)
export {
  resolveMcpServers,
  getMcpServersForAgent,
  generateMcpWorkspaceConfig,
  listKnownMcpServers,
} from "./agent/mcp-service";
export type { McpServerDef, McpServerConfig } from "./agent/mcp-service";

// Skill package installer (server-only -- generates install commands)
export {
  generateInstallCommands,
  generateInstallScript,
  getBuiltinSkill,
  listBuiltinSkills,
} from "./skill/package-installer";
export type { SkillPackageRef, InstallCommand } from "./skill/package-installer";

// Agent profile sync + self-naming (server-only -- database operations)
export { syncFromTemplate, reparentAgent, updateAgentName } from "./agent/service";

// Integration setup instructions (server-only -- Anthropic streaming API)
export { streamSetupInstructions } from "./integrations/instructions-service";

// Slack integration (server-only -- Slack SDK + crypto + DB operations)
export { getSlackClient, createSlackClient } from "./slack/slack-client";
export {
  verifySlackSignature,
  parseSlackEvent,
  isMessageEvent,
  isBotMessage,
  getSigningSecret,
} from "./slack/slack-events";
export {
  createDepartmentChannels,
  getChannelMappings,
  getChannelMapping,
  getDepartmentForChannel,
  saveChannelMapping,
} from "./slack/slack-channels";
export {
  handleInboundSlackMessage,
  postAgentResponseToSlack,
  syncMessageToSupabase,
  getSlackFeedMessages,
} from "./slack/slack-messages";
export {
  formatAgentResponseBlocks,
  formatToolCallAttachment,
  getAgentEmoji,
} from "./slack/slack-blocks";
export {
  getSlackInstallUrl,
  handleSlackOAuthCallback,
  getSlackInstallation,
  disconnectSlack,
} from "./slack/slack-oauth";

// AITMPL catalog service (server-only -- fetches external API, caches in memory)
export {
  getCatalog,
  searchComponents,
  getComponentDetail,
  getComponentsByType,
  getCatalogStats,
  clearCatalogCache,
} from "./aitmpl/catalog-service";

// AITMPL import service (server-only -- database writes)
export { importFromAitmpl } from "./aitmpl/import-service";

// Rate limit service (server-only -- database-backed queue + usage logging)
export {
  acquireSlot,
  releaseSlot,
  getActiveSlotCount,
  enqueueCall,
  dequeueCall,
  completeQueuedCall,
  failQueuedCall,
  getQueueDepth,
  logApiUsage,
  getApiUsageSummary,
  executeWithRateLimit,
} from "./rate-limit/rate-limiter";
export type {
  RateLimitConfig,
  ApiCallResult,
  QueuedCall,
} from "./rate-limit/rate-limiter";

// Port allocation service (server-only -- database operations)
export {
  allocatePortBlock,
  getBusinessPorts,
  releasePortBlock,
  getAgentPort,
  getAllPortAllocations,
} from "./deployment/port-allocator";
export type { PortAllocation } from "./deployment/port-allocator";

// Dashboard services (server-only -- cross-tenant aggregation)
export {
  getCSuiteSummary,
  getRevOpsSummary,
  getLiveActivityFeed,
} from "./dashboard/dashboard-service";
export type {
  CSuiteSummary,
  RevOpsSummary,
  LiveActivityEntry,
} from "./dashboard/dashboard-service";

// R&D Council (server-only -- autonomous agent sessions)
export {
  runCouncilSession,
  getNextSessionTime,
  getProposer,
  getParticipants,
  shouldRunSession,
  writeMemo,
  getMemos,
  getMemoById,
  getPreviousMemo,
  getSessionCount,
  COUNCIL_AGENTS,
  DEFAULT_SCHEDULE,
} from "./rd-council/index";
export type {
  CouncilAgent,
  CouncilSession,
  CouncilContext,
  CouncilVote,
  CouncilMemo,
  ScheduleConfig,
} from "./rd-council/council-types";

// CRM integration (server-only -- REST client + database operations)
export {
  getContacts,
  createContact,
  updateContact,
  getDeals,
  createDeal,
  updateDealStage,
  getPipelineSummary,
  getActivities,
  logActivity,
} from "./crm/crm-service";
export { createTwentyCrmClient } from "./crm/crm-client";
export { syncContactsFromCrm, syncPipelineFromCrm } from "./crm/crm-sync";
export type {
  CrmContact,
  CrmDeal,
  CrmActivity,
  CrmPipelineSummary,
  TwentyCrmConfig,
} from "./crm/crm-types";

// WhatsApp integration (server-only -- API clients + webhooks)
export {
  sendWhatsAppMessage,
  verifyTwilioSignature,
  verifyMetaWebhook,
  parseTwilioInbound,
  parseMetaInbound,
  parseCommand as parseWhatsAppCommand,
  getHelpMessage as getWhatsAppHelpMessage,
  sendAlert as sendWhatsAppAlert,
  alertDeploymentComplete,
  alertApprovalNeeded,
  alertNewCrmLead,
  alertFollowUpDue,
  alertSpendThreshold,
  sendDailyDigest,
} from "./whatsapp/index";
export type {
  WhatsAppConfig,
  InboundMessage as WhatsAppInboundMessage,
  OutboundMessage as WhatsAppOutboundMessage,
  ParsedCommand as WhatsAppParsedCommand,
  DailyDigest as WhatsAppDailyDigest,
} from "./whatsapp/whatsapp-types";

// OpenClaw workspace generator (re-exported for server-only use in web app)
export { generateOpenClawWorkspace } from "@agency-factory/runtime";
