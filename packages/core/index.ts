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

// Crypto
export { encrypt, decrypt } from "./crypto/encryption";

// Integration adapter
export type { IntegrationAdapter } from "./integrations/adapter";

// Integration registry
export { getAdapter, MOCK_ADAPTERS } from "./integrations/index";

// Deployment lifecycle
export {
  DEPLOYMENT_TRANSITIONS,
  canTransitionDeployment,
  assertDeploymentTransition,
  getValidDeploymentTransitions,
} from "./deployment/lifecycle";

// Deployment service
export {
  triggerDeployment,
  retryDeployment,
  rollbackDeployment,
  getDeploymentHistory,
} from "./deployment/service";

// Deployment snapshot
export { createConfigSnapshot, restoreFromSnapshot } from "./deployment/snapshot";
export type { ConfigSnapshot } from "./deployment/snapshot";
