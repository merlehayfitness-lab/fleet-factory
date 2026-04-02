"use client";

import {
  TrendingUp,
  Headphones,
  Settings,
  Crown,
  Hash,
  Snowflake,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DepartmentChannel, SlackChannelMapping } from "@fleet-factory/core";
import type { LucideIcon } from "lucide-react";

interface SlackChannelWithDept extends SlackChannelMapping {
  departmentName: string;
  departmentType: string;
}

interface ChatChannelListProps {
  channels: DepartmentChannel[];
  selectedDepartmentId: string | null;
  onSelectDepartment: (departmentId: string) => void;
  slackChannels?: SlackChannelWithDept[];
}

/** Department type to icon mapping */
const DEPT_ICONS: Record<string, LucideIcon> = {
  sales: TrendingUp,
  support: Headphones,
  operations: Settings,
  owner: Crown,
};

/**
 * Department channel sidebar for the chat interface.
 *
 * When Slack channels are provided, shows Slack channel names with # prefix
 * instead of department names. Sidebar header shows "Slack Channels".
 * Selection still identifies by departmentId.
 */
export function ChatChannelList({
  channels,
  selectedDepartmentId,
  onSelectDepartment,
  slackChannels,
}: ChatChannelListProps) {
  const hasSlack = slackChannels && slackChannels.length > 0;

  // Build a map from departmentId to Slack channel name for display
  const slackNameMap = new Map<string, string>();
  if (hasSlack) {
    for (const sc of slackChannels) {
      // Use department-level mappings (agent_id null) as primary display name
      if (sc.agentId === null) {
        slackNameMap.set(sc.departmentId, sc.slackChannelName);
      }
    }
  }

  return (
    <div className="w-60 shrink-0 border-r bg-muted/20 flex flex-col">
      <div className="border-b px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {hasSlack ? "Slack Channels" : "Channels"}
        </h2>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {channels.map((channel) => {
          const isSelected = channel.departmentId === selectedDepartmentId;
          const Icon =
            DEPT_ICONS[channel.departmentType.toLowerCase()] ?? Hash;
          const slackName = slackNameMap.get(channel.departmentId);
          const displayName =
            hasSlack && slackName
              ? `#${slackName}`
              : channel.departmentName;

          return (
            <button
              key={channel.departmentId}
              type="button"
              onClick={() => onSelectDepartment(channel.departmentId)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors text-left",
                isSelected
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1 truncate">{displayName}</span>

              {/* Frozen indicator */}
              {channel.agentFrozen && (
                <Snowflake className="size-3 shrink-0 text-blue-500" />
              )}

              {/* Unread count badge */}
              {channel.unreadCount > 0 && (
                <Badge
                  variant="default"
                  className="size-5 shrink-0 items-center justify-center rounded-full p-0 text-[10px]"
                >
                  {channel.unreadCount > 9 ? "9+" : channel.unreadCount}
                </Badge>
              )}
            </button>
          );
        })}

        {channels.length === 0 && (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
            No departments found
          </p>
        )}
      </nav>
    </div>
  );
}
