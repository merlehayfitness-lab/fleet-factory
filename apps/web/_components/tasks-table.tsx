"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

interface TasksTableProps {
  tasks: Task[];
  businessId: string;
}

/**
 * Table view of tasks with clickable rows that open the detail panel.
 */
export function TasksTable({ tasks, businessId }: TasksTableProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
        <p className="text-sm text-muted-foreground">
          No tasks yet. Create one above or use the full creation page.
        </p>
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Agent</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow
              key={task.id}
              className="cursor-pointer"
              onClick={() => setSelectedTask(task)}
            >
              <TableCell className="font-medium">{task.title}</TableCell>
              <TableCell>
                <StatusBadge status={task.status} />
              </TableCell>
              <TableCell>
                <StatusBadge status={task.priority} />
              </TableCell>
              <TableCell>
                {task.departments?.name ?? (
                  <span className="text-muted-foreground">--</span>
                )}
              </TableCell>
              <TableCell>
                {task.agents?.name ?? (
                  <span className="text-muted-foreground">--</span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(task.created_at).toLocaleDateString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

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
