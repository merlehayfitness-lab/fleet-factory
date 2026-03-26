import { z } from "zod";

/**
 * Zod validation schema for creating a task.
 * Tasks are the work units assigned to department agents.
 */
export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  department_id: z.string().uuid("Invalid department"),
  priority: z.enum(["low", "medium", "high"]).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

/** Inferred type for task creation input */
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

/**
 * Zod validation schema for updating a task.
 * Supports partial updates for status transitions and field modifications.
 */
export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  status: z
    .enum([
      "queued",
      "assigned",
      "in_progress",
      "waiting_approval",
      "assistance_requested",
      "completed",
      "failed",
    ])
    .optional(),
  assigned_agent_id: z.nullable(z.string().uuid()).optional(),
  result: z.nullable(z.record(z.string(), z.unknown())).optional(),
  error_message: z.nullable(z.string()).optional(),
});

/** Inferred type for task update input */
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
