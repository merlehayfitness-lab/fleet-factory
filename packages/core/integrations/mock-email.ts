import type { IntegrationAdapter } from "./adapter";

export class MockEmailAdapter implements IntegrationAdapter {
  readonly type = "email" as const;
  readonly provider = "mock-email";

  async testConnection(): Promise<boolean> {
    return true;
  }

  getCapabilities(): string[] {
    return ["email.send", "email.list", "email.templates"];
  }

  getSampleData(): Record<string, unknown> {
    return {
      sent_emails: [
        {
          subject: "Welcome to your new workspace",
          to: "sarah@acme.com",
          status: "delivered",
          sent_at: "2026-03-24T10:30:00Z",
        },
        {
          subject: "Your weekly agent performance report",
          to: "marcus@globex.io",
          status: "delivered",
          sent_at: "2026-03-24T08:00:00Z",
        },
        {
          subject: "Action required: Pending approval",
          to: "priya@initech.co",
          status: "bounced",
          sent_at: "2026-03-23T14:15:00Z",
        },
      ],
    };
  }
}
