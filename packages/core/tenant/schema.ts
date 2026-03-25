import { z } from "zod";

/**
 * Zod validation schema for creating a new business.
 *
 * Validates:
 * - name: 2-100 characters
 * - slug: 2-50 characters, lowercase alphanumeric + hyphens only
 * - industry: 1+ characters, defaults to 'general'
 */
export const createBusinessSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be 100 characters or fewer"),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(50, "Slug must be 50 characters or fewer")
    .regex(
      /^[a-z0-9-]+$/,
      "Slug must contain only lowercase letters, numbers, and hyphens",
    ),
  industry: z.string().min(1, "Industry is required").default("general"),
});

/** Inferred type for business creation input */
export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
