// Integration adapter registry and factory
// For MVP, all adapters are mock implementations.
// Real adapters can be swapped in by extending this registry.

import type { IntegrationType } from "../types/index";
import type { IntegrationAdapter } from "./adapter";
import { MockCrmAdapter } from "./mock-crm";
import { MockEmailAdapter } from "./mock-email";
import { MockHelpdeskAdapter } from "./mock-helpdesk";
import { MockCalendarAdapter } from "./mock-calendar";
import { MockMessagingAdapter } from "./mock-messaging";

export const MOCK_ADAPTERS: Record<IntegrationType, () => IntegrationAdapter> = {
  crm: () => new MockCrmAdapter(),
  email: () => new MockEmailAdapter(),
  helpdesk: () => new MockHelpdeskAdapter(),
  calendar: () => new MockCalendarAdapter(),
  messaging: () => new MockMessagingAdapter(),
};

export function getAdapter(type: IntegrationType, _provider?: string): IntegrationAdapter {
  // For MVP, always return mock adapter regardless of provider
  const factory = MOCK_ADAPTERS[type];
  if (!factory) throw new Error(`Unknown integration type: ${type}`);
  return factory();
}
