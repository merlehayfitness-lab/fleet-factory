"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreVertical, Eye, Pause, Play, Snowflake, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/_components/status-badge";
import { FreezeDialog } from "@/_components/freeze-dialog";
import { RetireDialog } from "@/_components/retire-dialog";
import { pauseAgent, resumeAgent } from "@/_actions/agent-actions";
import type { AgentStatus } from "@agency-factory/core";
import { getValidTransitions } from "@agency-factory/core";

interface AgentCardProps {
  agent: {
    id: string;
    name: string;
    status: string;
    system_prompt: string;
    tool_profile: Record<string, unknown>;
    model_profile: Record<string, unknown>;
    created_at: string;
    departments: { id: string; name: string; type: string } | null;
    agent_templates: { id: string; name: string } | null;
  };
  businessId: string;
}

/**
 * Single agent card with status badge, template info, and kebab menu.
 *
 * Uses getValidTransitions from the lifecycle state machine to determine
 * which actions appear in the kebab menu for the agent's current status.
 */
export function AgentCard({ agent, businessId }: AgentCardProps) {
  const [freezeOpen, setFreezeOpen] = useState(false);
  const [retireOpen, setRetireOpen] = useState(false);

  const validTransitions = getValidTransitions(agent.status as AgentStatus);

  const modelName =
    agent.model_profile && Object.keys(agent.model_profile).length > 0
      ? (agent.model_profile as Record<string, string>).model ??
        (agent.model_profile as Record<string, string>).name ??
        Object.values(agent.model_profile)[0]
      : null;

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
    <>
      <Card
        className={cn(
          "transition-colors",
          agent.status === "frozen" && "opacity-50 grayscale",
          agent.status === "retired" && "opacity-60",
        )}
      >
        <CardHeader>
          <CardTitle>
            <Link
              href={`/businesses/${businessId}/agents/${agent.id}`}
              className="hover:underline"
            >
              {agent.name}
            </Link>
          </CardTitle>
          <CardAction>
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button variant="ghost" size="icon-xs">
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Link
                    href={`/businesses/${businessId}/agents/${agent.id}`}
                    className="flex items-center gap-1.5"
                  >
                    <Eye className="size-3.5" />
                    View Details
                  </Link>
                </DropdownMenuItem>

                {validTransitions.length > 0 && <DropdownMenuSeparator />}

                {validTransitions.includes("paused") && (
                  <DropdownMenuItem onClick={handlePause}>
                    <Pause className="size-3.5" />
                    Pause
                  </DropdownMenuItem>
                )}

                {validTransitions.includes("active") && (
                  <DropdownMenuItem onClick={handleResume}>
                    <Play className="size-3.5" />
                    Resume
                  </DropdownMenuItem>
                )}

                {validTransitions.includes("frozen") && (
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setFreezeOpen(true)}
                  >
                    <Snowflake className="size-3.5" />
                    Freeze
                  </DropdownMenuItem>
                )}

                {validTransitions.includes("retired") && (
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setRetireOpen(true)}
                  >
                    <Trash2 className="size-3.5" />
                    Retire
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-2">
          <StatusBadge status={agent.status} />

          {agent.agent_templates && (
            <p className="text-xs text-muted-foreground">
              Template: {agent.agent_templates.name}
            </p>
          )}

          {modelName && (
            <p className="font-mono text-xs text-muted-foreground">
              {String(modelName)}
            </p>
          )}
        </CardContent>
      </Card>

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
    </>
  );
}
