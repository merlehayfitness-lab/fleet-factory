// Simulated agent response generator with department-appropriate responses.
// Pure function -- no Supabase dependency.
// STUB: Replace with real Claude API call in Phase 6 (BLDR-01)

import type { StubResponse, ToolCallTrace } from "./chat-types";

interface ResponsePattern {
  content: string;
  toolCalls: ToolCallTrace[];
  keywords: string[];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function injectNumbers(template: string): string {
  return template.replace(/\{N\}/g, () => String(randomInt(2, 25)));
}

const SALES_PATTERNS: ResponsePattern[] = [
  {
    content:
      "I've checked the CRM and found {N} matching leads based on your criteria. The top prospects are in the enterprise segment with high engagement scores. Want me to draft outreach emails?",
    toolCalls: [
      { toolName: "crm_search", summary: "Searched CRM - {N} results found" },
    ],
    keywords: ["lead", "crm", "prospect", "search", "find"],
  },
  {
    content:
      "I've drafted a follow-up email for the prospect. Here's a preview: Subject: 'Quick follow-up on our conversation'. The tone is professional with a clear call-to-action for scheduling a demo.",
    toolCalls: [
      {
        toolName: "email_draft",
        summary: "Drafted follow-up email - ready for review",
      },
    ],
    keywords: ["email", "follow up", "draft", "write", "send"],
  },
  {
    content:
      "Pipeline update: {N} deals in negotiation stage, {N} closing this week. Total pipeline value is trending 15% above last month. The biggest opportunity is the enterprise contract we discussed.",
    toolCalls: [
      {
        toolName: "pipeline_report",
        summary: "Generated pipeline report - {N} active deals",
      },
    ],
    keywords: ["pipeline", "deal", "revenue", "forecast", "report"],
  },
];

const SUPPORT_PATTERNS: ResponsePattern[] = [
  {
    content:
      "I've searched the knowledge base and found a relevant article that addresses this issue. The recommended resolution involves updating the configuration settings. I can walk you through the steps.",
    toolCalls: [
      {
        toolName: "kb_search",
        summary: "Searched knowledge base - 1 article found",
      },
    ],
    keywords: ["knowledge", "article", "help", "how to", "guide"],
  },
  {
    content:
      "I've created support ticket #{NNNN} for this issue and assigned it to the queue. Priority is set based on the impact assessment. Expected response time is within 4 business hours.",
    toolCalls: [
      {
        toolName: "ticket_create",
        summary: "Created ticket #" + randomInt(1000, 9999),
      },
    ],
    keywords: ["ticket", "issue", "bug", "problem", "create"],
  },
  {
    content:
      "Based on the ticket history, this customer has had {N} interactions in the last 30 days. The most common topics are account configuration and API integration. Satisfaction score is at 4.2/5.",
    toolCalls: [
      {
        toolName: "customer_history",
        summary: "Retrieved customer history - {N} interactions",
      },
    ],
    keywords: ["history", "customer", "track", "record", "past"],
  },
];

const OPERATIONS_PATTERNS: ResponsePattern[] = [
  {
    content:
      "I've reviewed the task queue and here's the current status: {N} tasks pending, {N} in progress, {N} completed today. No blockers detected. The automation pipeline is running smoothly.",
    toolCalls: [
      {
        toolName: "task_queue_check",
        summary: "Checked task queue - {N} items",
      },
    ],
    keywords: ["task", "queue", "status", "pending", "progress"],
  },
  {
    content:
      "I've generated the daily operations report. Key metrics: uptime 99.8%, {N} incidents resolved, average response time 2.3 minutes. All SLAs are being met across active services.",
    toolCalls: [
      {
        toolName: "ops_report",
        summary: "Generated daily operations report",
      },
    ],
    keywords: ["report", "daily", "metrics", "performance", "uptime"],
  },
  {
    content:
      "Resource utilization is at {N}% across all active services. Memory usage is stable, CPU load is within normal parameters. I'd recommend scaling the worker pool if utilization exceeds 80%.",
    toolCalls: [
      {
        toolName: "resource_monitor",
        summary: "Checked resource utilization - {N}% usage",
      },
    ],
    keywords: ["resource", "utilization", "memory", "cpu", "scale"],
  },
];

const OWNER_PATTERNS: ResponsePattern[] = [
  {
    content:
      "Here's your business summary for today: {N} new customers acquired, revenue tracking at 12% above target. The sales team closed {N} deals and support resolved {N} tickets with a 4.5/5 satisfaction score.",
    toolCalls: [
      {
        toolName: "analytics_query",
        summary: "Queried analytics - daily summary",
      },
    ],
    keywords: ["summary", "today", "overview", "business", "daily"],
  },
  {
    content:
      "I've compiled the weekly performance dashboard. Key highlights: revenue up 8%, customer acquisition cost down 15%, {N} new enterprise leads. The operations team maintained 99.9% uptime.",
    toolCalls: [
      {
        toolName: "dashboard_compile",
        summary: "Compiled weekly performance dashboard",
      },
    ],
    keywords: ["weekly", "dashboard", "performance", "highlights", "compile"],
  },
  {
    content:
      "Strategic recommendation: Based on current trends, I suggest focusing on the enterprise segment where deal sizes are {N}x larger. The support team's efficiency gains could free up resources for a dedicated enterprise onboarding track.",
    toolCalls: [
      {
        toolName: "strategy_analysis",
        summary: "Analyzed trends - strategic recommendation generated",
      },
    ],
    keywords: ["strategy", "recommend", "suggest", "plan", "focus"],
  },
];

const DEPARTMENT_PATTERNS: Record<string, ResponsePattern[]> = {
  sales: SALES_PATTERNS,
  support: SUPPORT_PATTERNS,
  operations: OPERATIONS_PATTERNS,
  owner: OWNER_PATTERNS,
};

/**
 * Generate a simulated agent response appropriate for the department type.
 *
 * Performs basic keyword matching on the user message to pick a more relevant response.
 * Falls back to a random response from the department's pattern set.
 *
 * STUB: Replace with real Claude API call in Phase 6 (BLDR-01)
 */
export function generateStubResponse(
  departmentType: string,
  userMessage: string,
): Omit<StubResponse, "agentId" | "agentName"> {
  const patterns =
    DEPARTMENT_PATTERNS[departmentType.toLowerCase()] ?? OWNER_PATTERNS;
  const lowerMessage = userMessage.toLowerCase();

  // Try keyword matching first
  let matched: ResponsePattern | undefined;
  for (const pattern of patterns) {
    if (pattern.keywords.some((kw) => lowerMessage.includes(kw))) {
      matched = pattern;
      break;
    }
  }

  // Fall back to random selection
  if (!matched) {
    matched = patterns[Math.floor(Math.random() * patterns.length)];
  }

  return {
    content: injectNumbers(matched.content),
    toolCalls: matched.toolCalls.map((tc) => ({
      ...tc,
      summary: injectNumbers(tc.summary),
    })),
  };
}
