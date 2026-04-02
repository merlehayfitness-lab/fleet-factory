// CRM module re-exports.
// Import from "@fleet-factory/core/server" in Server Components and Server Actions.

export type {
  CrmContact,
  CrmDeal,
  CrmActivity,
  CrmPipelineSummary,
  TwentyCrmConfig,
} from "./crm-types";

export { createTwentyCrmClient } from "./crm-client";
export type { TwentyCrmClient } from "./crm-client";

export { syncContactsFromCrm, syncPipelineFromCrm, pushLocalContactsToCrm } from "./crm-sync";
export type { SyncResult } from "./crm-sync";

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
} from "./crm-service";
