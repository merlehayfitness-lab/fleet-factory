import type { IntegrationAdapter } from "./adapter";

export class MockMessagingAdapter implements IntegrationAdapter {
  readonly type = "messaging" as const;
  readonly provider = "mock-messaging";

  async testConnection(): Promise<boolean> {
    return true;
  }

  getCapabilities(): string[] {
    return ["messages.send", "messages.list", "channels.list"];
  }

  getSampleData(): Record<string, unknown> {
    return {
      messages: [
        {
          channel: "#general",
          sender: "Sarah Chen",
          text: "Deployment v3 is live -- all agents reporting healthy",
          timestamp: "2026-03-25T10:15:00Z",
        },
        {
          channel: "#support",
          sender: "Marcus Rivera",
          text: "Escalated ticket TK-1001 to engineering",
          timestamp: "2026-03-25T09:45:00Z",
        },
        {
          channel: "#sales",
          sender: "Priya Patel",
          text: "Closed Acme deal -- $48k annual contract signed",
          timestamp: "2026-03-24T17:30:00Z",
        },
      ],
    };
  }
}
