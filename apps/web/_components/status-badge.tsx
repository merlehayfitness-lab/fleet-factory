import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusVariant = "default" | "secondary" | "destructive" | "outline";

/**
 * Maps a status string to a visual badge variant and display label.
 *
 * Used throughout the dashboard for business, deployment, and agent status display.
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
  queued: {
    variant: "secondary",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },

  // Error states
  error: { variant: "destructive" },
  failed: { variant: "destructive" },

  // Inactive / muted states
  paused: { variant: "outline" },
  suspended: { variant: "outline" },
  disabled: { variant: "secondary" },
  retired: { variant: "secondary" },
  rolled_back: { variant: "secondary" },
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
