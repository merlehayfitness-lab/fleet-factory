"use server";

import { createServerClient } from "@/_lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createTaskSchema } from "@agency-factory/core";
import type { CreateTaskInput } from "@agency-factory/core";
import type { TaskStatus } from "@agency-factory/core";
import {
  createTask,
  getTasksForBusiness,
  getTaskById,
  updateTaskStatus,
  respondToAssistanceRequest,
  executeTask,
} from "@agency-factory/core/server";

/**
 * Create a new task and route it through the orchestrator.
 */
export async function createTaskAction(
  businessId: string,
  input: CreateTaskInput,
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const task = await createTask(
      supabase,
      businessId,
      parsed.data,
      user.id,
      "admin",
    );

    // Route the task through the orchestrator
    const result = await executeTask(supabase, businessId, task.id);

    revalidatePath(`/businesses/${businessId}/tasks`);
    revalidatePath(`/businesses/${businessId}`);
    return { task, execution: result };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to create task",
    };
  }
}

/**
 * Fetch tasks for a business with optional filters.
 */
export async function getTasksAction(
  businessId: string,
  filters?: {
    status?: TaskStatus;
    priority?: string;
    departmentId?: string;
    agentId?: string;
  },
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const tasks = await getTasksForBusiness(supabase, businessId, filters);
    return { tasks };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to fetch tasks",
    };
  }
}

/**
 * Fetch a single task by ID.
 */
export async function getTaskAction(taskId: string) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const task = await getTaskById(supabase, taskId);
    return { task };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to fetch task",
    };
  }
}

/**
 * Update a task's status.
 */
export async function updateTaskStatusAction(
  taskId: string,
  newStatus: TaskStatus,
  businessId: string,
  updates?: Record<string, unknown>,
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const task = await updateTaskStatus(supabase, taskId, newStatus, updates);
    revalidatePath(`/businesses/${businessId}/tasks`);
    revalidatePath(`/businesses/${businessId}`);
    return { task };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to update task status",
    };
  }
}

/**
 * Quick-add a task with minimal fields (title, department, priority).
 * Lightweight alternative to the full createTaskAction for the inline form.
 */
export async function quickAddTaskAction(
  businessId: string,
  title: string,
  departmentId: string,
  priority: string,
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const input = {
    title,
    department_id: departmentId,
    priority: priority as "low" | "medium" | "high",
  };

  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const task = await createTask(
      supabase,
      businessId,
      parsed.data,
      user.id,
      "admin",
    );

    // Route through orchestrator
    const result = await executeTask(supabase, businessId, task.id);

    revalidatePath(`/businesses/${businessId}/tasks`);
    revalidatePath(`/businesses/${businessId}`);
    return { task, execution: result };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to create task",
    };
  }
}

/**
 * Respond to an assistance request, unblocking the agent.
 */
export async function respondToAssistanceAction(
  requestId: string,
  response: string,
  businessId: string,
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    await respondToAssistanceRequest(supabase, requestId, response, user.id);
    revalidatePath(`/businesses/${businessId}/tasks`);
    revalidatePath(`/businesses/${businessId}`);
    return { success: true };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Failed to respond to assistance request",
    };
  }
}
