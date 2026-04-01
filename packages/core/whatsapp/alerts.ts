/**
 * WhatsApp alert triggers.
 *
 * Sends alerts for key business events:
 * deployment, approvals, CRM leads, follow-ups, and spend.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { WhatsAppConfig, AlertType, DailyDigest } from "./whatsapp-types";
import { sendWhatsAppMessage } from "./whatsapp-client";

/**
 * Send an alert if the business has WhatsApp configured and the alert type is enabled.
 */
export async function sendAlert(
  supabase: SupabaseClient,
  businessId: string,
  alertType: AlertType,
  message: string,
): Promise<boolean> {
  const config = await getWhatsAppConfig(supabase, businessId);
  if (!config || !config.isActive) return false;
  if (!config.notificationPreferences[alertType]) return false;

  const result = await sendWhatsAppMessage(config, {
    to: config.phoneNumber,
    body: message,
  });

  return result.success;
}

/**
 * Send deployment complete alert.
 */
export async function alertDeploymentComplete(
  supabase: SupabaseClient,
  businessId: string,
  businessName: string,
  agentCount: number,
): Promise<void> {
  await sendAlert(
    supabase,
    businessId,
    "deployment_complete",
    `Deployment complete for ${businessName}. ${agentCount} agents are now live.`,
  );
}

/**
 * Send approval needed alert.
 */
export async function alertApprovalNeeded(
  supabase: SupabaseClient,
  businessId: string,
  agentName: string,
  action: string,
): Promise<void> {
  await sendAlert(
    supabase,
    businessId,
    "approval_needed",
    `Approval needed: ${agentName} wants to ${action}.\n\nReply "approve" or "reject" to respond.`,
  );
}

/**
 * Send new CRM lead alert.
 */
export async function alertNewCrmLead(
  supabase: SupabaseClient,
  businessId: string,
  leadName: string,
  source: string,
): Promise<void> {
  await sendAlert(
    supabase,
    businessId,
    "new_crm_lead",
    `New lead: ${leadName} (source: ${source}).\n\nThe Lead Qualifier agent is scoring this lead now.`,
  );
}

/**
 * Send follow-up due alert.
 */
export async function alertFollowUpDue(
  supabase: SupabaseClient,
  businessId: string,
  contactName: string,
  taskDescription: string,
): Promise<void> {
  await sendAlert(
    supabase,
    businessId,
    "follow_up_due",
    `Follow-up due: ${contactName}\n${taskDescription}`,
  );
}

/**
 * Send daily spend alert to TJ if threshold exceeded.
 */
export async function alertSpendThreshold(
  supabase: SupabaseClient,
  businessId: string,
  dailySpendCents: number,
  thresholdCents: number,
): Promise<void> {
  if (dailySpendCents < thresholdCents) return;

  await sendAlert(
    supabase,
    businessId,
    "spend_alert",
    `Spend alert: Daily API spend is $${(dailySpendCents / 100).toFixed(2)}, exceeding threshold of $${(thresholdCents / 100).toFixed(2)}.`,
  );
}

/**
 * Generate and send daily digest.
 */
export async function sendDailyDigest(
  supabase: SupabaseClient,
  businessId: string,
): Promise<void> {
  const config = await getWhatsAppConfig(supabase, businessId);
  if (!config || !config.isActive || !config.notificationPreferences.daily_digest) {
    return;
  }

  // Fetch business info
  const { data: business } = await supabase
    .from("businesses")
    .select("name")
    .eq("id", businessId)
    .single();

  // Fetch open tasks
  const { count: openTasks } = await supabase
    .from("tasks")
    .select("*", { count: "exact", head: true })
    .eq("business_id", businessId)
    .in("status", ["open", "in_progress"]);

  const digest: DailyDigest = {
    businessName: business?.name ?? "Your Business",
    date: new Date().toLocaleDateString(),
    openTasks: openTasks ?? 0,
    pipelineValue: 0, // TODO: from CRM
    newLeads: 0, // TODO: from CRM
    agentActivity: [],
    alerts: [],
  };

  const message = formatDigest(digest);
  await sendWhatsAppMessage(config, {
    to: config.phoneNumber,
    body: message,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getWhatsAppConfig(
  supabase: SupabaseClient,
  businessId: string,
): Promise<WhatsAppConfig | null> {
  const { data, error } = await supabase
    .from("whatsapp_config")
    .select("*")
    .eq("business_id", businessId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    businessId: data.business_id,
    phoneNumber: data.phone_number,
    provider: data.provider,
    providerConfig: data.provider_config,
    notificationPreferences: data.notification_preferences,
    dailyDigestTime: data.daily_digest_time,
    isActive: data.is_active,
    verifiedAt: data.verified_at,
  };
}

function formatDigest(digest: DailyDigest): string {
  const lines = [
    `Good morning! Here's your daily digest for ${digest.businessName}:`,
    `Date: ${digest.date}`,
    "",
    `Open tasks: ${digest.openTasks}`,
    `Pipeline value: $${digest.pipelineValue.toLocaleString()}`,
    `New leads today: ${digest.newLeads}`,
  ];

  if (digest.agentActivity.length > 0) {
    lines.push("", "Agent activity:");
    for (const agent of digest.agentActivity) {
      lines.push(`  ${agent.name}: ${agent.tasksCompleted} tasks completed`);
    }
  }

  if (digest.alerts.length > 0) {
    lines.push("", "Alerts:");
    for (const alert of digest.alerts) {
      lines.push(`  ${alert}`);
    }
  }

  return lines.join("\n");
}
