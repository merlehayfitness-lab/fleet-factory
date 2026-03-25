"use client";

import { useState } from "react";
import { Pause, Play, Snowflake, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/_components/status-badge";
import { FreezeDialog } from "@/_components/freeze-dialog";
import { RetireDialog } from "@/_components/retire-dialog";
import { pauseAgent, resumeAgent } from "@/_actions/agent-actions";
import type { AgentStatus } from "@agency-factory/core";
import { getValidTransitions } from "@agency-factory/core";

interface Agent {
  id: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
  departments: { id: string; name: string; type: string } | null;
  agent_templates: { id: string; name: string } | null;
}

interface AgentOverviewProps {
  agent: Agent;
  businessId: string;
}

/**
 * Overview tab for the agent detail page.
 *
 * Displays hero status badge, agent metadata, lifecycle control buttons
 * filtered by valid transitions, and a frozen banner when applicable.
 */
export function AgentOverview({ agent, businessId }: AgentOverviewProps) {
  const [freezeOpen, setFreezeOpen] = useState(false);
  const [retireOpen, setRetireOpen] = useState(false);

  const validTransitions = getValidTransitions(agent.status as AgentStatus);

  async function handlePause() {
    const result = await pauseAgent(agent.id, businessId);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success(`${agent.name} paused`);
    }
  }

  async function handleResume() {
    const result = await resumeAgent(agent.id, businessId);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success(`${agent.name} resumed`);
    }
  }

  return (
    <div className="space-y-6 pt-4">
      {/* Frozen banner */}
      {agent.status === "frozen" && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-900/20 dark:text-amber-400">
          <AlertTriangle className="size-4 shrink-0" />
          This agent is frozen. All execution is stopped and tool access is
          revoked.
        </div>
      )}

      {/* Hero section */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center gap-3">
            <StatusBadge status={agent.status} className="text-sm px-3 py-1" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Department
              </p>
              <p className="text-sm">
                {agent.departments?.name ?? "Unassigned"}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Created from
              </p>
              <p className="text-sm">
                {agent.agent_templates?.name ?? "No template"}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Created
              </p>
              <p className="text-sm">
                {new Date(agent.created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Last updated
              </p>
              <p className="text-sm">
                {new Date(agent.updated_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lifecycle controls */}
      {validTransitions.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-medium">Lifecycle Controls</h3>
          <div className="flex flex-wrap gap-2">
            {validTransitions.includes("paused") && (
              <Button variant="secondary" onClick={handlePause}>
                <Pause className="size-4" data-icon="inline-start" />
                Pause
              </Button>
            )}

            {validTransitions.includes("active") && (
              <Button onClick={handleResume}>
                <Play className="size-4" data-icon="inline-start" />
                Resume
              </Button>
            )}

            {validTransitions.includes("frozen") && (
              <Button
                variant="destructive"
                onClick={() => setFreezeOpen(true)}
              >
                <Snowflake className="size-4" data-icon="inline-start" />
                Freeze
              </Button>
            )}

            {validTransitions.includes("retired") && (
              <Button
                variant="destructive"
                onClick={() => setRetireOpen(true)}
              >
                <Trash2 className="size-4" data-icon="inline-start" />
                Retire
              </Button>
            )}
          </div>
        </div>
      )}

      <FreezeDialog
        agentId={agent.id}
        businessId={businessId}
        agentName={agent.name}
        open={freezeOpen}
        onOpenChange={setFreezeOpen}
      />
      <RetireDialog
        agentId={agent.id}
        businessId={businessId}
        agentName={agent.name}
        open={retireOpen}
        onOpenChange={setRetireOpen}
      />
    </div>
  );
}
