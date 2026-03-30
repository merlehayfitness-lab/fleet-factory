"use client";

import { ExternalLink, Snowflake, Bot, Hash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SlackChannelHeaderProps {
  channelName: string;
  departmentName: string;
  slackChannelId: string;
  slackTeamId: string;
  isAgentFrozen: boolean;
  hasActiveAgent: boolean;
}

/**
 * Channel header bar with Slack connection badge and "Open in Slack" deep link.
 * Replaces the inline header in ChatLayout when Slack is connected.
 */
export function SlackChannelHeader({
  channelName,
  departmentName,
  slackChannelId,
  slackTeamId,
  isAgentFrozen,
  hasActiveAgent,
}: SlackChannelHeaderProps) {
  const slackDeepLink = `https://slack.com/app_redirect?channel=${slackChannelId}&team=${slackTeamId}`;

  return (
    <div className="flex items-center justify-between border-b px-4 py-2.5">
      <div className="flex items-center gap-2">
        <Hash className="size-4 text-muted-foreground" />
        <div>
          <h2 className="text-sm font-semibold">{channelName}</h2>
          <p className="text-[10px] text-muted-foreground">{departmentName}</p>
        </div>

        {isAgentFrozen && (
          <>
            <Snowflake className="size-3.5 text-blue-500" />
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
            >
              Frozen
            </Badge>
          </>
        )}

        {!hasActiveAgent && !isAgentFrozen && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            No active agent
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Connected to Slack badge */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-green-500" />
          <span>Connected to Slack</span>
        </div>

        {/* Open in Slack deep link */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => window.open(slackDeepLink, "_blank", "noopener,noreferrer")}
        >
          <ExternalLink className="mr-1 size-3" />
          Open in Slack
        </Button>
      </div>
    </div>
  );
}
