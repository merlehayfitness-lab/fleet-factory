"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export interface SlackTokens {
  botToken: string;
  appToken: string;
  teamId: string;
}

interface Props {
  slackTokens: SlackTokens;
  onSlackTokensChange: (tokens: SlackTokens) => void;
}

export function WizardSlackStep({ slackTokens, onSlackTokensChange }: Props) {
  const [showTokens, setShowTokens] = useState(false);

  const hasBotToken = slackTokens.botToken.startsWith("xoxb-") && slackTokens.botToken.length > 20;
  const hasAppToken = slackTokens.appToken.startsWith("xapp-") && slackTokens.appToken.length > 20;
  const hasTeamId = slackTokens.teamId.startsWith("T") && slackTokens.teamId.length > 5;
  const isComplete = hasBotToken && hasAppToken && hasTeamId;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Connect a Slack workspace so your agents can communicate. Each agent
        will be @mentionable in Slack channels after deployment.
      </p>

      <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Quick Setup:</p>
        <ol className="list-decimal list-inside space-y-0.5">
          <li>Go to <strong>api.slack.com/apps</strong> → Create New App → From an app manifest</li>
          <li>Select your workspace and paste the manifest below</li>
          <li>After creating, go to <strong>Settings → Socket Mode</strong> → enable it → create an App Token</li>
          <li>Go to <strong>OAuth & Permissions</strong> → Install to Workspace → copy the Bot Token</li>
          <li>Find your Team ID in the workspace URL: <code className="rounded bg-muted px-1">app.slack.com/client/<strong>T...</strong>/...</code></li>
        </ol>
      </div>

      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-medium">Slack App Manifest (click to expand)</summary>
        <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-[10px] font-mono">
{JSON.stringify({
  display_information: { name: "Fleet Agent", description: "AI Agent Fleet" },
  features: {
    bot_user: { display_name: "Fleet Agent", always_online: true },
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

      <div className="space-y-3">
        <div className="rounded-lg border p-4">
          <div className="mb-2 flex items-center gap-2">
            <Label htmlFor="slack-bot-token" className="font-medium">Bot Token</Label>
            <Badge variant="default" className="text-[10px]">Required</Badge>
            {hasBotToken && (
              <Badge variant="secondary" className="text-[10px] text-green-600">
                <span className="mr-0.5">&#10003;</span> Valid
              </Badge>
            )}
          </div>
          <Input
            id="slack-bot-token"
            type={showTokens ? "text" : "password"}
            placeholder="xoxb-..."
            value={slackTokens.botToken}
            onChange={(e) => onSlackTokensChange({ ...slackTokens, botToken: e.target.value })}
            className="font-mono text-xs"
          />
        </div>

        <div className="rounded-lg border p-4">
          <div className="mb-2 flex items-center gap-2">
            <Label htmlFor="slack-app-token" className="font-medium">App Token (Socket Mode)</Label>
            <Badge variant="default" className="text-[10px]">Required</Badge>
            {hasAppToken && (
              <Badge variant="secondary" className="text-[10px] text-green-600">
                <span className="mr-0.5">&#10003;</span> Valid
              </Badge>
            )}
          </div>
          <Input
            id="slack-app-token"
            type={showTokens ? "text" : "password"}
            placeholder="xapp-..."
            value={slackTokens.appToken}
            onChange={(e) => onSlackTokensChange({ ...slackTokens, appToken: e.target.value })}
            className="font-mono text-xs"
          />
        </div>

        <div className="rounded-lg border p-4">
          <div className="mb-2 flex items-center gap-2">
            <Label htmlFor="slack-team-id" className="font-medium">Team ID</Label>
            <Badge variant="default" className="text-[10px]">Required</Badge>
            {hasTeamId && (
              <Badge variant="secondary" className="text-[10px] text-green-600">
                <span className="mr-0.5">&#10003;</span> Valid
              </Badge>
            )}
          </div>
          <Input
            id="slack-team-id"
            type="text"
            placeholder="T0ABC123..."
            value={slackTokens.teamId}
            onChange={(e) => onSlackTokensChange({ ...slackTokens, teamId: e.target.value })}
            className="font-mono text-xs"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowTokens(!showTokens)}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        {showTokens ? "Hide tokens" : "Show tokens"}
      </button>

      {isComplete && (
        <p className="text-sm text-green-600">
          Slack tokens look good — agents will be wired to Slack on deployment.
        </p>
      )}
      {!isComplete && (slackTokens.botToken || slackTokens.appToken || slackTokens.teamId) && (
        <p className="text-sm text-amber-600">
          All three fields are needed for Slack integration.
        </p>
      )}
      {!slackTokens.botToken && !slackTokens.appToken && !slackTokens.teamId && (
        <p className="text-sm text-muted-foreground">
          You can skip this and configure Slack later from the Integrations page.
        </p>
      )}
    </div>
  );
}
