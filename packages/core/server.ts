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
