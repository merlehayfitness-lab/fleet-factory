"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { checkVpsHealthAction } from "@/_actions/vps-actions";

interface VpsStatusIndicatorProps {
  initialStatus: {
    status: string;
    lastCheckedAt: string;
    details?: Record<string, unknown>;
  } | null;
}

/** Map VPS status to color classes */
function statusColor(status: string): string {
  switch (status) {
    case "online":
      return "bg-emerald-500";
    case "offline":
      return "bg-red-500";
    case "degraded":
      return "bg-amber-500";
    default:
      return "bg-gray-400";
  }
}

/** Map VPS status to text color classes */
function statusTextColor(status: string): string {
  switch (status) {
    case "online":
      return "text-emerald-700 dark:text-emerald-400";
    case "offline":
      return "text-red-700 dark:text-red-400";
    case "degraded":
      return "text-amber-700 dark:text-amber-400";
    default:
      return "text-muted-foreground";
  }
}

/** Format relative time from ISO string */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * VPS status indicator badge for the dashboard header.
 *
 * Shows a color-coded status pill with last-checked time.
 * Refreshes on mount and supports manual refresh via click.
 */
export function VpsStatusIndicator({ initialStatus }: VpsStatusIndicatorProps) {
  const [status, setStatus] = useState(initialStatus);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshHealth = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const result = await checkVpsHealthAction();
      if (!("error" in result)) {
        setStatus({
          status: result.status,
          lastCheckedAt: result.lastCheckedAt,
          details: result.details,
        });
      }
    } catch {
      // Silent failure -- status stays as-is
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Refresh health status on mount
  useEffect(() => {
    refreshHealth();
  }, [refreshHealth]);

  // Not configured
  if (!status) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
        <span className="size-2 rounded-full bg-gray-400" />
        <span>VPS: Not configured</span>
      </div>
    );
  }

  const displayStatus = status.status.charAt(0).toUpperCase() + status.status.slice(1);

  return (
    <button
      type="button"
      onClick={refreshHealth}
      disabled={isRefreshing}
      className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs transition-colors hover:bg-muted/50 disabled:opacity-70"
    >
      <span className={`size-2 rounded-full ${statusColor(status.status)}`} />
      <span className={statusTextColor(status.status)}>VPS: {displayStatus}</span>
      {status.lastCheckedAt && (
        <>
          <span className="text-muted-foreground/50">|</span>
          <span className="text-muted-foreground">{relativeTime(status.lastCheckedAt)}</span>
        </>
      )}
      <RefreshCw className={`size-3 text-muted-foreground ${isRefreshing ? "animate-spin" : ""}`} />
    </button>
  );
}
