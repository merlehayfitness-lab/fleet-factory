"use client";

import { useState, useCallback } from "react";
import { ShieldOff, Snowflake, Ban, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { TypeToConfirmDialog } from "@/_components/type-to-confirm-dialog";
import { toast } from "sonner";
import {
  freezeAgentEmergency,
  revokeTools,
  disableAgentEmergency,
  restoreAgentEmergency,
} from "@/_actions/emergency-actions";

interface EmergencyControlsProps {
  agentId: string;
  businessId: string;
  agentName: string;
  agentStatus: string;
  onActionComplete: () => void;
}

/**
 * Emergency action buttons for an agent card.
 * Shows contextual buttons based on agent status:
 * - active/paused/error: Freeze, Revoke Tools, Disable
 * - frozen: Restore, Disable
 * - retired/provisioning: No actions available
 *
 * Freeze, Revoke Tools, Disable use TypeToConfirmDialog with mandatory reason.
 * Restore uses simple AlertDialog (not destructive).
 */
export function EmergencyControls({
  agentId,
  businessId,
  agentName,
  agentStatus,
  onActionComplete,
}: EmergencyControlsProps) {
  const [pendingAction, setPendingAction] = useState<
    "freeze" | "revoke" | "disable" | null
  >(null);
  const [showRestore, setShowRestore] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const handleFreeze = useCallback(
    async (reason: string) => {
      setIsPending(true);
      const result = await freezeAgentEmergency(agentId, businessId, reason);
      setIsPending(false);
      setPendingAction(null);

      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(`${agentName} has been frozen`);
        onActionComplete();
      }
    },
    [agentId, businessId, agentName, onActionComplete],
  );

  const handleRevoke = useCallback(
    async (reason: string) => {
      setIsPending(true);
      const result = await revokeTools(agentId, businessId, reason);
      setIsPending(false);
      setPendingAction(null);

      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(`Tool access revoked for ${agentName}`);
        onActionComplete();
      }
    },
    [agentId, businessId, agentName, onActionComplete],
  );

  const handleDisable = useCallback(
    async (reason: string) => {
      setIsPending(true);
      const result = await disableAgentEmergency(agentId, businessId, reason);
      setIsPending(false);
      setPendingAction(null);

      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(`${agentName} has been permanently disabled`);
        onActionComplete();
      }
    },
    [agentId, businessId, agentName, onActionComplete],
  );

  const handleRestore = useCallback(async () => {
    setIsPending(true);
    const result = await restoreAgentEmergency(agentId, businessId);
    setIsPending(false);
    setShowRestore(false);

    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success(`${agentName} has been restored to active`);
      onActionComplete();
    }
  }, [agentId, businessId, agentName, onActionComplete]);

  // No actions for retired or provisioning agents
  if (agentStatus === "retired" || agentStatus === "provisioning") {
    return null;
  }

  const canFreeze =
    agentStatus === "active" ||
    agentStatus === "paused" ||
    agentStatus === "error";
  const canRestore = agentStatus === "frozen";

  return (
    <>
      <div className="flex items-center gap-1.5 flex-wrap">
        {canFreeze && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setPendingAction("freeze")}
            className="gap-1 text-xs h-7"
          >
            <Snowflake className="size-3" />
            Freeze
          </Button>
        )}

        {canFreeze && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPendingAction("revoke")}
            className="gap-1 text-xs h-7 text-orange-600 border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20"
          >
            <ShieldOff className="size-3" />
            Revoke Tools
          </Button>
        )}

        {(canFreeze || canRestore) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPendingAction("disable")}
            className="gap-1 text-xs h-7 text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <Ban className="size-3" />
            Disable
          </Button>
        )}

        {canRestore && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRestore(true)}
            className="gap-1 text-xs h-7 text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
          >
            <RotateCcw className="size-3" />
            Restore
          </Button>
        )}
      </div>

      {/* Freeze dialog */}
      <TypeToConfirmDialog
        open={pendingAction === "freeze"}
        onOpenChange={(open) => !open && setPendingAction(null)}
        title="Freeze Agent"
        description={`This will immediately freeze ${agentName}. The agent will stop all operations and cannot process tasks until restored.`}
        confirmPhrase={agentName}
        actionLabel="Freeze Agent"
        variant="destructive"
        onConfirm={handleFreeze}
        isPending={isPending}
      />

      {/* Revoke tools dialog */}
      <TypeToConfirmDialog
        open={pendingAction === "revoke"}
        onOpenChange={(open) => !open && setPendingAction(null)}
        title="Revoke Tool Access"
        description={`This will remove all tool access for ${agentName}. The agent will not be able to execute any tools until access is manually restored.`}
        confirmPhrase="REVOKE"
        actionLabel="Revoke Tool Access"
        variant="destructive"
        onConfirm={handleRevoke}
        isPending={isPending}
      />

      {/* Disable dialog */}
      <TypeToConfirmDialog
        open={pendingAction === "disable"}
        onOpenChange={(open) => !open && setPendingAction(null)}
        title="Disable Agent"
        description={`This will permanently disable ${agentName} by setting it to retired status. This action cannot be undone.`}
        confirmPhrase={agentName}
        actionLabel="Disable Agent"
        variant="destructive"
        onConfirm={handleDisable}
        isPending={isPending}
      />

      {/* Restore dialog (simple AlertDialog, not destructive) */}
      <AlertDialog open={showRestore} onOpenChange={setShowRestore}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Agent</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore {agentName} from frozen to active status. The
              agent will resume normal operations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestore}
              disabled={isPending}
            >
              {isPending ? "Restoring..." : "Restore Agent"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
