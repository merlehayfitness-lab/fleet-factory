"use client";

import { useState } from "react";
import { Loader2, Rocket } from "lucide-react";
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
import { deployAction } from "@/_actions/deployment-actions";

interface DeployButtonProps {
  businessId: string;
  hasLiveDeployment: boolean;
  agentCount: number;
}

/**
 * Deploy/Redeploy button with smart confirm logic.
 * First deploy: one-click (no confirmation needed).
 * Redeploy: opens AlertDialog confirmation with agent count.
 */
export function DeployButton({
  businessId,
  hasLiveDeployment,
  agentCount,
}: DeployButtonProps) {
  const [isDeploying, setIsDeploying] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleDeploy() {
    setIsDeploying(true);
    try {
      const result = await deployAction(businessId);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Deployment started");
      }
    } catch {
      toast.error("Failed to start deployment");
    } finally {
      setIsDeploying(false);
      setShowConfirm(false);
    }
  }

  function handleClick() {
    if (hasLiveDeployment) {
      setShowConfirm(true);
    } else {
      void handleDeploy();
    }
  }

  return (
    <>
      <Button
        onClick={handleClick}
        disabled={isDeploying}
        variant={hasLiveDeployment ? "outline" : "default"}
        className={
          hasLiveDeployment
            ? undefined
            : "bg-emerald-600 text-white hover:bg-emerald-700"
        }
      >
        {isDeploying ? (
          <Loader2 className="mr-1.5 size-4 animate-spin" />
        ) : (
          <Rocket className="mr-1.5 size-4" />
        )}
        {hasLiveDeployment ? "Redeploy" : "Deploy"}
      </Button>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Redeploy Business</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a new deployment with the current agent
              configurations. The previous version will remain in history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <p className="text-sm text-muted-foreground">
            {agentCount} agent{agentCount !== 1 ? "s" : ""} will be deployed
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeploying}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeploy} disabled={isDeploying}>
              {isDeploying && (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              )}
              Deploy
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
