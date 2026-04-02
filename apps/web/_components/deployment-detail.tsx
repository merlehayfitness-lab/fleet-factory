"use client";

import { useState, useEffect, useRef } from "react";
import {
  Check,
  X,
  Loader2,
  Minus,
  ChevronDown,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/_components/status-badge";
import { DeploymentStepper } from "@/_components/deployment-stepper";
import { ArtifactViewer } from "@/_components/artifact-viewer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { retryDeploymentAction, getDeploymentStatusAction } from "@/_actions/deployment-actions";
import { DeploymentProgressStream } from "@/_components/deployment-progress-stream";
import { DeploymentDiffViewer } from "@/_components/deployment-diff-viewer";
import type { DeploymentStatus } from "@fleet-factory/core";

interface Deployment {
  id: string;
  business_id: string;
  version: number;
  status: string;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  config_snapshot: Record<string, unknown> | null;
}

interface DeploymentDetailProps {
  deployment: Deployment | null;
  businessId: string;
  vpsWsUrl: string | null;
  vpsConfigured: boolean;
  isDisabled?: boolean;
}

const STAGES = ["Queued", "Building", "Deploying", "Live"] as const;

type StageStatus = "passed" | "failed" | "in_progress" | "not_reached";

/**
 * Derive the status of each stage from the deployment record.
 */
function deriveStageStatuses(deployment: Deployment): StageStatus[] {
  const status = deployment.status as DeploymentStatus;
  const statuses: StageStatus[] = ["not_reached", "not_reached", "not_reached", "not_reached"];

  switch (status) {
    case "queued":
      statuses[0] = "in_progress";
      break;
    case "building":
      statuses[0] = "passed";
      statuses[1] = "in_progress";
      break;
    case "deploying":
      statuses[0] = "passed";
      statuses[1] = "passed";
      statuses[2] = "in_progress";
      break;
    case "live":
      statuses[0] = "passed";
      statuses[1] = "passed";
      statuses[2] = "passed";
      statuses[3] = "passed";
      break;
    case "rolled_back":
      statuses[0] = "passed";
      statuses[1] = "passed";
      statuses[2] = "passed";
      statuses[3] = "passed";
      break;
    case "failed":
      // Determine which stage failed based on available timestamps
      statuses[0] = "passed"; // queued always passes if we got to failed
      if (deployment.started_at) {
        statuses[1] = "passed"; // building started
        statuses[2] = "failed"; // deploying failed
      } else {
        statuses[1] = "failed"; // building failed
      }
      break;
  }

  return statuses;
}

function getStageTimestamp(deployment: Deployment, stageIdx: number): string | null {
  switch (stageIdx) {
    case 0:
      return deployment.created_at;
    case 1:
      return deployment.started_at;
    case 2:
      return deployment.started_at; // deploying starts after building
    case 3:
      return deployment.completed_at;
    default:
      return null;
  }
}

function formatTimestamp(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${diffDay}d ago`;
}

/**
 * Right panel showing selected deployment details.
 * Includes header, status stepper, per-stage error timeline,
 * artifact viewer, and config snapshot section.
 */
const ACTIVE_STATUSES = new Set(["queued", "building", "deploying", "verifying"]);
const POLL_INTERVAL_MS = 3000;

export function DeploymentDetail({
  deployment: initialDeployment,
  businessId,
  vpsWsUrl,
  vpsConfigured,
  isDisabled = false,
}: DeploymentDetailProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [deployment, setDeployment] = useState(initialDeployment);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync when parent passes a new deployment (different ID or final status after revalidate)
  useEffect(() => {
    setDeployment(initialDeployment);
  }, [initialDeployment?.id, initialDeployment?.status]);

  // Poll for status updates while deployment is active
  useEffect(() => {
    if (!deployment || !ACTIVE_STATUSES.has(deployment.status)) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    pollRef.current = setInterval(async () => {
      const result = await getDeploymentStatusAction(deployment.id);
      if ("deployment" in result && result.deployment) {
        const updated = result.deployment as unknown as Deployment;
        setDeployment((prev) =>
          prev ? { ...prev, ...updated } : prev
        );
        if (!ACTIVE_STATUSES.has(updated.status)) {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [deployment?.id, deployment?.status]);

  if (!deployment) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Select a deployment to view details
      </div>
    );
  }

  const stageStatuses = deriveStageStatuses(deployment);
  const isFailed = deployment.status === "failed";
  const snapshot = deployment.config_snapshot;
  const artifacts = snapshot?.artifacts as Record<string, string> | undefined;
  const agents = Array.isArray(snapshot?.agents) ? snapshot.agents : [];
  const departments = Array.isArray(snapshot?.departments)
    ? snapshot.departments
    : [];

  async function handleRetry() {
    setIsRetrying(true);
    try {
      const result = await retryDeploymentAction(businessId, deployment!.id);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Retry deployment started");
      }
    } catch {
      toast.error("Failed to retry deployment");
    } finally {
      setIsRetrying(false);
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">v{deployment.version}</h2>
            <StatusBadge status={deployment.status} />
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>Created {formatRelativeTime(deployment.created_at)}</span>
            {deployment.started_at && (
              <span>Started {formatRelativeTime(deployment.started_at)}</span>
            )}
            {deployment.completed_at && (
              <span>
                Completed {formatRelativeTime(deployment.completed_at)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Status Stepper */}
      <Card>
        <CardContent className="pt-6">
          <DeploymentStepper
            status={deployment.status as DeploymentStatus}
          />
        </CardContent>
      </Card>

      {/* Per-Stage Error Timeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Stage Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          {STAGES.map((stage, idx) => {
            const stageStatus = stageStatuses[idx];
            const timestamp = getStageTimestamp(deployment, idx);
            const isFailedStage = stageStatus === "failed";

            return (
              <div key={stage}>
                <div
                  className={cn(
                    "flex items-center justify-between rounded-md px-3 py-2",
                    isFailedStage && "bg-destructive/10"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {stageStatus === "passed" ? (
                      <Check className="size-4 text-emerald-500" />
                    ) : stageStatus === "failed" ? (
                      <X className="size-4 text-destructive" />
                    ) : stageStatus === "in_progress" ? (
                      <Loader2 className="size-4 animate-spin text-primary" />
                    ) : (
                      <Minus className="size-4 text-muted-foreground/40" />
                    )}
                    <span
                      className={cn(
                        "text-sm font-medium",
                        stageStatus === "not_reached" &&
                          "text-muted-foreground/50"
                      )}
                    >
                      {stage}
                    </span>
                  </div>
                  {timestamp && stageStatus !== "not_reached" && (
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(timestamp)}
                    </span>
                  )}
                </div>

                {/* Expanded error for failed stage */}
                {isFailedStage && deployment.error_message && (
                  <div className="mx-3 mb-2 rounded-md bg-destructive/5 p-3">
                    <pre className="mb-3 whitespace-pre-wrap font-mono text-xs text-destructive">
                      {deployment.error_message}
                    </pre>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRetry}
                      disabled={isDisabled || isRetrying}
                      title={isDisabled ? "Business is suspended" : undefined}
                      className={isDisabled ? "opacity-50 cursor-not-allowed" : undefined}
                    >
                      {isRetrying ? (
                        <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="mr-1.5 size-3.5" />
                      )}
                      Retry
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* VPS Deployment Progress (live streaming) */}
      {vpsConfigured && (
        <DeploymentProgressStream
          deploymentId={deployment.id}
          vpsWsUrl={vpsWsUrl}
          isActive={["deploying", "verifying"].includes(deployment.status)}
        />
      )}

      {/* Artifacts Section */}
      {artifacts && Object.keys(artifacts).length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Generated Artifacts</h3>
          {artifacts.tenant_config && (
            <ArtifactViewer
              title="Tenant Config"
              content={artifacts.tenant_config}
              filename="tenant-config.json"
            />
          )}
          {artifacts.docker_compose && (
            <ArtifactViewer
              title="Docker Compose"
              content={artifacts.docker_compose}
              filename="docker-compose.generated.yml"
            />
          )}
          {artifacts.env_file && (
            <ArtifactViewer
              title="Environment File"
              content={artifacts.env_file}
              filename=".env.generated"
            />
          )}
          {/* Per-agent runtime configs */}
          {Array.isArray(artifacts.agent_configs) &&
            artifacts.agent_configs.map(
              (ac: { agent_id: string; filename: string; content: string }) => (
                <ArtifactViewer
                  key={ac.agent_id}
                  title={`Agent Runtime: ${ac.filename}`}
                  content={ac.content}
                  filename={ac.filename}
                />
              ),
            )}
        </div>
      )}

      {/* Claude Code Optimization Report */}
      <DeploymentDiffViewer
        optimizationReport={
          (snapshot?.optimization_report as
            | { changes: Array<{ file: string; description: string }>; summary: string }
            | undefined) ?? null
        }
      />

      {/* Config Snapshot Section */}
      {snapshot && (
        <Collapsible open={snapshotOpen} onOpenChange={setSnapshotOpen}>
          <CollapsibleTrigger className="flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/50">
            {snapshotOpen ? (
              <ChevronDown className="mr-1.5 size-3.5" />
            ) : (
              <ChevronRight className="mr-1.5 size-3.5" />
            )}
            Config Snapshot ({agents.length} agents, {departments.length}{" "}
            departments)
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-muted p-4 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">
              {JSON.stringify(snapshot, null, 2)}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
