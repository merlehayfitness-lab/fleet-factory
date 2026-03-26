"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface TypeToConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmPhrase: string;
  actionLabel: string;
  variant: "destructive" | "default";
  onConfirm: (reason: string) => Promise<void>;
  isPending?: boolean;
}

/**
 * A reusable type-to-confirm dialog requiring the user to:
 * 1. Type a specific confirmation phrase (case-insensitive match)
 * 2. Provide a mandatory reason
 *
 * The confirm button stays disabled until both conditions are met.
 * Used for emergency actions like freeze, revoke tools, disable, and tenant kill switch.
 */
export function TypeToConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmPhrase,
  actionLabel,
  variant,
  onConfirm,
  isPending = false,
}: TypeToConfirmDialogProps) {
  const [confirmInput, setConfirmInput] = useState("");
  const [reason, setReason] = useState("");

  // Reset fields when dialog closes
  useEffect(() => {
    if (!open) {
      setConfirmInput("");
      setReason("");
    }
  }, [open]);

  const isConfirmMatch =
    confirmInput.toLowerCase() === confirmPhrase.toLowerCase();
  const isReasonFilled = reason.trim().length > 0;
  const canConfirm = isConfirmMatch && isReasonFilled && !isPending;

  const handleConfirm = useCallback(async () => {
    if (!canConfirm) return;
    await onConfirm(reason.trim());
  }, [canConfirm, onConfirm, reason]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={!isPending} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="confirm-input">
              Type &quot;{confirmPhrase}&quot; to confirm
            </Label>
            <Input
              id="confirm-input"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={confirmPhrase}
              disabled={isPending}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason-input">Reason (required)</Label>
            <Textarea
              id="reason-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this action is needed..."
              disabled={isPending}
              className="min-h-20"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant={variant}
            disabled={!canConfirm}
            onClick={handleConfirm}
          >
            {isPending ? "Processing..." : actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
