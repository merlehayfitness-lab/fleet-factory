/**
 * WhatsApp command parser.
 *
 * Parses inbound text messages into structured commands
 * that can be routed to appropriate agents.
 */

import type { ParsedCommand } from "./whatsapp-types";

/**
 * Parse a WhatsApp message body into a command.
 */
export function parseCommand(text: string): ParsedCommand {
  const cleaned = text.trim().toLowerCase();

  // Status check
  if (
    cleaned === "status" ||
    cleaned === "how are things" ||
    cleaned.startsWith("what's the status")
  ) {
    return { intent: "status", args: [], rawText: text };
  }

  // Approve something
  if (cleaned.startsWith("approve ")) {
    const args = text.trim().slice(8).split(/\s+/);
    return { intent: "approve", args, rawText: text };
  }

  // Reject something
  if (cleaned.startsWith("reject ")) {
    const args = text.trim().slice(7).split(/\s+/);
    return { intent: "reject", args, rawText: text };
  }

  // List tasks
  if (
    cleaned === "tasks" ||
    cleaned === "my tasks" ||
    cleaned === "list tasks" ||
    cleaned === "open tasks"
  ) {
    return { intent: "list_tasks", args: [], rawText: text };
  }

  // Agent query (e.g. "@sales what's the pipeline?" or "ask sales about...")
  const agentMention = cleaned.match(/^@(\w+)\s+(.+)/);
  if (agentMention) {
    return {
      intent: "agent_query",
      args: [agentMention[2]],
      rawText: text,
      targetAgent: agentMention[1],
    };
  }

  const askPattern = cleaned.match(/^ask\s+(\w+)\s+(.+)/);
  if (askPattern) {
    return {
      intent: "agent_query",
      args: [askPattern[2]],
      rawText: text,
      targetAgent: askPattern[1],
    };
  }

  // Unknown
  return { intent: "unknown", args: [], rawText: text };
}

/**
 * Format a help message listing available commands.
 */
export function getHelpMessage(): string {
  return [
    "Available commands:",
    "",
    "status - Get business status overview",
    "tasks - List open tasks",
    "approve <id> - Approve a pending action",
    "reject <id> - Reject a pending action",
    "@agent <question> - Ask a specific agent",
    "ask <agent> <question> - Ask a specific agent",
    "",
    "Reply 'help' to see this message again.",
  ].join("\n");
}
