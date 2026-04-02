"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getModelFriendlyName } from "@fleet-factory/core";
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
import type { OrgChartNode } from "@/_components/agent-tree-view";

interface AgentTreeSidebarProps {
  selectedNode: OrgChartNode | null;
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
  selectedNode,
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
      if (!selectedNode || selectedNode.type === "root") return;
      setLoading(action);
      try {
        const fns = { freeze: freezeAgent, pause: pauseAgent, resume: resumeAgent };
        const result = await fns[action](selectedNode.id, businessId);
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
    [selectedNode, businessId, onClose, router],
  );

  if (!isOpen || !selectedNode) return null;

  const isAgent = selectedNode.type === "lead" || selectedNode.type === "sub-agent";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/10 backdrop-blur-xs"
        onClick={onClose}
      />
      <div className="relative z-10 flex w-full max-w-sm flex-col bg-popover shadow-lg ring-1 ring-foreground/10">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-lg font-semibold truncate">{selectedNode.name}</h3>
          <button
            onClick={onClose}
            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {selectedNode.type === "root" && (
            <>
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase text-muted-foreground">Type</p>
                <span className="inline-block rounded-full bg-foreground/10 px-2.5 py-0.5 text-xs font-medium">
                  Organization Root
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase text-muted-foreground">Direct Reports</p>
                <p className="text-sm">
                  {selectedNode.children.length}{" "}
                  {selectedNode.children.length === 1 ? "agent" : "agents"}
                </p>
              </div>
            </>
          )}

          {isAgent && (
            <>
              {/* Status */}
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase text-muted-foreground">Status</p>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "size-2.5 rounded-full",
                      STATUS_COLORS[selectedNode.status] ?? "bg-muted-foreground",
                    )}
                  />
                  <span className="text-sm capitalize">{selectedNode.status}</span>
                </div>
              </div>

              {/* Role */}
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase text-muted-foreground">Role</p>
                <p className="text-sm">{selectedNode.role ?? "No role defined"}</p>
              </div>

              {/* Department */}
              {selectedNode.departmentName && (
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase text-muted-foreground">Department</p>
                  <span className="inline-block rounded-full bg-foreground/10 px-2.5 py-0.5 text-xs font-medium capitalize">
                    {selectedNode.departmentName}
                  </span>
                </div>
              )}

              {/* Model */}
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase text-muted-foreground">Model</p>
                <p className="text-sm">
                  {getModelFriendlyName(
                    (selectedNode.model_profile as { model?: string })?.model ?? "",
                  ) || "Default"}
                </p>
              </div>

              {/* Skills */}
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase text-muted-foreground">Skills</p>
                <p className="text-sm">
                  {selectedNode.skill_count} {selectedNode.skill_count === 1 ? "skill" : "skills"} assigned
                </p>
              </div>

              {/* Sub-agents count */}
              {selectedNode.children.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase text-muted-foreground">Sub-agents</p>
                  <p className="text-sm">
                    {selectedNode.children.length}{" "}
                    {selectedNode.children.length === 1 ? "sub-agent" : "sub-agents"}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer with action buttons */}
        {isAgent && (
          <div className="border-t px-4 py-3 flex flex-wrap gap-2">
            {selectedNode.status === "active" && (
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
            {selectedNode.status === "paused" && (
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
            {selectedNode.status === "frozen" && (
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
                router.push(`/businesses/${businessId}/agents/${selectedNode.id}`)
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
