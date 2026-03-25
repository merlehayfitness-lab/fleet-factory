// Domain types for Agency Factory
// These represent the core status and role enumerations used across the platform.

/** Business lifecycle status */
export type BusinessStatus =
  | "provisioning"
  | "active"
  | "suspended"
  | "disabled";

/** User role within a business */
export type UserRole = "owner" | "admin" | "manager" | "member";

/** Department type identifier */
export type DepartmentType =
  | "owner"
  | "sales"
  | "support"
  | "operations"
  | "custom";

/** Agent lifecycle status */
export type AgentStatus =
  | "provisioning"
  | "active"
  | "paused"
  | "frozen"
  | "error"
  | "retired";

/** Deployment pipeline status */
export type DeploymentStatus =
  | "queued"
  | "building"
  | "deploying"
  | "live"
  | "failed"
  | "rolled_back";

/** Integration type categories */
export type IntegrationType = "crm" | "email" | "helpdesk" | "calendar" | "messaging";

/** Integration status */
export type IntegrationStatus = "active" | "inactive" | "mock";

/** Secret category */
export type SecretCategory = "api_key" | "credential" | "token";
