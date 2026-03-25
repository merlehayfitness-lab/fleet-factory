// Integration adapter interface -- defines the contract for swappable integration connectors.
// Each adapter type (CRM, email, helpdesk, etc.) implements this interface.
// For MVP, all adapters are mock implementations returning realistic sample data.

import type { IntegrationType } from "../types/index";

export interface IntegrationAdapter {
  type: IntegrationType;
  provider: string;
  testConnection(): Promise<boolean>;
  getCapabilities(): string[];
  getSampleData(): Record<string, unknown>;
}
