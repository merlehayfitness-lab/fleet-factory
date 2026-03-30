"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/_components/status-badge";
import {
  approveActionHandler,
  rejectActionHandler,
  provideGuidanceAction,
} from "@/_actions/approval-actions";

interface Approval {
  id: string;
  business_id: string;
  task_id: string;
  agent_id: string;
  action_type: string;
  action_summary: string;
  agent_reasoning: string | null;
  risk_level: string;
  risk_explanation: string | null;
  status: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  retry_count: number;
  created_at: string;
  tasks: { title: string } | null;
  agents: { name: string } | null;
}

interface ApprovalCardProps {
  approval: Approval;
  selected: boolean;
  onSelect: (id: string) => void;
  onUpdate: () => void;
}

/**
 * Single approval row/card with expandable reasoning.
 * Supports approve/reject buttons, guidance input, and checkbox selection.
 */
export function ApprovalCard({
  approval,
  selected,
  onSelect,
  onUpdate,
}: ApprovalCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [guidance, setGuidance] = useState("");

  const isPending = approval.status === "pending";
  const needsGuidance = approval.status === "guidance_required";

  async function handleApprove() {
    setLoading(true);
    const result = await approveActionHandler(
      approval.id,
      approval.business_id,
    );
    setLoading(false);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Action approved");
      onUpdate();
    }
  }

  async function handleReject() {
    setLoading(true);
    const result = await rejectActionHandler(
      approval.id,
      approval.business_id,
    );
    setLoading(false);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Action rejected");
      onUpdate();
    }
  }

  async function handleGuidance() {
    if (!guidance.trim()) {
      toast.error("Please provide guidance");
      return;
    }
    setLoading(true);
    const result = await provideGuidanceAction(
      approval.id,
      approval.business_id,
      guidance,
    );
    setLoading(false);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Guidance sent");
      setGuidance("");
      onUpdate();
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      {/* Main row */}
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        {isPending && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onSelect(approval.id)}
            className="mt-1 size-4 rounded border-input"
          />
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-sm font-medium">{approval.action_summary}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <StatusBadge status={approval.risk_level} />
                <StatusBadge status={approval.status} />
                {approval.retry_count > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Attempt #{approval.retry_count + 1}
                  </span>
                )}
              </div>
              {approval.risk_explanation && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {approval.risk_explanation}
                </p>
              )}
            </div>

            {/* Expand toggle */}
            {approval.agent_reasoning && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <ChevronUp className="size-4" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
              </Button>
            )}
          </div>

          {/* Meta info */}
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>Agent: {approval.agents?.name ?? "Unknown"}</span>
            <span>Task: {approval.tasks?.title ?? "Unknown"}</span>
            <span>
              {new Date(approval.created_at).toLocaleDateString()}{" "}
              {new Date(approval.created_at).toLocaleTimeString()}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        {isPending && (
          <div className="flex flex-shrink-0 gap-1.5">
            <Button
              size="sm"
              disabled={loading}
              onClick={handleApprove}
            >
              {loading && <Loader2 className="mr-1 size-3 animate-spin" />}
              Approve
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={handleReject}
            >
              Reject
            </Button>
          </div>
        )}
      </div>

      {/* Expanded reasoning */}
      {expanded && approval.agent_reasoning && (
        <div className="mt-3 rounded-md bg-muted/50 p-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
            Agent Reasoning
          </p>
          <p className="text-sm whitespace-pre-wrap">
            {approval.agent_reasoning}
          </p>
        </div>
      )}

      {/* Guidance input for guidance_required status */}
      {needsGuidance && (
        <div className="mt-3 flex items-end gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Provide guidance to agent
            </label>
            <Input
              placeholder="Explain what the agent should do instead..."
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
            />
          </div>
          <Button
            size="sm"
            disabled={loading || !guidance.trim()}
            onClick={handleGuidance}
          >
            {loading ? (
              <Loader2 className="mr-1 size-3 animate-spin" />
            ) : (
              <MessageSquare className="mr-1 size-3" />
            )}
            Send
          </Button>
        </div>
      )}
    </div>
  );
}
