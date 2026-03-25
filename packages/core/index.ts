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
