"use client";

import { useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { rollbackDeploymentAction } from "@/_actions/deployment-actions";
import { cn } from "@/lib/utils";

interface RollbackDeployment {
  id: string;
  version: number;
  status: string;
  created_at: string;
  config_snapshot: Record<string, unknown> | null;
}

interface RollbackDialogProps {
  businessId: string;
  deployments: RollbackDeployment[];
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
 * Rollback dialog allowing admin to select a previous successful
 * deployment version and roll back to it.
 */
export function RollbackDialog({ businessId, deployments }: RollbackDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);

  // Only show completed deployments that could be rolled back to
  const rollbackCandidates = deployments.filter(
    (d) => d.status === "live" || d.status === "rolled_back"
  );

  async function handleRollback() {
    if (selectedVersion === null) return;
    setIsRollingBack(true);
    try {
      const result = await rollbackDeploymentAction(businessId, selectedVersion);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(`Rolled back to v${selectedVersion}`);
        setOpen(false);
      }
    } catch {
      toast.error("Failed to rollback deployment");
    } finally {
      setIsRollingBack(false);
    }
  }

  if (rollbackCandidates.length === 0) return null;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <RotateCcw className="mr-1.5 size-3.5" />
        Rollback
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rollback Deployment</AlertDialogTitle>
            <AlertDialogDescription>
              Select a previous successful deployment to roll back to
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="max-h-64 space-y-1 overflow-auto">
            {rollbackCandidates.map((d) => {
              const agentCount =
                (d.config_snapshot as Record<string, unknown> | null)?.agents;
              const count = Array.isArray(agentCount) ? agentCount.length : 0;
              const isSelected = selectedVersion === d.version;

              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelectedVersion(d.version)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-left text-sm transition-colors",
                    isSelected
                      ? "border-primary bg-accent"
                      : "border-transparent hover:bg-accent/50"
                  )}
                >
                  <div>
                    <span className="font-medium">v{d.version}</span>
                    <span className="ml-2 text-muted-foreground">
                      {count} agent{count !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(d.created_at)}
                  </span>
                </button>
              );
            })}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRollingBack}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRollback}
              disabled={selectedVersion === null || isRollingBack}
            >
              {isRollingBack && (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              )}
              {selectedVersion !== null
                ? `Rollback to v${selectedVersion}`
                : "Select a version"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
