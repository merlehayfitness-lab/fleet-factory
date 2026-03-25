import type { IntegrationAdapter } from "./adapter";

export class MockHelpdeskAdapter implements IntegrationAdapter {
  readonly type = "helpdesk" as const;
  readonly provider = "mock-helpdesk";

  async testConnection(): Promise<boolean> {
    return true;
  }

  getCapabilities(): string[] {
    return [
      "tickets.list",
      "tickets.create",
      "tickets.update",
      "tickets.close",
      "kb.search",
    ];
  }

  getSampleData(): Record<string, unknown> {
    return {
      tickets: [
        {
          id: "TK-1001",
          subject: "Cannot access dashboard after password reset",
          status: "open",
          priority: "high",
          created_at: "2026-03-25T09:00:00Z",
        },
        {
          id: "TK-1002",
          subject: "Feature request: bulk agent deployment",
          status: "pending",
          priority: "medium",
          created_at: "2026-03-24T16:30:00Z",
        },
        {
          id: "TK-1003",
          subject: "Billing discrepancy on last invoice",
          status: "resolved",
          priority: "low",
          created_at: "2026-03-23T11:45:00Z",
        },
      ],
    };
  }
}
