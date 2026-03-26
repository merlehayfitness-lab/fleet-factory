"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/_components/status-badge";
import { TaskDetailPanel } from "@/_components/task-detail-panel";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  source: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  departments: { name: string } | null;
  agents: { name: string } | null;
}

interface TasksKanbanProps {
  tasks: Task[];
  businessId: string;
}

const KANBAN_COLUMNS = [
  { status: "queued", label: "Queued" },
  { status: "assigned", label: "Assigned" },
  { status: "in_progress", label: "In Progress" },
  { status: "waiting_approval", label: "Waiting Approval" },
  { status: "completed", label: "Completed" },
  { status: "failed", label: "Failed" },
] as const;

/**
 * Kanban board view with columns by task status.
 * Visual only -- no drag-and-drop functionality.
 * Clicking a card opens the detail panel.
 */
export function TasksKanban({ tasks, businessId }: TasksKanbanProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  function getTasksForColumn(status: string): Task[] {
    // Map assistance_requested tasks to waiting_approval column
    const mappedStatus =
      status === "waiting_approval"
        ? ["waiting_approval", "assistance_requested"]
        : [status];
    return tasks.filter((t) => mappedStatus.includes(t.status));
  }

  return (
    <>
      <div className="grid grid-cols-6 gap-3 overflow-x-auto">
        {KANBAN_COLUMNS.map((col) => {
          const columnTasks = getTasksForColumn(col.status);
          return (
            <div
              key={col.status}
              className="flex min-w-[180px] flex-col rounded-lg bg-muted/30 p-2"
            >
              {/* Column header */}
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {col.label}
                </span>
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {columnTasks.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2">
                {columnTasks.map((task) => (
                  <Card
                    key={task.id}
                    className="cursor-pointer transition-colors hover:bg-accent/50"
                    onClick={() => setSelectedTask(task)}
                  >
                    <CardContent className="p-3">
                      <p className="text-sm font-medium leading-tight">
                        {task.title}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <StatusBadge status={task.priority} />
                      </div>
                      <div className="mt-1.5 text-xs text-muted-foreground">
                        {task.departments?.name ?? "No department"}
                      </div>
                      {task.agents?.name && (
                        <div className="text-xs text-muted-foreground">
                          {task.agents.name}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {columnTasks.length === 0 && (
                  <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground/50">
                    No tasks
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          businessId={businessId}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </>
  );
}
