import { z } from "zod";

/**
 * Zod validation schema for creating an agent template.
 *
 * Templates define the blueprint for agents: system prompt, tool profile,
 * and model profile, scoped to a department type.
 */
export const createTemplateSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be 100 characters or fewer"),
  department_type: z.enum(["owner", "sales", "support", "operations"]),
  description: z
    .string()
    .max(500, "Description must be 500 characters or fewer")
    .optional(),
  system_prompt: z
    .string()
    .min(10, "System prompt must be at least 10 characters"),
  tool_profile: z.record(z.string(), z.unknown()).optional(),
  model_profile: z.record(z.string(), z.unknown()).optional(),
});

/** Inferred type for template creation input */
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

/**
 * Zod validation schema for updating an agent template.
 * All fields are optional for partial updates.
 */
export const updateTemplateSchema = createTemplateSchema.partial();

/** Inferred type for template update input */
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
