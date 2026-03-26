"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { CheckSquare, XSquare, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApprovalCard } from "@/_components/approval-card";
import {
  getApprovalsAction,
  bulkApproveAction,
  bulkRejectAction,
} from "@/_actions/approval-actions";

type LoadingState = "idle" | "loading" | "error";

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

interface ApprovalsListProps {
  approvals: Approval[];
  businessId: string;
}

/**
 * Approval list with checkbox selection, bulk actions, and near-real-time polling.
 * Renders ApprovalCard for each approval with expandable reasoning.
 */
export function ApprovalsList({
  approvals: initialApprovals,
  businessId,
}: ApprovalsListProps) {
  const [approvals, setApprovals] = useState<Approval[]>(initialApprovals);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [loadingState, setLoadingState] = useState<LoadingState>("idle");
  const [confirmReject, setConfirmReject] = useState(false);

  // Polling: refresh approvals every 10 seconds
  const refreshApprovals = useCallback(async () => {
    setLoadingState("loading");
    const result = await getApprovalsAction(businessId);
    if (result.approvals) {
      setApprovals(result.approvals as Approval[]);
      setLoadingState("idle");
    } else {
      setLoadingState("error");
    }
  }, [businessId]);

  useEffect(() => {
    const interval = setInterval(refreshApprovals, 10_000);
    return () => clearInterval(interval);
  }, [refreshApprovals]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAll() {
    const pendingIds = approvals
      .filter((a) => a.status === "pending")
      .map((a) => a.id);
    setSelected(new Set(pendingIds));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function handleBulkApprove() {
    setBulkLoading(true);
    const ids = Array.from(selected);
    const result = await bulkApproveAction(ids, businessId);
    setBulkLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`${ids.length} action(s) approved`);
      setSelected(new Set());
      await refreshApprovals();
    }
  }

  async function handleBulkReject() {
    if (!confirmReject) {
      setConfirmReject(true);
      return;
    }
    setBulkLoading(true);
    setConfirmReject(false);
    const ids = Array.from(selected);
    const result = await bulkRejectAction(ids, businessId);
    setBulkLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`${ids.length} action(s) rejected`);
      setSelected(new Set());
      await refreshApprovals();
    }
  }

  const pendingCount = approvals.filter((a) => a.status === "pending").length;

  if (approvals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
        <Shield className="mb-2 size-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          No pending approvals. All agent actions are running smoothly.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Loading indicator */}
      {loadingState === "loading" && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          Refreshing...
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
          <span className="text-sm font-medium">
            {selected.size} selected
          </span>
          <Button
            size="sm"
            disabled={bulkLoading}
            onClick={handleBulkApprove}
          >
            {bulkLoading ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <CheckSquare className="mr-1.5 size-3.5" />
            )}
            Approve Selected
          </Button>
          <Button
            variant={confirmReject ? "destructive" : "outline"}
            size="sm"
            disabled={bulkLoading}
            onClick={handleBulkReject}
          >
            <XSquare className="mr-1.5 size-3.5" />
            {confirmReject ? "Confirm Reject?" : "Reject Selected"}
          </Button>
          {confirmReject && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmReject(false)}
            >
              Cancel
            </Button>
          )}
          <div className="flex-1" />
          {pendingCount > 0 && selected.size < pendingCount && (
            <Button variant="ghost" size="sm" onClick={selectAll}>
              Select all pending ({pendingCount})
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={clearSelection}>
            Clear
          </Button>
        </div>
      )}

      {/* Approval cards */}
      <div className="space-y-3">
        {approvals.map((approval) => (
          <ApprovalCard
            key={approval.id}
            approval={approval}
            selected={selected.has(approval.id)}
            onSelect={toggleSelect}
            onUpdate={refreshApprovals}
          />
        ))}
      </div>
    </div>
  );
}
