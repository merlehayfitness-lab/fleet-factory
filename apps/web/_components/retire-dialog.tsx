"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
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
import { retireAgent } from "@/_actions/agent-actions";

interface RetireDialogProps {
  agentId: string;
  businessId: string;
  agentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Type-to-confirm dialog for retiring an agent.
 *
 * Requires the user to type the exact agent name before the confirm
 * button becomes enabled. Retirement is permanent.
 */
export function RetireDialog({
  agentId,
  businessId,
  agentName,
  open,
  onOpenChange,
}: RetireDialogProps) {
  const [confirmation, setConfirmation] = useState("");
  const [isPending, setIsPending] = useState(false);

  const isConfirmed = confirmation === agentName;

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setConfirmation("");
    }
    onOpenChange(nextOpen);
  }

  async function handleRetire() {
    if (!isConfirmed) return;

    setIsPending(true);
    try {
      const result = await retireAgent(agentId, businessId);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(`${agentName} has been retired`);
        handleOpenChange(false);
      }
    } catch {
      toast.error("Failed to retire agent");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Retire Agent</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently decommission {agentName}. This action cannot
            be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="px-0 py-2">
          <label className="mb-1.5 block text-sm text-muted-foreground">
            Type &apos;{agentName}&apos; to confirm
          </label>
          <Input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder={agentName}
            disabled={isPending}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleRetire}
            disabled={!isConfirmed || isPending}
          >
            {isPending ? "Retiring..." : "Retire Agent"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
