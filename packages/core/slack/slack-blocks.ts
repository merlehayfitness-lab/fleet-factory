// Slack Block Kit message formatters for structured agent responses.
// Formats agent messages with rich blocks and tool call context for visual clarity.

import type { KnownBlock } from "@slack/types";
import type { ToolCallTrace } from "../chat/chat-types";

/**
 * Format agent response content into Slack Block Kit blocks.
 * Returns both blocks (rich formatting) and text (plain fallback, required by Slack).
 */
export function formatAgentResponseBlocks(
  content: string,
  toolCalls?: ToolCallTrace[],
): { blocks: KnownBlock[]; text: string } {
  const blocks: KnownBlock[] = [];

  // Main response as a section block with mrkdwn
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: content,
    },
  });

  // If tool calls exist, add divider + context blocks
  if (toolCalls && toolCalls.length > 0) {
    blocks.push({ type: "divider" });

    for (const tc of toolCalls) {
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `:wrench: *${tc.toolName}* -- ${tc.summary}`,
          },
        ],
      });
    }
  }

  return {
    blocks,
    text: content,
  };
}

/**
 * Format a tool call trace as a Slack attachment object.
 * Used for attaching tool call details as secondary content.
 */
export function formatToolCallAttachment(trace: ToolCallTrace): object {
  return {
    color: "#36a64f",
    fields: [
      {
        title: trace.toolName,
        value: trace.summary,
        short: true,
      },
    ],
    fallback: `${trace.toolName}: ${trace.summary}`,
  };
}

/**
 * Get an emoji string for the agent's icon_emoji in Slack.
 * Per user decision: agents should be visually distinct with their own icons/emoji.
 */
export function getAgentEmoji(departmentType: string): string {
  switch (departmentType) {
    case "sales":
      return ":chart_with_upwards_trend:";
    case "support":
      return ":headphones:";
    case "operations":
      return ":gear:";
    case "owner":
      return ":crown:";
    default:
      return ":robot_face:";
  }
}
