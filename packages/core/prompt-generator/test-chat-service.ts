/**
 * Test chat service for validating draft system prompts.
 *
 * Runs a conversation using the draft system prompt via Anthropic SDK,
 * allowing admins to verify agent behavior before saving.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { TestChatMessage } from "./generator-types";
import { CLAUDE_MODELS } from "../agent/model-constants";

/**
 * Read ANTHROPIC_API_KEY from environment. Throws if missing.
 */
function getAnthropicApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "ANTHROPIC_API_KEY environment variable is required for test chat. " +
        "Set it in your .env.local or environment.",
    );
  }
  return key;
}

/**
 * Create an Anthropic client instance.
 */
function getAnthropicClient(): Anthropic {
  return new Anthropic({ apiKey: getAnthropicApiKey() });
}

const DEFAULT_MODEL = CLAUDE_MODELS.find(m => m.tier === "sonnet" && m.isLatest)?.id ?? "claude-sonnet-4-6";

/**
 * Send a test message using a draft system prompt.
 *
 * Creates a conversation with the draft prompt as the system message
 * and the provided message history. Returns the assistant's response.
 */
export async function sendTestMessage(
  systemPrompt: string,
  messages: TestChatMessage[],
  modelProfile?: Record<string, unknown>,
): Promise<string> {
  const client = getAnthropicClient();

  const model =
    typeof modelProfile?.model === "string"
      ? modelProfile.model
      : DEFAULT_MODEL;

  const anthropicMessages: Array<{
    role: "user" | "assistant";
    content: string;
  }> = messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: systemPrompt,
    messages: anthropicMessages,
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content in test chat response");
  }

  return textBlock.text;
}
