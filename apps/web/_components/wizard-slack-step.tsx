"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export interface AgentSlackTokens {
  agentName: string;
  department: string;
  botToken: string;
  appToken: string;
}

export interface SlackTokens {
  teamId: string;
  agents: AgentSlackTokens[];
}

interface Props {
  slackTokens: SlackTokens;
  onSlackTokensChange: (tokens: SlackTokens) => void;
  selectedAgentNames: string[];
}

export function WizardSlackStep({ slackTokens, onSlackTokensChange, selectedAgentNames }: Props) {
  const [showTokens, setShowTokens] = useState(false);

  // Ensure we have entries for all selected agents
  const agents = selectedAgentNames.map((name) => {
    const existing = slackTokens.agents.find((a) => a.agentName === name);
    return existing ?? { agentName: name, department: "", botToken: "", appToken: "" };
  });

  function updateAgent(agentName: string, field: "botToken" | "appToken", value: string) {
    const updated = agents.map((a) =>
      a.agentName === agentName ? { ...a, [field]: value } : a,
    );
    onSlackTokensChange({ ...slackTokens, agents: updated });
  }

  function updateTeamId(value: string) {
    onSlackTokensChange({ ...slackTokens, teamId: value, agents });
  }

  const hasTeamId = slackTokens.teamId.startsWith("T") && slackTokens.teamId.length > 5;
  const ceoAgent = agents[0]; // CEO is always first
  const hasCeoTokens = ceoAgent && ceoAgent.botToken.startsWith("xoxb-") && ceoAgent.appToken.startsWith("xapp-");

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Each agent needs its own Slack app for a distinct bot identity.
        Create one Slack app per agent at api.slack.com/apps using the manifest below.
      </p>

      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-medium">Slack App Manifest (click to expand)</summary>
        <p className="mt-2 text-xs text-muted-foreground">
          Change the <code>name</code> and <code>display_name</code> for each agent.
        </p>
        <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-[10px] font-mono">
{JSON.stringify({
  display_information: { name: "AGENT_NAME_HERE", description: "AI Agent" },
  features: {
    bot_user: { display_name: "AGENT_NAME_HERE", always_online: true },
    app_home: { messages_tab_enabled: true, messages_tab_read_only_enabled: false },
  },
  oauth_config: {
    scopes: {
      bot: [
        "chat:write", "channels:history", "channels:read", "groups:history",
        "im:history", "im:read", "im:write", "mpim:history", "mpim:read",
        "mpim:write", "users:read", "app_mentions:read", "reactions:read",
        "reactions:write", "files:read", "files:write",
      ],
    },
  },
  settings: {
    socket_mode_enabled: true,
    event_subscriptions: {
      bot_events: ["app_mention", "message.channels", "message.groups", "message.im", "message.mpim"],
    },
  },
}, null, 2)}
        </pre>
      </details>

      {/* Team ID */}
      <div className="rounded-lg border p-4">
        <div className="mb-2 flex items-center gap-2">
          <Label htmlFor="slack-team-id" className="font-medium">Slack Team ID</Label>
          <Badge variant="default" className="text-[10px]">Required</Badge>
          {hasTeamId && (
            <Badge variant="secondary" className="text-[10px] text-green-600">
              <span className="mr-0.5">&#10003;</span> Valid
            </Badge>
          )}
        </div>
        <p className="mb-2 text-xs text-muted-foreground">
          Find in Slack URL: app.slack.com/client/<strong>T...</strong>/...
        </p>
        <Input
          id="slack-team-id"
          placeholder="T0ABC123..."
          value={slackTokens.teamId}
          onChange={(e) => updateTeamId(e.target.value)}
          className="font-mono text-xs"
        />
      </div>

      {/* Per-agent tokens */}
      <div className="space-y-3">
        {agents.map((agent, idx) => {
          const hasBoth = agent.botToken.startsWith("xoxb-") && agent.appToken.startsWith("xapp-");
          const isCeo = idx === 0;
          return (
            <div key={agent.agentName} className="rounded-lg border p-4">
              <div className="mb-2 flex items-center gap-2">
                <Label className="font-medium">{agent.agentName}</Label>
                {isCeo && <Badge variant="default" className="text-[10px]">Required</Badge>}
                {!isCeo && <Badge variant="outline" className="text-[10px]">CEO will deploy</Badge>}
                {hasBoth && (
                  <Badge variant="secondary" className="text-[10px] text-green-600">
                    <span className="mr-0.5">&#10003;</span> Ready
                  </Badge>
                )}
              </div>
              <div className="space-y-2">
                <Input
                  type={showTokens ? "text" : "password"}
                  placeholder="Bot Token (xoxb-...)"
                  value={agent.botToken}
                  onChange={(e) => updateAgent(agent.agentName, "botToken", e.target.value)}
                  className="font-mono text-xs"
                />
                <Input
                  type={showTokens ? "text" : "password"}
                  placeholder="App Token (xapp-...)"
                  value={agent.appToken}
                  onChange={(e) => updateAgent(agent.agentName, "appToken", e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setShowTokens(!showTokens)}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        {showTokens ? "Hide tokens" : "Show tokens"}
      </button>

      {!hasCeoTokens && (
        <p className="text-sm text-amber-600">
          At minimum, the CEO agent needs Slack tokens to deploy.
        </p>
      )}
      {hasCeoTokens && !hasTeamId && (
        <p className="text-sm text-amber-600">
          Please enter your Slack Team ID.
        </p>
      )}
      {hasCeoTokens && hasTeamId && (
        <p className="text-sm text-green-600">
          CEO will deploy and configure the other agents automatically.
        </p>
      )}
    </div>
  );
}
