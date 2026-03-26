import { z } from "zod";

/**
 * Zod schema for approving an action.
 * Decision note is optional for approvals.
 */
export const approveActionSchema = z.object({
  decision_note: z.string().max(1000).optional(),
});

/** Inferred type for approve action input */
export type ApproveActionInput = z.infer<typeof approveActionSchema>;

/**
 * Zod schema for rejecting an action.
 * Decision note is required to provide guidance to the agent.
 */
export const rejectActionSchema = z.object({
  decision_note: z
    .string()
    .min(1, "Guidance is required")
    .max(1000, "Guidance is required"),
});

/** Inferred type for reject action input */
export type RejectActionInput = z.infer<typeof rejectActionSchema>;

/**
 * Zod schema for bulk approve/reject actions.
 * Requires at least one approval ID.
 */
export const bulkActionSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "Select at least one item"),
  decision_note: z.string().max(1000).optional(),
});

/** Inferred type for bulk action input */
export type BulkActionInput = z.infer<typeof bulkActionSchema>;
