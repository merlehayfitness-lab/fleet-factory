/**
 * WhatsApp integration types.
 */

export interface WhatsAppConfig {
  id: string;
  businessId: string;
  phoneNumber: string;
  provider: "twilio" | "meta";
  providerConfig: TwilioConfig | MetaConfig;
  notificationPreferences: NotificationPreferences;
  dailyDigestTime: string;
  isActive: boolean;
  verifiedAt: string | null;
}

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

export interface MetaConfig {
  appId: string;
  appSecret: string;
  verifyToken: string;
  phoneNumberId: string;
  accessToken: string;
}

export interface NotificationPreferences {
  deployment_complete: boolean;
  approval_needed: boolean;
  new_crm_lead: boolean;
  follow_up_due: boolean;
  daily_digest: boolean;
  spend_alert: boolean;
}

export interface InboundMessage {
  from: string;
  body: string;
  messageId: string;
  timestamp: string;
  mediaUrl?: string;
}

export interface OutboundMessage {
  to: string;
  body: string;
  mediaUrl?: string;
}

export interface ParsedCommand {
  intent: "status" | "approve" | "reject" | "list_tasks" | "agent_query" | "unknown";
  args: string[];
  rawText: string;
  targetAgent?: string;
}

export interface DailyDigest {
  businessName: string;
  date: string;
  openTasks: number;
  pipelineValue: number;
  newLeads: number;
  agentActivity: Array<{ name: string; tasksCompleted: number }>;
  alerts: string[];
}

export type AlertType = keyof NotificationPreferences;
