/**
 * Meta-prompts that instruct Claude how to generate agent prompts and SKILL.md.
 *
 * These templates are the "prompt for the prompt generator" -- they tell Claude
 * how to analyze role definition inputs and produce structured output.
 */

import type { PromptSections, RoleDefinition } from "./generator-types";

/**
 * System prompt for the initial generation call.
 * Instructs Claude to produce a JSON object with prompt sections + SKILL.md.
 */
export function buildGenerationSystemPrompt(): string {
  return `You are an expert AI agent prompt engineer. Your job is to analyze a role definition for a business AI agent and generate two things:

1. A structured system prompt split into 4 sections
2. A SKILL.md file describing the agent's capabilities

OUTPUT FORMAT: You MUST respond with ONLY a valid JSON object (no markdown, no code fences). The JSON must have these fields:

{
  "identity": "Who the agent is, its role within the department, its name and purpose. Keep under 800 characters.",
  "instructions": "Step-by-step workflow instructions derived from the admin's free-text workflow description. Convert informal instructions into clear, numbered steps. Keep under 1200 characters.",
  "tools": "Which tools the agent should use and when, based on linked integrations. If no integrations, describe general capabilities. Keep under 1000 characters.",
  "constraints": "Boundaries the agent must respect: tone enforcement, forbidden actions, escalation triggers, data access limits. Keep under 1000 characters.",
  "skillDefinition": "A markdown SKILL.md document with sections: ## Capabilities, ## Tools, ## Task Boundaries, ## Workflows. Keep under 4000 characters.",
  "structuredBreakdown": "A plain-language summary of what you understood from the inputs, formatted as bullet points. This helps the admin confirm the generation captured their intent."
}

GUIDELINES:
- Total system prompt (identity + instructions + tools + constraints) should be roughly 4000 characters
- SKILL.md should be roughly 4000 characters
- Write in second person ("You are...", "You should...")
- Be specific and actionable, not vague
- Respect the specified tone throughout
- If focus areas are provided, ensure they are prominently reflected
- If workflow instructions are detailed, preserve the admin's intent while making steps clearer`;
}

/**
 * User message for the generation call.
 * Formats the role definition inputs and business context.
 */
export function buildGenerationUserMessage(
  roleDefinition: RoleDefinition,
  businessContext: { name: string; industry: string; departmentType: string },
  knowledgeDocTitles: string[],
  integrationNames: string[],
): string {
  const parts: string[] = [];

  parts.push(`BUSINESS CONTEXT:`);
  parts.push(`- Business: ${businessContext.name}`);
  parts.push(`- Industry: ${businessContext.industry}`);
  parts.push(`- Department: ${businessContext.departmentType}`);
  parts.push("");

  parts.push(`ROLE DEFINITION:`);
  parts.push(`- Description: ${roleDefinition.description}`);
  parts.push(`- Tone: ${roleDefinition.tone}`);
  if (roleDefinition.focus_areas.length > 0) {
    parts.push(`- Focus Areas: ${roleDefinition.focus_areas.join(", ")}`);
  }
  if (roleDefinition.workflow_instructions) {
    parts.push(`- Workflow Instructions:\n${roleDefinition.workflow_instructions}`);
  }
  parts.push("");

  if (knowledgeDocTitles.length > 0) {
    parts.push(`AVAILABLE KNOWLEDGE DOCUMENTS:`);
    for (const title of knowledgeDocTitles) {
      parts.push(`- ${title}`);
    }
    parts.push("");
  }

  if (integrationNames.length > 0) {
    parts.push(`CONNECTED INTEGRATIONS:`);
    for (const name of integrationNames) {
      parts.push(`- ${name}`);
    }
    parts.push("");
  }

  parts.push("Generate the system prompt sections and SKILL.md based on the above inputs.");

  return parts.join("\n");
}

/**
 * System prompt for refinement calls.
 * Instructs Claude to update existing prompt sections based on a refinement request.
 */
export function buildRefinementSystemPrompt(): string {
  return `You are an expert AI agent prompt engineer refining an existing system prompt. The admin has requested changes to the current prompt.

Your job is to:
1. Understand the current prompt sections
2. Apply the requested refinement
3. Return the updated sections

OUTPUT FORMAT: You MUST respond with ONLY a valid JSON object (no markdown, no code fences):

{
  "identity": "Updated identity section (or unchanged if not affected)",
  "instructions": "Updated instructions section (or unchanged if not affected)",
  "tools": "Updated tools section (or unchanged if not affected)",
  "constraints": "Updated constraints section (or unchanged if not affected)",
  "changeDescription": "A brief description of what was changed and why, in 1-2 sentences."
}

GUIDELINES:
- Only modify sections that are relevant to the refinement request
- Preserve the overall structure and tone of unchanged sections
- Keep character budgets: identity ~800, instructions ~1200, tools ~1000, constraints ~1000
- Be precise about what changed in the changeDescription`;
}

/**
 * User message for refinement calls.
 * Includes current sections, the refinement request, and conversation history.
 */
export function buildRefinementUserMessage(
  currentSections: PromptSections,
  refinementMessage: string,
  conversationHistory: { role: string; content: string }[],
): string {
  const parts: string[] = [];

  parts.push("CURRENT PROMPT SECTIONS:");
  parts.push(`\n## Identity\n${currentSections.identity}`);
  parts.push(`\n## Instructions\n${currentSections.instructions}`);
  parts.push(`\n## Tools\n${currentSections.tools}`);
  parts.push(`\n## Constraints\n${currentSections.constraints}`);
  parts.push("");

  if (conversationHistory.length > 0) {
    parts.push("PREVIOUS REFINEMENT HISTORY:");
    for (const msg of conversationHistory) {
      parts.push(`${msg.role}: ${msg.content}`);
    }
    parts.push("");
  }

  parts.push(`REFINEMENT REQUEST: ${refinementMessage}`);

  return parts.join("\n");
}
