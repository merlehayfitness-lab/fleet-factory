// @agency-factory/core
// Shared domain logic for Agency Factory

// Domain types
export type {
  BusinessStatus,
  UserRole,
  DepartmentType,
  AgentStatus,
  DeploymentStatus,
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
