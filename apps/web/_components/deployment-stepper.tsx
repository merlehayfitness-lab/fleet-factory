"use client";

import { Check, X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeploymentStatus } from "@agency-factory/core";

const STEPS = ["Queued", "Building", "Deploying", "Live"] as const;

/** Maps a deployment status to the index of the current/completed step */
function getStepIndex(status: DeploymentStatus): number {
  switch (status) {
    case "queued":
      return 0;
    case "building":
      return 1;
    case "deploying":
      return 2;
    case "live":
      return 3;
    case "failed":
      // Failed could happen at building or deploying stage.
      // We show the first non-queued stage as failed.
      return 2; // Default to deploying stage for display
    case "rolled_back":
      return 3;
    default:
      return 0;
  }
}

interface DeploymentStepperProps {
  status: DeploymentStatus;
}

/**
 * Horizontal stepper showing deployment progress through 4 stages.
 * Queued -> Building -> Deploying -> Live
 */
export function DeploymentStepper({ status }: DeploymentStepperProps) {
  const currentIndex = getStepIndex(status);
  const isFailed = status === "failed";
  const isRolledBack = status === "rolled_back";

  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, idx) => {
        const isCompleted =
          isFailed ? idx < currentIndex : idx <= currentIndex;
        const isCurrent = idx === currentIndex;
        const isActive = isCurrent && !isFailed && status !== "live" && !isRolledBack;
        const isFailedStep = isFailed && isCurrent;
        const isRolledBackStep = isRolledBack && idx === 3;
        const isFuture = isFailed ? idx >= currentIndex : idx > currentIndex;

        return (
          <div key={step} className="flex items-center">
            {/* Connector line (not before first step) */}
            {idx > 0 && (
              <div
                className={cn(
                  "h-0.5 w-8 sm:w-12",
                  isCompleted && !isFailedStep
                    ? "bg-emerald-500"
                    : isFailedStep
                      ? "bg-destructive"
                      : "bg-muted"
                )}
              />
            )}

            {/* Step circle + label */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border-2 text-xs font-medium transition-all",
                  isCompleted && !isFailedStep && !isRolledBackStep
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : isFailedStep
                        ? "border-destructive bg-destructive text-white"
                        : isRolledBackStep
                          ? "border-amber-500 bg-amber-500 text-white"
                          : "border-muted bg-muted text-muted-foreground"
                )}
              >
                {isCompleted && !isFailedStep && !isRolledBackStep && !isActive ? (
                  <Check className="size-4" />
                ) : isFailedStep ? (
                  <X className="size-4" />
                ) : isRolledBackStep ? (
                  <RotateCcw className="size-3.5" />
                ) : isActive ? (
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary-foreground opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-primary-foreground" />
                  </span>
                ) : (
                  <span className="size-2 rounded-full bg-muted-foreground/40" />
                )}
              </div>
              <span
                className={cn(
                  "text-xs font-medium",
                  isCompleted && !isFuture
                    ? "text-foreground"
                    : isActive
                      ? "text-primary"
                      : isFailedStep
                        ? "text-destructive"
                        : "text-muted-foreground"
                )}
              >
                {step}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
