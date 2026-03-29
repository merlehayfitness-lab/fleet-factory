/**
 * AI-powered streaming setup instruction generation service.
 *
 * Uses Anthropic SDK client.messages.stream() to generate contextual setup
 * instructions for integrations. Returns an async generator that yields
 * text chunks as they stream from Claude.
 */

import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODELS } from "../agent/model-constants";

/**
 * Read ANTHROPIC_API_KEY from environment. Throws if missing.
 */
function getAnthropicApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "ANTHROPIC_API_KEY is required for setup instruction generation.",
    );
  }
  return key;
}

/**
 * Create an Anthropic client instance.
 */
function getClient(): Anthropic {
  return new Anthropic({ apiKey: getAnthropicApiKey() });
}

/** Use the latest sonnet model from constants (not hardcoded). */
const INSTRUCTION_MODEL =
  CLAUDE_MODELS.find((m) => m.tier === "sonnet" && m.isLatest)?.id ??
  "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are an integration setup expert for business AI agent platforms. Generate clear, actionable setup instructions in markdown format. Be specific and practical.

Structure your response with these sections:
## Prerequisites
## Getting Your Credentials
## Configuration Steps
## How This Helps Your Team

Keep instructions concise and focused on what the user needs to do. Use numbered steps where appropriate.`;

interface StreamInstructionsParams {
  integrationName: string;
  integrationCategory: string;
  provider: string;
  targetName: string;
  targetType: string;
  businessName?: string;
  businessIndustry?: string;
}

/**
 * Build the user message for instruction generation.
 */
function buildUserMessage(params: StreamInstructionsParams): string {
  const businessContext =
    params.businessName || params.businessIndustry
      ? `\nBusiness: ${params.businessName ?? "Unknown"}${params.businessIndustry ? ` (${params.businessIndustry} industry)` : ""}`
      : "";

  return `Generate setup instructions for the following integration:

Integration: ${params.integrationName}
Category: ${params.integrationCategory}
Provider: ${params.provider}
Target: ${params.targetName} (${params.targetType})${businessContext}

The instructions should explain:
1. What prerequisites are needed (accounts, API keys, etc.)
2. How to get the necessary credentials from the provider
3. Step-by-step configuration for connecting this integration
4. How this integration specifically helps the ${params.targetName} in their ${params.targetType} role

Make the instructions specific to ${params.provider} and relevant to a ${params.targetType} team/agent.`;
}

/**
 * Stream setup instructions for an integration using Claude.
 *
 * Returns an async generator that yields text chunks as they arrive.
 * Uses client.messages.stream() for real-time streaming per user decision.
 *
 * Graceful fallback: if ANTHROPIC_API_KEY is missing, yields a single
 * fallback message instead of throwing.
 */
export async function* streamSetupInstructions(
  params: StreamInstructionsParams,
): AsyncGenerator<string, void, unknown> {
  try {
    const client = getClient();
    const userMessage = buildUserMessage(params);

    const stream = client.messages.stream({
      model: INSTRUCTION_MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
  } catch (err) {
    // Graceful fallback -- yield error message instead of throwing
    const message =
      err instanceof Error && err.message.includes("ANTHROPIC_API_KEY")
        ? "Setup instructions could not be generated. Please check your ANTHROPIC_API_KEY configuration."
        : "Setup instructions could not be generated. Please try again later.";
    yield message;
  }
}
