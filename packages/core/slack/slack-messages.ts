// Bidirectional message sync between Slack and Supabase.
// Handles inbound Slack messages (store + route to agent) and outbound agent responses (post to Slack).

import type { WebClient } from "@slack/web-api";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SlackMessageEvent } from "./slack-types";
import { getDepartmentForChannel } from "./slack-channels";
import { getSlackClient } from "./slack-client";
import { getOrCreateConversation, routeAndRespond } from "../chat/chat-service";

/**
 * Handle an inbound Slack message event.
 * 1. Look up business_id and department_id from channel mapping
 * 2. Check for duplicate (idempotent via slack_ts)
 * 3. Get or create conversation
 * 4. Store inbound message with Slack metadata
 * 5. Route to agent via routeAndRespond pipeline
 * 6. Post agent response back to Slack
 * 7. Update agent message record with Slack ts
 *
 * This function is fire-and-forget (void) to meet Slack's 3-second timeout.
 */
export async function handleInboundSlackMessage(
  supabase: SupabaseClient,
  slackTeamId: string,
  event: SlackMessageEvent,
): Promise<void> {
  try {
    // 1. Look up business + department from channel mapping
    const lookup = await getDepartmentForChannel(
      supabase,
      slackTeamId,
      event.channel,
    );
    if (!lookup) {
      // Message in unmapped channel -- skip
      return;
    }

    const { businessId, departmentId } = lookup;

    // 2. Check for duplicate message (idempotent via slack_ts)
    const { data: existingMsg } = await supabase
      .from("messages")
      .select("id")
      .eq("slack_ts", event.ts)
      .eq("business_id", businessId)
      .maybeSingle();

    if (existingMsg) {
      // Already processed this message -- skip
      return;
    }

    // 3. Get or create conversation for this department
    // Use a system user ID for Slack-originated messages (the Slack user)
    // We use a deterministic ID based on the business for the "slack bot user"
    const conversation = await getOrCreateConversation(
      supabase,
      businessId,
      departmentId,
      // Use a deterministic pseudo-user-id for Slack messages
      // The real Slack user identity is stored in message metadata
      "00000000-0000-0000-0000-000000000000",
    );

    // 4. Store inbound user message with Slack metadata
    const { error: insertError } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversation.id,
        business_id: businessId,
        role: "user",
        content: event.text ?? "",
        slack_ts: event.ts,
        slack_channel_id: event.channel,
        metadata: {
          slackUser: event.user,
          slackThreadTs: event.thread_ts,
          source: "slack",
        },
      });

    if (insertError) {
      console.error("Failed to store inbound Slack message:", insertError.message);
      return;
    }

    // Update conversation counters (best-effort)
    try {
      await supabase
        .from("conversations")
        .update({
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          slack_channel_id: event.channel,
        })
        .eq("id", conversation.id);
    } catch {
      // Best-effort
    }

    // 5. Route to agent via existing pipeline
    const agentMessage = await routeAndRespond(
      supabase,
      businessId,
      departmentId,
      conversation.id,
      event.text ?? "",
    );

    // 6. Post agent response back to Slack
    const client = await getSlackClient(supabase, businessId);
    if (client) {
      const slackTs = await postAgentResponseToSlack(
        client,
        event.channel,
        agentMessage.agentName ?? "Agent",
        agentMessage.content,
        event.thread_ts,
      );

      // 7. Update agent message record with Slack ts
      if (slackTs) {
        await supabase
          .from("messages")
          .update({
            slack_ts: slackTs,
            slack_channel_id: event.channel,
          })
          .eq("id", agentMessage.id);
      }
    }
  } catch (err) {
    console.error("Error handling inbound Slack message:", err);
  }
}

/**
 * Post an agent response to a Slack channel.
 * Uses chat.postMessage with username override for agent identity.
 * Returns the message ts (timestamp) from Slack for record linking.
 */
export async function postAgentResponseToSlack(
  client: WebClient,
  channelId: string,
  agentName: string,
  content: string,
  threadTs?: string,
): Promise<string | undefined> {
  const result = await client.chat.postMessage({
    channel: channelId,
    text: content,
    username: agentName,
    thread_ts: threadTs,
  });
  return result.ts;
}

/**
 * Store a message in the Supabase messages table with Slack metadata.
 * Used for direct message sync operations.
 */
export async function syncMessageToSupabase(
  supabase: SupabaseClient,
  businessId: string,
  conversationId: string,
  content: string,
  role: "user" | "agent" | "system",
  agentId?: string,
  slackTs?: string,
  slackChannelId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      business_id: businessId,
      role,
      agent_id: agentId ?? null,
      content,
      slack_ts: slackTs ?? null,
      slack_channel_id: slackChannelId ?? null,
      metadata: metadata ?? {},
    });

  if (error) {
    throw new Error(`Failed to sync message to Supabase: ${error.message}`);
  }
}
