"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { X, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/_components/status-badge";
import { updateTaskStatusAction } from "@/_actions/task-actions";

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

interface TaskDetailPanelProps {
  task: Task;
  businessId: string;
  onClose: () => void;
}

/**
 * Slide-over panel for quick task detail view.
 * Shows key task info and provides actions based on current status.
 */
export function TaskDetailPanel({
  task,
  businessId,
  onClose,
}: TaskDetailPanelProps) {
  const [loading, setLoading] = useState(false);

  async function handleStatusChange(newStatus: "completed" | "failed") {
    setLoading(true);
    const result = await updateTaskStatusAction(task.id, newStatus, businessId);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Task marked as ${newStatus}`);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/10 backdrop-blur-xs"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 flex w-full max-w-md flex-col bg-popover shadow-lg ring-1 ring-foreground/10">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-base font-semibold">Task Details</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Title and status */}
          <div>
            <h3 className="text-lg font-medium">{task.title}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={task.status} />
              <StatusBadge status={task.priority} />
              <Badge variant="outline">{task.source}</Badge>
            </div>
          </div>

          {/* Description */}
          {task.description && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Description
              </p>
              <p className="mt-1 text-sm">{task.description}</p>
            </div>
          )}

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3">
            <DetailItem
              label="Department"
              value={task.departments?.name ?? "Unassigned"}
            />
            <DetailItem
              label="Agent"
              value={task.agents?.name ?? "Unassigned"}
            />
            <DetailItem
              label="Created"
              value={new Date(task.created_at).toLocaleDateString()}
            />
            {task.started_at && (
              <DetailItem
                label="Started"
                value={new Date(task.started_at).toLocaleDateString()}
              />
            )}
            {task.completed_at && (
              <DetailItem
                label="Completed"
                value={new Date(task.completed_at).toLocaleDateString()}
              />
            )}
          </div>

          {/* View full details link */}
          <Link
            href={`/businesses/${businessId}/tasks/${task.id}`}
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <ExternalLink className="size-3.5" />
            View full details
          </Link>
        </div>

        {/* Actions */}
        {(task.status === "in_progress" ||
          task.status === "waiting_approval" ||
          task.status === "assistance_requested") && (
          <div className="flex gap-2 border-t p-4">
            <Button
              variant="default"
              size="sm"
              disabled={loading || task.status !== "in_progress"}
              onClick={() => handleStatusChange("completed")}
            >
              {loading && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Mark Complete
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => handleStatusChange("failed")}
            >
              Mark Failed
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      <p className="mt-0.5 text-sm">{value}</p>
    </div>
  );
}
