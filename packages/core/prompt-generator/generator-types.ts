/**
 * Type definitions for the prompt generation system.
 *
 * Covers role definition input, structured prompt output,
 * refinement requests, and test chat messages.
 */

/** Structured role definition input from the admin UI. */
export interface RoleDefinition {
  description: string;
  tone: string;
  focus_areas: string[];
  workflow_instructions: string;
  linked_integrations: string[];
  linked_knowledge_docs: string[];
  template_id?: string;
}

/** The four sections of a generated system prompt. */
export interface PromptSections {
  identity: string;
  instructions: string;
  tools: string;
  constraints: string;
}

/** Result from prompt + SKILL.md generation. */
export interface GenerationResult {
  promptSections: PromptSections;
  skillDefinition: string;
  structuredBreakdown: string;
}

/** Input for iterative prompt refinement. */
export interface RefinementRequest {
  currentSections: PromptSections;
  refinementMessage: string;
  conversationHistory: { role: string; content: string }[];
}

/** Result from a refinement iteration. */
export interface RefinementResult {
  updatedSections: PromptSections;
  changeDescription: string;
}

/** A single message in a test chat conversation. */
export interface TestChatMessage {
  role: "user" | "assistant";
  content: string;
}
