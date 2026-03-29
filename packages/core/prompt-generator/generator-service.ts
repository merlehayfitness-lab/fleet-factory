/**
 * Main prompt generation service.
 *
 * Calls Claude with meta-prompts to generate structured system prompts
 * and SKILL.md content from role definition inputs.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { RoleDefinition, GenerationResult } from "./generator-types";
import {
  buildGenerationSystemPrompt,
  buildGenerationUserMessage,
} from "./prompt-templates";
import { CLAUDE_MODELS } from "../agent/model-constants";

/**
 * Read ANTHROPIC_API_KEY from environment. Throws if missing.
 */
function getAnthropicApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "ANTHROPIC_API_KEY environment variable is required for prompt generation. " +
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

const GENERATOR_MODEL = CLAUDE_MODELS.find(m => m.tier === "sonnet" && m.isLatest)?.id ?? "claude-sonnet-4-6";

/**
 * Generate a structured system prompt and SKILL.md from a role definition.
 *
 * Calls Claude with the generation meta-prompt, then parses the JSON response
 * into a GenerationResult with prompt sections, skill definition, and breakdown.
 */
export async function generatePromptAndSkill(
  roleDefinition: RoleDefinition,
  businessContext: { name: string; industry: string; departmentType: string },
  knowledgeDocTitles: string[],
  integrationNames: string[],
): Promise<GenerationResult> {
  const client = getAnthropicClient();

  const systemPrompt = buildGenerationSystemPrompt();
  const userMessage = buildGenerationUserMessage(
    roleDefinition,
    businessContext,
    knowledgeDocTitles,
    integrationNames,
  );

  const response = await client.messages.create({
    model: GENERATOR_MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  // Extract text content from response
  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content in Claude response");
  }

  const rawText = textBlock.text.trim();

  // Parse JSON response -- handle potential markdown code fence wrapping
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
      `Failed to parse Claude response as JSON. Raw response: ${rawText.slice(0, 200)}...`,
    );
  }

  // Validate required fields
  const requiredFields = [
    "identity",
    "instructions",
    "tools",
    "constraints",
    "skillDefinition",
    "structuredBreakdown",
  ];
  for (const field of requiredFields) {
    if (typeof parsed[field] !== "string") {
      throw new Error(
        `Missing or invalid field "${field}" in Claude response`,
      );
    }
  }

  return {
    promptSections: {
      identity: parsed.identity,
      instructions: parsed.instructions,
      tools: parsed.tools,
      constraints: parsed.constraints,
    },
    skillDefinition: parsed.skillDefinition,
    structuredBreakdown: parsed.structuredBreakdown,
  };
}
