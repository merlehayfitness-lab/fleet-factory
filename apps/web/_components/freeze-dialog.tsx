"use client";

import { useState } from "react";
import { toast } from "sonner";
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
import { freezeAgent } from "@/_actions/agent-actions";

interface FreezeDialogProps {
  agentId: string;
  businessId: string;
  agentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Confirmation dialog for freezing an agent.
 *
 * Warns the user that freezing will immediately stop the agent
 * and revoke all tool access.
 */
export function FreezeDialog({
  agentId,
  businessId,
  agentName,
  open,
  onOpenChange,
}: FreezeDialogProps) {
  const [isPending, setIsPending] = useState(false);

  async function handleFreeze() {
    setIsPending(true);
    try {
      const result = await freezeAgent(agentId, businessId);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(`${agentName} has been frozen`);
        onOpenChange(false);
      }
    } catch {
      toast.error("Failed to freeze agent");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Freeze Agent</AlertDialogTitle>
          <AlertDialogDescription>
            This will immediately stop {agentName} and revoke all tool access.
            The agent will be unable to execute any tasks until unfrozen.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleFreeze}
            disabled={isPending}
          >
            {isPending ? "Freezing..." : "Freeze Agent"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
