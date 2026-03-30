// Slack integration type definitions.
// Client-safe -- no Supabase or server dependencies.

/** A Slack workspace installation for a business */
export interface SlackInstallation {
  id: string;
  businessId: string;
  slackTeamId: string;
  slackTeamName: string | null;
  botUserId: string;
  installedAt: string;
}

/** A mapping between a Slack channel and a department (or sub-agent) */
export interface SlackChannelMapping {
  id: string;
  businessId: string;
  departmentId: string;
  agentId: string | null;
  slackChannelId: string;
  slackChannelName: string;
  createdAt: string;
}

/** Raw Slack event payload from the Events API */
export interface SlackEventPayload {
  type: "url_verification" | "event_callback";
  token: string;
  team_id: string;
  event?: SlackMessageEvent;
  event_id?: string;
  event_time?: number;
  challenge?: string;
}

/** A Slack message event from the Events API */
export interface SlackMessageEvent {
  type: string;
  channel: string;
  user?: string;
  text?: string;
  ts: string;
  thread_ts?: string;
  bot_id?: string;
  subtype?: string;
}

/** Slack connection status for a business */
export type SlackConnectionStatus =
  | {
      connected: true;
      teamName: string | null;
      teamId: string;
      botUserId: string;
      installedAt: string;
    }
  | { connected: false };
