import type { IntegrationAdapter } from "./adapter";

export class MockCrmAdapter implements IntegrationAdapter {
  readonly type = "crm" as const;
  readonly provider = "mock-crm";

  async testConnection(): Promise<boolean> {
    return true;
  }

  getCapabilities(): string[] {
    return [
      "contacts.list",
      "contacts.create",
      "deals.list",
      "deals.create",
      "deals.update",
    ];
  }

  getSampleData(): Record<string, unknown> {
    return {
      contacts: [
        { name: "Sarah Chen", email: "sarah@acme.com", company: "Acme Corp" },
        { name: "Marcus Rivera", email: "marcus@globex.io", company: "Globex Industries" },
        { name: "Priya Patel", email: "priya@initech.co", company: "Initech Solutions" },
      ],
      deals: [
        { name: "Acme Enterprise Plan", value: 48000, stage: "negotiation" },
        { name: "Globex Annual License", value: 24000, stage: "proposal" },
      ],
    };
  }
}
