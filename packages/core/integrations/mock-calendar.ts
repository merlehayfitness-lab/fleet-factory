import type { IntegrationAdapter } from "./adapter";

export class MockCalendarAdapter implements IntegrationAdapter {
  readonly type = "calendar" as const;
  readonly provider = "mock-calendar";

  async testConnection(): Promise<boolean> {
    return true;
  }

  getCapabilities(): string[] {
    return [
      "events.list",
      "events.create",
      "events.update",
      "availability.check",
    ];
  }

  getSampleData(): Record<string, unknown> {
    return {
      events: [
        {
          title: "Weekly team standup",
          start: "2026-03-26T09:00:00Z",
          end: "2026-03-26T09:30:00Z",
          attendees: ["sarah@acme.com", "marcus@globex.io"],
        },
        {
          title: "Client onboarding call",
          start: "2026-03-26T14:00:00Z",
          end: "2026-03-26T15:00:00Z",
          attendees: ["priya@initech.co"],
        },
        {
          title: "Deployment review",
          start: "2026-03-27T11:00:00Z",
          end: "2026-03-27T11:45:00Z",
          attendees: ["sarah@acme.com", "priya@initech.co", "marcus@globex.io"],
        },
      ],
    };
  }
}
