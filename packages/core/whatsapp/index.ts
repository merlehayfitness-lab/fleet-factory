export {
  sendWhatsAppMessage,
  verifyTwilioSignature,
  verifyMetaWebhook,
  parseTwilioInbound,
  parseMetaInbound,
} from "./whatsapp-client";

export { parseCommand, getHelpMessage } from "./command-parser";

export {
  sendAlert,
  alertDeploymentComplete,
  alertApprovalNeeded,
  alertNewCrmLead,
  alertFollowUpDue,
  alertSpendThreshold,
  sendDailyDigest,
} from "./alerts";

export type {
  WhatsAppConfig,
  TwilioConfig,
  MetaConfig,
  NotificationPreferences,
  InboundMessage,
  OutboundMessage,
  ParsedCommand,
  DailyDigest,
  AlertType,
} from "./whatsapp-types";
