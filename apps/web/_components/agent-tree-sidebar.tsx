"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getModelFriendlyName } from "@agency-factory/core";
import {
  freezeAgent,
  pauseAgent,
  resumeAgent,
} from "@/_actions/agent-actions";
import { toast } from "sonner";
import {
  X,
  Settings,
  Pause,
  Play,
  Snowflake,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentTreeSidebarProps {
  selectedAgent: {
    id: string;
    name: string;
    status: string;
    role: string | null;
    model_profile: Record<string, unknown>;
    skill_count: number;
  } | null;
  selectedDepartment: {
    id: string;
    name: string;
    type: string;
    agentCount: number;
  } | null;
  businessId: string;
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500",
  paused: "bg-amber-500",
  frozen: "bg-amber-500",
  error: "bg-red-500",
  retired: "bg-red-500",
  provisioning: "bg-blue-500",
};

export function AgentTreeSidebar({
  selectedAgent,
  selectedDepartment,
  businessId,
  isOpen,
  onClose,
}: AgentTreeSidebarProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleAction = useCallback(
    async (action: "freeze" | "pause" | "resume") => {
      if (!selectedAgent) return;
      setLoading(action);
      try {
        const fns = { freeze: freezeAgent, pause: pauseAgent, resume: resumeAgent };
        const result = await fns[action](selectedAgent.id, businessId);
        if (result?.error) {
          toast.error(result.error);
        } else {
          toast.success(`Agent ${action}d successfully`);
          router.refresh();
        }
        onClose();
      } finally {
        setLoading(null);
      }
    },
    [selectedAgent, businessId, onClose, router],
  );

  if (!isOpen) return null;

  const name = selectedAgent?.name ?? selectedDepartment?.name ?? "";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/10 backdrop-blur-xs"
        onClick={onClose}
      />
      <div className="relative z-10 flex w-full max-w-sm flex-col bg-popover shadow-lg ring-1 ring-foreground/10">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-lg font-semibold truncate">{name}</h3>
          <button
            onClick={onClose}
            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {selectedAgent && (
            <>
              {/* Status */}
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase text-muted-foreground">Status</p>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "size-2.5 rounded-full",
                      STATUS_COLORS[selectedAgent.status] ?? "bg-muted-foreground",
                    )}
                  />
                  <span className="text-sm capitalize">{selectedAgent.status}</span>
                </div>
              </div>

              {/* Role */}
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase text-muted-foreground">Role</p>
                <p className="text-sm">{selectedAgent.role ?? "No role defined"}</p>
              </div>

              {/* Model */}
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase text-muted-foreground">Model</p>
                <p className="text-sm">
                  {getModelFriendlyName(
                    (selectedAgent.model_profile as { model?: string })?.model ?? "",
                  ) || "Default"}
                </p>
              </div>

              {/* Skills */}
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase text-muted-foreground">Skills</p>
                <p className="text-sm">
                  {selectedAgent.skill_count} {selectedAgent.skill_count === 1 ? "skill" : "skills"} assigned
                </p>
              </div>
            </>
          )}

          {selectedDepartment && (
            <>
              {/* Type */}
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase text-muted-foreground">Type</p>
                <span className="inline-block rounded-full bg-foreground/10 px-2.5 py-0.5 text-xs font-medium capitalize">
                  {selectedDepartment.type}
                </span>
              </div>

              {/* Agent count */}
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase text-muted-foreground">Agents</p>
                <p className="text-sm">
                  {selectedDepartment.agentCount}{" "}
                  {selectedDepartment.agentCount === 1 ? "agent" : "agents"} in this department
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer with action buttons */}
        {selectedAgent && (
          <div className="border-t px-4 py-3 flex flex-wrap gap-2">
            {selectedAgent.status === "active" && (
              <>
                <button
                  onClick={() => handleAction("pause")}
                  disabled={loading !== null}
                  className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
                >
                  <Pause className="size-3.5" />
                  {loading === "pause" ? "Pausing..." : "Pause"}
                </button>
                <button
                  onClick={() => handleAction("freeze")}
                  disabled={loading !== null}
                  className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
                >
                  <Snowflake className="size-3.5" />
                  {loading === "freeze" ? "Freezing..." : "Freeze"}
                </button>
              </>
            )}
            {selectedAgent.status === "paused" && (
              <>
                <button
                  onClick={() => handleAction("resume")}
                  disabled={loading !== null}
                  className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
                >
                  <Play className="size-3.5" />
                  {loading === "resume" ? "Resuming..." : "Resume"}
                </button>
                <button
                  onClick={() => handleAction("freeze")}
                  disabled={loading !== null}
                  className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
                >
                  <Snowflake className="size-3.5" />
                  {loading === "freeze" ? "Freezing..." : "Freeze"}
                </button>
              </>
            )}
            {selectedAgent.status === "frozen" && (
              <button
                onClick={() => handleAction("resume")}
                disabled={loading !== null}
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
              >
                <Play className="size-3.5" />
                {loading === "resume" ? "Resuming..." : "Resume"}
              </button>
            )}
            <button
              onClick={() =>
                router.push(`/businesses/${businessId}/agents/${selectedAgent.id}`)
              }
              className="inline-flex items-center gap-1.5 rounded-md border bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
            >
              <Settings className="size-3.5" />
              Edit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
