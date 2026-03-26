import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createServerClient } from "@/_lib/supabase/server";
import { StatusBadge } from "@/_components/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Full task detail page (Server Component).
 *
 * Shows task details, subtasks, approvals, assistance requests, and audit trail.
 */
export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  const { id: businessId, taskId } = await params;
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Fetch task with department and agent joins
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select(
      "*, departments:department_id(name), agents:assigned_agent_id(name)",
    )
    .eq("id", taskId)
    .single();

  if (taskError || !task) {
    notFound();
  }

  // Fetch subtasks if this is a parent task
  const { data: subtasks } = await supabase
    .from("tasks")
    .select(
      "*, departments:department_id(name), agents:assigned_agent_id(name)",
    )
    .eq("parent_task_id", taskId)
    .order("created_at", { ascending: true });

  // Fetch approvals for this task
  const { data: approvals } = await supabase
    .from("approvals")
    .select("*, agents:agent_id(name)")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });

  // Fetch assistance requests for this task
  const { data: assistanceRequests } = await supabase
    .from("assistance_requests")
    .select("*, agents:agent_id(name)")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });

  // Fetch audit logs for this task
  const { data: auditLogs } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("entity_type", "task")
    .eq("entity_id", taskId)
    .order("created_at", { ascending: false })
    .limit(20);

  const subtaskList = subtasks ?? [];
  const completedSubtasks = subtaskList.filter(
    (s) => s.status === "completed",
  );

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href={`/businesses/${businessId}/tasks`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to tasks
      </Link>

      {/* Page header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {task.title}
          </h1>
          <StatusBadge status={task.status} />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <StatusBadge status={task.priority} />
          <Badge variant="outline">{task.source}</Badge>
        </div>
      </div>

      {/* Details section */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {task.description && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Description
              </p>
              <p className="mt-1 text-sm">{task.description}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Department
              </p>
              <p className="mt-0.5 text-sm">
                {(task.departments as { name: string } | null)?.name ??
                  "Unassigned"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Agent
              </p>
              <p className="mt-0.5 text-sm">
                {(task.agents as { name: string } | null)?.name ??
                  "Unassigned"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Created
              </p>
              <p className="mt-0.5 text-sm">
                {new Date(task.created_at).toLocaleString()}
              </p>
            </div>
            {task.completed_at && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Completed
                </p>
                <p className="mt-0.5 text-sm">
                  {new Date(task.completed_at).toLocaleString()}
                </p>
              </div>
            )}
          </div>
          {task.error_message && (
            <div className="rounded-md bg-destructive/10 p-3">
              <p className="text-xs font-medium text-destructive uppercase tracking-wider">
                Error
              </p>
              <p className="mt-1 text-sm text-destructive">
                {task.error_message}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subtasks section */}
      {subtaskList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Subtasks ({completedSubtasks.length} of {subtaskList.length}{" "}
              completed)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {subtaskList.map((subtask) => (
                <div
                  key={subtask.id}
                  className="flex items-center gap-3 rounded-md border p-3"
                >
                  <StatusBadge status={subtask.status} />
                  <span className="flex-1 text-sm font-medium">
                    {subtask.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {(subtask.departments as { name: string } | null)?.name ??
                      "--"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Approvals section */}
      {(approvals ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(approvals ?? []).map((approval) => (
                <div
                  key={approval.id}
                  className="flex items-center gap-3 rounded-md border p-3"
                >
                  <StatusBadge status={approval.status} />
                  <StatusBadge status={approval.risk_level} />
                  <span className="flex-1 text-sm">
                    {approval.action_summary}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {(approval.agents as { name: string } | null)?.name ??
                      "--"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assistance requests section */}
      {(assistanceRequests ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Assistance Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(assistanceRequests ?? []).map((req) => (
                <div
                  key={req.id}
                  className="rounded-md border p-3 space-y-1"
                >
                  <div className="flex items-center gap-2">
                    <StatusBadge status={req.status} />
                    <span className="text-xs text-muted-foreground">
                      {(req.agents as { name: string } | null)?.name ??
                        "--"}
                    </span>
                  </div>
                  <p className="text-sm font-medium">
                    {req.blocking_reason}
                  </p>
                  {req.admin_response && (
                    <p className="text-sm text-muted-foreground">
                      Response: {req.admin_response}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity / audit trail */}
      {(auditLogs ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(auditLogs ?? []).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center gap-3 text-sm"
                >
                  <span className="font-mono text-xs text-muted-foreground">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                  <Badge variant="outline">{log.action}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
