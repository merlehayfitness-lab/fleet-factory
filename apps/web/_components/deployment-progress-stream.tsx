"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Check, X, Loader2, Circle, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { VpsDeployProgressEvent } from "@agency-factory/core";

interface DeploymentProgressStreamProps {
  deploymentId: string;
  vpsWsUrl: string | null;
  isActive: boolean;
}

interface PhaseEntry {
  name: string;
  status: "pending" | "in_progress" | "complete" | "error";
  message: string;
  details: string[];
  agentStatuses: Array<{ agentId: string; message: string; status: string }>;
}

/**
 * Real-time deployment progress stream via WebSocket.
 *
 * Connects to VPS WebSocket for live deployment events with a CI/CD-like
 * vertical stepper display. Falls back to polling when WebSocket unavailable.
 * Shows a static message when VPS is not configured.
 */
export function DeploymentProgressStream({
  deploymentId,
  vpsWsUrl,
  isActive,
}: DeploymentProgressStreamProps) {
  const [phases, setPhases] = useState<PhaseEntry[]>([]);
  const [expandedPhase, setExpandedPhase] = useState<number | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected" | "error">(
    "disconnected",
  );
  const [finalMessage, setFinalMessage] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const handleEvent = useCallback((event: VpsDeployProgressEvent) => {
    switch (event.type) {
      case "phase": {
        setPhases((prev) => {
          // Mark previous in_progress phases as complete
          const updated = prev.map((p) =>
            p.status === "in_progress" ? { ...p, status: "complete" as const } : p,
          );
          // Add new phase
          return [
            ...updated,
            {
              name: event.phase ?? "Unknown",
              status: "in_progress" as const,
              message: event.message,
              details: [],
              agentStatuses: [],
            },
          ];
        });
        break;
      }
      case "detail": {
        setPhases((prev) => {
          const last = prev.length - 1;
          if (last < 0) return prev;
          const updated = [...prev];
          updated[last] = {
            ...updated[last],
            details: [...updated[last].details, event.message],
          };
          return updated;
        });
        break;
      }
      case "agent_status": {
        setPhases((prev) => {
          const last = prev.length - 1;
          if (last < 0) return prev;
          const updated = [...prev];
          updated[last] = {
            ...updated[last],
            agentStatuses: [
              ...updated[last].agentStatuses,
              {
                agentId: event.agentId ?? "unknown",
                message: event.message,
                status: event.message.toLowerCase().includes("fail") ? "error" : "ok",
              },
            ],
          };
          return updated;
        });
        break;
      }
      case "complete": {
        setPhases((prev) =>
          prev.map((p) => (p.status === "in_progress" ? { ...p, status: "complete" as const } : p)),
        );
        setFinalMessage(event.message);
        break;
      }
      case "error": {
        setPhases((prev) =>
          prev.map((p) => (p.status === "in_progress" ? { ...p, status: "error" as const, message: event.message } : p)),
        );
        setFinalMessage(event.message);
        break;
      }
    }
  }, []);

  // WebSocket connection
  useEffect(() => {
    if (!isActive || !vpsWsUrl) return;

    setConnectionStatus("connecting");

    try {
      const ws = new WebSocket(vpsWsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus("connected");
      };

      ws.onmessage = (msgEvent) => {
        try {
          const data = JSON.parse(msgEvent.data) as VpsDeployProgressEvent;
          handleEvent(data);
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onerror = () => {
        setConnectionStatus("error");
      };

      ws.onclose = () => {
        setConnectionStatus("disconnected");
      };

      return () => {
        ws.close();
        wsRef.current = null;
      };
    } catch {
      setConnectionStatus("error");
    }
  }, [isActive, vpsWsUrl, handleEvent]);

  // If VPS not configured, show static message
  if (!vpsWsUrl) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6 text-sm text-muted-foreground">
          Local deployment -- no live progress available
        </CardContent>
      </Card>
    );
  }

  // If not active, show nothing
  if (!isActive && phases.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Deployment Progress</CardTitle>
          {connectionStatus === "connected" && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          )}
          {connectionStatus === "connecting" && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Connecting...
            </span>
          )}
          {connectionStatus === "error" && (
            <span className="text-xs text-amber-600">WebSocket unavailable</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {phases.length === 0 && isActive && (
          <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Waiting for deployment events...
          </div>
        )}

        {phases.map((phase, idx) => {
          const isExpanded = expandedPhase === idx;
          const hasDetails = phase.details.length > 0 || phase.agentStatuses.length > 0;

          return (
            <div key={`${phase.name}-${idx}`} className="relative">
              {/* Vertical line connector */}
              {idx < phases.length - 1 && (
                <div className="absolute left-[11px] top-7 h-[calc(100%-12px)] w-px bg-border" />
              )}

              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors",
                  hasDetails && "hover:bg-muted/50 cursor-pointer",
                  !hasDetails && "cursor-default",
                )}
                onClick={() => hasDetails && setExpandedPhase(isExpanded ? null : idx)}
              >
                {/* Phase icon */}
                {phase.status === "complete" ? (
                  <Check className="size-[22px] shrink-0 rounded-full bg-emerald-500/10 p-1 text-emerald-600" />
                ) : phase.status === "error" ? (
                  <X className="size-[22px] shrink-0 rounded-full bg-red-500/10 p-1 text-red-600" />
                ) : phase.status === "in_progress" ? (
                  <Loader2 className="size-[22px] shrink-0 animate-spin text-primary p-0.5" />
                ) : (
                  <Circle className="size-[22px] shrink-0 text-muted-foreground/30 p-0.5" />
                )}

                <span
                  className={cn(
                    "flex-1 font-medium",
                    phase.status === "pending" && "text-muted-foreground/50",
                  )}
                >
                  {phase.name}
                </span>

                {hasDetails && (
                  <span className="text-muted-foreground">
                    {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  </span>
                )}
              </button>

              {/* Expanded details */}
              {isExpanded && hasDetails && (
                <div className="ml-9 space-y-1 pb-2">
                  {phase.details.map((detail, dIdx) => (
                    <p key={dIdx} className="text-xs text-muted-foreground">
                      {detail}
                    </p>
                  ))}
                  {phase.agentStatuses.map((agent, aIdx) => (
                    <div
                      key={aIdx}
                      className={cn(
                        "flex items-center gap-2 text-xs",
                        agent.status === "error" ? "text-red-600" : "text-muted-foreground",
                      )}
                    >
                      {agent.status === "error" ? (
                        <X className="size-3" />
                      ) : (
                        <Check className="size-3 text-emerald-500" />
                      )}
                      <span className="font-mono">{agent.agentId}</span>
                      <span>{agent.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Final message */}
        {finalMessage && (
          <div className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {finalMessage}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
