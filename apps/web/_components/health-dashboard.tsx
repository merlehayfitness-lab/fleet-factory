"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Rocket,
  Bot,
  Shield,
  CheckSquare,
  AlertTriangle,
  Activity,
  ScrollText,
  MessageSquare,
  Zap,
  Clock,
  Settings,
  Power,
  RotateCcw,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/_components/status-badge";
import { UsageSummary, type UsageSummaryData } from "@/_components/usage-summary";
import { AgentHealthGrid } from "@/_components/agent-health-grid";
import { TypeToConfirmDialog } from "@/_components/type-to-confirm-dialog";
import { getHealthDashboard } from "@/_actions/health-actions";
import {
  disableTenantAction,
  restoreTenantAction,
} from "@/_actions/emergency-actions";
import { toast } from "sonner";
import type { SystemHealth } from "@agency-factory/core/server";

interface HealthDashboardProps {
  business: {
    id: string;
    name: string;
    slug: string;
    industry: string | null;
    status: string;
    created_at: string;
  };
  initialHealth: SystemHealth;
  usageSummary: UsageSummaryData;
}

/** Humanize audit log action strings: "agent.frozen" -> "Agent frozen" */
function humanizeAction(action: string): string {
  return action
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
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

/** Get error rate color class */
function errorRateColor(rate: number): string {
  if (rate < 0.05) return "text-emerald-600";
  if (rate < 0.2) return "text-amber-600";
  return "text-red-600";
}

/**
 * Health dashboard with auto-refresh polling.
 *
 * Receives initial health data from the Server Component (SSR'd),
 * then polls every 30 seconds for fresh data.
 */
export function HealthDashboard({
  business,
  initialHealth,
  usageSummary,
}: HealthDashboardProps) {
  const [health, setHealth] = useState<SystemHealth>(initialHealth);
  const [showDisableTenant, setShowDisableTenant] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  // Poll for fresh health data every 30 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      const result = await getHealthDashboard(business.id);
      if ("data" in result) {
        setHealth(result.data);
      }
    }, 30_000);

    return () => clearInterval(interval);
  }, [business.id]);

  const handleDisableTenant = useCallback(
    async (reason: string) => {
      setIsPending(true);
      const result = await disableTenantAction(business.id, reason);
      setIsPending(false);
      setShowDisableTenant(false);

      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Tenant disabled. All agents have been frozen.");
        router.refresh();
      }
    },
    [business.id, router],
  );

  const handleRestoreTenant = useCallback(async () => {
    setIsPending(true);
    const result = await restoreTenantAction(business.id);
    setIsPending(false);

    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success(
        "Tenant restored. Agents remain frozen for manual review.",
      );
      router.refresh();
    }
  }, [business.id, router]);

  const errorRatePercent = Math.round(health.errorRate.rate * 100);
  const totalAgents = health.agentHealth.departments.reduce(
    (sum, dept) => sum + dept.agents.length,
    0,
  );

  const isDisabled = business.status === "disabled";

  return (
    <div className="space-y-6">
      {/* Page header with settings dropdown */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{business.name}</h1>
          <StatusBadge status={business.status} />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" className="gap-1.5">
                <Settings className="size-4" />
                Settings
              </Button>
            }
          />
          <DropdownMenuContent align="end" side="bottom" sideOffset={4}>
            <DropdownMenuLabel>Emergency Controls</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {isDisabled ? (
              <DropdownMenuItem
                onClick={handleRestoreTenant}
                disabled={isPending}
              >
                <RotateCcw className="size-4 text-emerald-600" />
                <span>Restore Tenant</span>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setShowDisableTenant(true)}
                disabled={isPending}
              >
                <Power className="size-4" />
                <span>Disable Tenant</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tenant disable confirmation dialog */}
      <TypeToConfirmDialog
        open={showDisableTenant}
        onOpenChange={setShowDisableTenant}
        title="Disable Tenant"
        description={`This will disable the entire "${business.name}" business and freeze all active agents. Users will lose access until the tenant is restored. Agents will remain frozen for manual review after restoration.`}
        confirmPhrase="DISABLE ALL"
        actionLabel="Disable Tenant"
        variant="destructive"
        onConfirm={handleDisableTenant}
        isPending={isPending}
      />

      {/* Row 1: Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Rocket className="size-3.5" />
              Deployment
            </CardDescription>
            <CardTitle>
              {health.latestDeployment ? (
                <StatusBadge status={health.latestDeployment.status} />
              ) : (
                <span className="text-sm text-muted-foreground">
                  No deployments
                </span>
              )}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Bot className="size-3.5" />
              Agents
            </CardDescription>
            <CardTitle>{totalAgents}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <CheckSquare className="size-3.5" />
              Active Tasks
            </CardDescription>
            <CardTitle>{health.activeTasks}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Shield className="size-3.5" />
              Pending Approvals
            </CardDescription>
            <CardTitle>{health.pendingApprovals}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <AlertTriangle className="size-3.5" />
              Error Rate (24h)
            </CardDescription>
            <CardTitle className={errorRateColor(health.errorRate.rate)}>
              {errorRatePercent}%
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                ({health.errorRate.failedCount}/{health.errorRate.totalCount})
              </span>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Row 2: Mixed panel layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Left side: task throughput + usage summary */}
        <div className="space-y-4">
          {/* Task throughput card */}
          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-1.5">
                <Zap className="size-3.5" />
                Task Throughput (24h)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">
                    {health.taskThroughput.completedCount}
                  </p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {health.taskThroughput.queuedCount}
                  </p>
                  <p className="text-xs text-muted-foreground">Backlog</p>
                </div>
                <div>
                  <p className="text-2xl font-bold flex items-center justify-center gap-1">
                    {health.taskThroughput.avgCompletionMinutes !== null ? (
                      <>
                        {health.taskThroughput.avgCompletionMinutes}
                        <Clock className="size-3.5 text-muted-foreground" />
                      </>
                    ) : (
                      <span className="text-muted-foreground">--</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">Avg min</p>
                </div>
              </div>
              {health.errorRate.assistanceRequestCount > 0 && (
                <div className="mt-3 flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                  <AlertTriangle className="size-3.5" />
                  {health.errorRate.assistanceRequestCount} open assistance
                  request{health.errorRate.assistanceRequestCount !== 1 ? "s" : ""}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Usage summary */}
          <div>
            <h2 className="mb-3 text-lg font-semibold">Token Usage</h2>
            <UsageSummary usageSummary={usageSummary} />
          </div>
        </div>

        {/* Right side: agent health grid */}
        <div>
          <h2 className="mb-3 text-lg font-semibold">Agent Health</h2>
          <AgentHealthGrid
            departments={health.agentHealth.departments}
            businessId={business.id}
          />
        </div>
      </div>

      {/* Row 3: Quick links */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Quick Links</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLinkCard
            href={`/businesses/${business.id}/agents`}
            label="Agents"
            description="View and manage agents"
            icon={Bot}
          />
          <QuickLinkCard
            href={`/businesses/${business.id}/deployments`}
            label="Deployments"
            description="Manage deployments"
            icon={Rocket}
          />
          <QuickLinkCard
            href={`/businesses/${business.id}/tasks`}
            label="Tasks"
            description={
              health.activeTasks > 0
                ? `${health.activeTasks} active`
                : "View task work queue"
            }
            icon={CheckSquare}
          />
          <QuickLinkCard
            href={`/businesses/${business.id}/approvals`}
            label="Approvals"
            description={
              health.pendingApprovals > 0
                ? `${health.pendingApprovals} pending`
                : "Review agent actions"
            }
            icon={Shield}
          />
          <QuickLinkCard
            href={`/businesses/${business.id}/chat`}
            label="Chat"
            description="Chat with department agents"
            icon={MessageSquare}
          />
          <QuickLinkCard
            href={`/businesses/${business.id}/logs`}
            label="Logs"
            description="View audit trail and conversations"
            icon={ScrollText}
          />
        </div>
      </div>

      {/* Row 4: Recent activity */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Recent Activity</h2>
        {health.recentActivity.length > 0 ? (
          <Card>
            <CardContent className="divide-y py-0">
              {health.recentActivity.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 py-3 text-sm"
                >
                  <Activity className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{humanizeAction(entry.action)}</p>
                    {entry.entityType && (
                      <p className="text-xs text-muted-foreground">
                        {entry.entityType}
                        {entry.entityId ? ` (${entry.entityId.slice(0, 8)}...)` : ""}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {relativeTime(entry.createdAt)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Activity className="mr-2 size-4" />
              No recent activity
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function QuickLinkCard({
  href,
  label,
  description,
  icon: Icon,
}: {
  href: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link href={href}>
      <Card className="transition-colors hover:bg-accent/50">
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5">
            <Icon className="size-3.5" />
            {label}
          </CardDescription>
          <CardTitle className="text-sm font-normal text-muted-foreground">
            {description}
          </CardTitle>
        </CardHeader>
      </Card>
    </Link>
  );
}
