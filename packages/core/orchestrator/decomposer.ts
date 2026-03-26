import type { SupabaseClient } from "@supabase/supabase-js";
import type { TaskSource } from "../types/index";
import { createTask } from "../task/task-service";

interface ParentTask {
  id: string;
  business_id: string;
  title: string;
  description?: string | null;
  priority: string;
  payload: Record<string, unknown>;
  created_by: string | null;
}

interface Department {
  id: string;
  name: string;
  type: string;
}

/** Preview of a decomposition plan for admin confirmation */
export interface DecompositionPlan {
  departmentName: string;
  departmentId: string;
  suggestedTitle: string;
  dependsOn: string[];
}

/**
 * Decompose a task into subtasks based on payload configuration.
 *
 * MVP decomposition rules (mock, not Claude-powered):
 * - If task payload has a "departments" array, create one subtask per department
 * - If payload has "sequential: true", subtasks have linear dependency chain
 * - Otherwise, return empty array (single-agent task, no decomposition)
 *
 * For high priority tasks, returns a preview plan without executing.
 */
export async function decomposeTask(
  supabase: SupabaseClient,
  parentTask: ParentTask,
  departments: Department[],
): Promise<{
  plan: DecompositionPlan[];
  subtaskIds: string[];
  isPreview: boolean;
}> {
  const payload = parentTask.payload ?? {};
  const targetDepts = payload.departments as string[] | undefined;

  // No decomposition needed
  if (!targetDepts || !Array.isArray(targetDepts) || targetDepts.length === 0) {
    return { plan: [], subtaskIds: [], isPreview: false };
  }

  // Match department names/types to actual departments
  const matchedDepts = targetDepts
    .map((deptNameOrType) => {
      return departments.find(
        (d) =>
          d.name.toLowerCase() === deptNameOrType.toLowerCase() ||
          d.type.toLowerCase() === deptNameOrType.toLowerCase(),
      );
    })
    .filter((d): d is Department => d !== undefined);

  if (matchedDepts.length === 0) {
    return { plan: [], subtaskIds: [], isPreview: false };
  }

  const isSequential = payload.sequential === true;

  // Build the decomposition plan
  const plan: DecompositionPlan[] = matchedDepts.map((dept, index) => ({
    departmentName: dept.name,
    departmentId: dept.id,
    suggestedTitle: `${parentTask.title} - ${dept.name}`,
    dependsOn: isSequential && index > 0
      ? [matchedDepts[index - 1].name]
      : [],
  }));

  // High priority tasks: preview only, admin must confirm
  if (parentTask.priority === "high") {
    return { plan, subtaskIds: [], isPreview: true };
  }

  // Create subtasks
  const subtaskIds: string[] = [];
  const createdSubtasks: Array<{ id: string; deptIndex: number }> = [];

  for (let i = 0; i < matchedDepts.length; i++) {
    const dept = matchedDepts[i];
    const subtask = await createTask(
      supabase,
      parentTask.business_id,
      {
        title: `${parentTask.title} - ${dept.name}`,
        description: parentTask.description ?? undefined,
        department_id: dept.id,
        priority: parentTask.priority as "low" | "medium" | "high",
        payload: { parent_context: parentTask.title },
      },
      parentTask.created_by ?? "",
      "orchestrator" as TaskSource,
      parentTask.id,
    );

    subtaskIds.push(subtask.id);
    createdSubtasks.push({ id: subtask.id, deptIndex: i });
  }

  // Create dependency edges for sequential tasks
  if (isSequential && createdSubtasks.length > 1) {
    for (let i = 1; i < createdSubtasks.length; i++) {
      const { error } = await supabase
        .from("subtask_dependencies")
        .insert({
          task_id: createdSubtasks[i].id,
          depends_on_task_id: createdSubtasks[i - 1].id,
        });

      if (error) {
        console.error("Failed to create subtask dependency:", error.message);
      }
    }
  }

  return { plan, subtaskIds, isPreview: false };
}
