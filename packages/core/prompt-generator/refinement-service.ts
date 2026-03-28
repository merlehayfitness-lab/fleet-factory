/**
 * Iterative prompt refinement service.
 *
 * Accepts the current prompt sections and a refinement request,
 * calls Claude to produce updated sections with change tracking.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { RefinementRequest, RefinementResult } from "./generator-types";
import {
  buildRefinementSystemPrompt,
  buildRefinementUserMessage,
} from "./prompt-templates";

/**
 * Read ANTHROPIC_API_KEY from environment. Throws if missing.
 */
function getAnthropicApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "ANTHROPIC_API_KEY environment variable is required for prompt refinement. " +
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

const MODEL = "claude-sonnet-4-20250514";

/**
 * Refine an existing prompt based on admin feedback.
 *
 * Takes the current prompt sections, a refinement message, and conversation
 * history. Returns updated sections and a description of changes.
 */
export async function refinePrompt(
  request: RefinementRequest,
): Promise<RefinementResult> {
  const client = getAnthropicClient();

  const systemPrompt = buildRefinementSystemPrompt();
  const userMessage = buildRefinementUserMessage(
    request.currentSections,
    request.refinementMessage,
    request.conversationHistory,
  );

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  // Extract text content
  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content in Claude refinement response");
  }

  const rawText = textBlock.text.trim();

  // Parse JSON response
  let jsonText = rawText;
  if (jsonText.startsWith("```")) {
    jsonText = jsonText
      .replace(/^```(?:json)?\n?/, "")
      .replace(/\n?```$/, "");
  }

  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(
      `Failed to parse refinement response as JSON. Raw: ${rawText.slice(0, 200)}...`,
    );
  }

  const requiredFields = [
    "identity",
    "instructions",
    "tools",
    "constraints",
    "changeDescription",
  ];
  for (const field of requiredFields) {
    if (typeof parsed[field] !== "string") {
      throw new Error(
        `Missing or invalid field "${field}" in refinement response`,
      );
    }
  }

  return {
    updatedSections: {
      identity: parsed.identity,
      instructions: parsed.instructions,
      tools: parsed.tools,
      constraints: parsed.constraints,
    },
    changeDescription: parsed.changeDescription,
  };
}
