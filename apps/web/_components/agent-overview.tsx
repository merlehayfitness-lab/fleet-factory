"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Pause, Play, Snowflake, Trash2, AlertTriangle, Users, ArrowUpRight, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/_components/status-badge";
import { FreezeDialog } from "@/_components/freeze-dialog";
import { RetireDialog } from "@/_components/retire-dialog";
import { pauseAgent, resumeAgent, updateAgentNameAction } from "@/_actions/agent-actions";
import type { AgentStatus } from "@agency-factory/core";
import { getValidTransitions, getModelFriendlyName } from "@agency-factory/core";

interface Agent {
  id: string;
  name: string;
  status: string;
  role: string | null;
  parent_agent_id: string | null;
  model_profile: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  departments: { id: string; name: string; type: string } | null;
  agent_templates: { id: string; name: string } | null;
}

interface RelatedAgent {
  id: string;
  name: string;
  status: string;
  role: string | null;
}

interface AgentOverviewProps {
  agent: Agent;
  businessId: string;
  parentAgent?: RelatedAgent;
  childAgents?: RelatedAgent[];
}

/**
 * Overview tab for the agent detail page.
 *
 * Displays hero status badge, agent metadata, role, parent/child
 * hierarchy relationships, lifecycle control buttons filtered by
 * valid transitions, and a frozen banner when applicable.
 */
export function AgentOverview({ agent, businessId, parentAgent, childAgents }: AgentOverviewProps) {
  const [freezeOpen, setFreezeOpen] = useState(false);
  const [retireOpen, setRetireOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(agent.name);
  const [savingName, setSavingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const validTransitions = getValidTransitions(agent.status as AgentStatus);

  async function handleSaveName() {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === agent.name) {
      setIsEditingName(false);
      setEditName(agent.name);
      return;
    }
    setSavingName(true);
    const result = await updateAgentNameAction(agent.id, businessId, trimmed);
    setSavingName(false);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success("Agent name updated");
      setIsEditingName(false);
    }
  }

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
            {agent.role && (
              <Badge variant="outline" className="text-sm">
                {agent.role}
              </Badge>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {/* Editable agent name */}
            <div className="sm:col-span-2">
              <p className="text-xs font-medium text-muted-foreground">
                Agent Name
              </p>
              {isEditingName ? (
                <div className="mt-1 flex items-center gap-2">
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveName();
                      if (e.key === "Escape") {
                        setIsEditingName(false);
                        setEditName(agent.name);
                      }
                    }}
                    autoFocus
                    maxLength={50}
                    className="h-8 w-full max-w-xs rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={savingName}
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={savingName}
                    className="inline-flex size-7 items-center justify-center rounded-md text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 disabled:opacity-50"
                  >
                    <Check className="size-4" />
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingName(false);
                      setEditName(agent.name);
                    }}
                    className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-sm font-medium">{agent.name}</p>
                  <button
                    onClick={() => {
                      setIsEditingName(true);
                      setEditName(agent.name);
                    }}
                    className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                    title="Edit agent name"
                  >
                    <Pencil className="size-3" />
                  </button>
                </div>
              )}
            </div>

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
                Model
              </p>
              <p className="text-sm">
                {getModelFriendlyName(
                  (agent.model_profile?.model as string) ?? "claude-sonnet-4-6",
                )}
              </p>
            </div>

            {agent.role && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Role
                </p>
                <p className="text-sm">{agent.role}</p>
              </div>
            )}

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

      {/* Reports to (parent agent) */}
      {parentAgent && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowUpRight className="size-4" />
              Reports To
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href={`/businesses/${businessId}/agents/${parentAgent.id}`}
              className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted"
            >
              <div className="flex-1">
                <p className="text-sm font-medium">{parentAgent.name}</p>
                {parentAgent.role && (
                  <p className="text-xs text-muted-foreground">{parentAgent.role}</p>
                )}
              </div>
              <StatusBadge status={parentAgent.status} />
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Sub-Agents (child agents) */}
      {childAgents && childAgents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4" />
              Sub-Agents
              <Badge variant="secondary" className="ml-1">
                {childAgents.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {childAgents.map((child) => (
                <Link
                  key={child.id}
                  href={`/businesses/${businessId}/agents/${child.id}`}
                  className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">{child.name}</p>
                    {child.role && (
                      <p className="text-xs text-muted-foreground">{child.role}</p>
                    )}
                  </div>
                  <StatusBadge status={child.status} />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
