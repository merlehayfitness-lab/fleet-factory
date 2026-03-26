import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusVariant = "default" | "secondary" | "destructive" | "outline";

/**
 * Maps a status string to a visual badge variant and display label.
 *
 * Used throughout the dashboard for business, deployment, agent, task,
 * approval, and risk level status display.
 */
const STATUS_CONFIG: Record<
  string,
  { variant: StatusVariant; className?: string }
> = {
  // Active / success states
  active: { variant: "default", className: "bg-emerald-600 text-white" },
  live: { variant: "default", className: "bg-emerald-600 text-white" },

  // In-progress / warning states
  provisioning: {
    variant: "secondary",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },
  building: {
    variant: "secondary",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },
  deploying: {
    variant: "secondary",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },

  // Error states
  error: { variant: "destructive" },
  failed: { variant: "destructive" },

  // Frozen state (emergency)
  frozen: {
    variant: "secondary",
    className: "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500",
  },

  // Inactive / muted states
  paused: { variant: "outline" },
  suspended: { variant: "outline" },
  disabled: { variant: "secondary" },
  retired: { variant: "secondary" },
  rolled_back: { variant: "secondary" },

  // ---- Task statuses ----
  queued: {
    variant: "secondary",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  assigned: {
    variant: "secondary",
    className: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  },
  in_progress: {
    variant: "secondary",
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  waiting_approval: {
    variant: "secondary",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },
  assistance_requested: {
    variant: "secondary",
    className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  },
  completed: {
    variant: "default",
    className: "bg-emerald-600 text-white",
  },

  // ---- Approval statuses ----
  pending: {
    variant: "secondary",
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  auto_approved: {
    variant: "default",
    className: "bg-emerald-600 text-white",
  },
  approved: {
    variant: "default",
    className: "bg-emerald-600 text-white",
  },
  rejected: { variant: "destructive" },
  retry_pending: {
    variant: "secondary",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },
  guidance_required: {
    variant: "secondary",
    className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  },

  // ---- Risk levels ----
  low: {
    variant: "default",
    className: "bg-emerald-600 text-white",
  },
  medium: {
    variant: "secondary",
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  high: { variant: "destructive" },

  // ---- Integration statuses ----
  mock: { variant: "outline" },
  inactive: { variant: "outline" },
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const config = STATUS_CONFIG[status] ?? { variant: "outline" as StatusVariant };

  return (
    <Badge
      variant={config.variant}
      className={cn(config.className, className)}
    >
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
