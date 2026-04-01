// Bidirectional message sync between Slack and Supabase.
// Handles inbound Slack messages (store + route to agent) and outbound agent responses (post to Slack).

import type { WebClient } from "@slack/web-api";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SlackMessageEvent } from "./slack-types";
import type { ChatMessage, ToolCallTrace } from "../chat/chat-types";
import { getDepartmentForChannel } from "./slack-channels";
import { getSlackClient } from "./slack-client";
import { getOrCreateConversation, routeAndRespond } from "../chat/chat-service";
import {
  formatAgentResponseBlocks,
  formatToolCallAttachment,
  getAgentEmoji,
} from "./slack-blocks";

/**
 * Handle an inbound Slack message event.
 *
 * Per user decision: agents respond ONLY when @mentioned.
 * - If message does NOT contain @mention: store in Supabase (for admin panel display) but do NOT route to agent.
 * - If message DOES contain @mention: store in Supabase AND route to agent via routeAndRespond, then post response back.
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
    const conversation = await getOrCreateConversation(
      supabase,
      businessId,
      departmentId,
      // Use a deterministic pseudo-user-id for Slack messages
      "00000000-0000-0000-0000-000000000000",
    );

    // 4. Detect @mention: check if message contains <@{botUserId}>
    const botUserId = await lookupBotUserId(supabase, businessId);
    const messageText = event.text ?? "";
    const isMentioned = botUserId
      ? messageText.includes(`<@${botUserId}>`)
      : false;

    // Strip @mention from text before routing to agent (clean input)
    const cleanedText = botUserId
      ? messageText.replace(new RegExp(`<@${botUserId}>`, "g"), "").trim()
      : messageText;

    // 5. Store inbound user message with Slack metadata
    const { error: insertError } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversation.id,
        business_id: businessId,
        role: "user",
        content: messageText,
        slack_ts: event.ts,
        slack_channel_id: event.channel,
        metadata: {
          slackUser: event.user,
          slackThreadTs: event.thread_ts,
          source: "slack",
          mentioned: isMentioned,
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

    // 6. If NOT @mentioned, stop here -- message is stored but agent does NOT respond
    if (!isMentioned) {
      return;
    }

    // 7. Route to agent via existing pipeline (only when @mentioned)
    const agentMessage = await routeAndRespond(
      supabase,
      businessId,
      departmentId,
      conversation.id,
      cleanedText,
    );

    // 8. Get department type for agent emoji
    const { data: dept } = await supabase
      .from("departments")
      .select("type")
      .eq("id", departmentId)
      .single();
    const departmentType = (dept?.type as string) ?? "custom";

    // 9. Post agent response back to Slack with Block Kit formatting and agent identity
    const client = await getSlackClient(supabase, businessId);
    if (client) {
      const slackTs = await postAgentResponseToSlack(
        client,
        event.channel,
        agentMessage.agentName ?? "Agent",
        departmentType,
        agentMessage.content,
        agentMessage.toolCalls,
        event.thread_ts,
      );

      // 10. Update agent message record with Slack ts
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
 * Uses Block Kit formatting for rich messages and per-agent username/emoji for identity.
 * Returns the message ts (timestamp) from Slack for record linking.
 */
export async function postAgentResponseToSlack(
  client: WebClient,
  channelId: string,
  agentName: string,
  departmentType: string,
  content: string,
  toolCalls?: ToolCallTrace[],
  threadTs?: string,
): Promise<string | undefined> {
  const { blocks, text } = formatAgentResponseBlocks(content, toolCalls);

  // Build attachments from tool calls
  const attachments = toolCalls && toolCalls.length > 0
    ? toolCalls.map(formatToolCallAttachment) as Array<Record<string, unknown>>
    : undefined;

  const result = await client.chat.postMessage({
    channel: channelId,
    text,
    blocks,
    username: agentName,
    icon_emoji: getAgentEmoji(departmentType),
    thread_ts: threadTs,
    attachments: attachments as never,
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

/**
 * Fetch Slack-synced messages for a department.
 * Returns only messages that have slack_ts set (i.e., Slack-synced messages).
 * Data source for the "embedded Slack feed view" in the admin panel.
 */
export async function getSlackFeedMessages(
  supabase: SupabaseClient,
  businessId: string,
  departmentId: string,
  limit = 50,
  before?: string,
): Promise<ChatMessage[]> {
  // Find conversations for this department
  const { data: conversations } = await supabase
    .from("conversations")
    .select("id")
    .eq("business_id", businessId)
    .eq("department_id", departmentId)
    .eq("status", "active");

  if (!conversations || conversations.length === 0) {
    return [];
  }

  const conversationIds = conversations.map((c) => c.id as string);

  // Fetch all messages for the department's conversations
  // (includes both Slack-synced and admin-panel messages)
  let query = supabase
    .from("messages")
    .select(
      "id, conversation_id, business_id, role, agent_id, content, tool_calls, metadata, created_at, slack_ts, slack_channel_id",
    )
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (before) {
    query = query.lt("created_at", before);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch Slack feed messages: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Batch fetch agent names for agent messages
  const agentIds = [
    ...new Set(
      data
        .filter((m) => m.agent_id)
        .map((m) => m.agent_id as string),
    ),
  ];
  const agentNameMap = new Map<string, string>();
  if (agentIds.length > 0) {
    const { data: agents } = await supabase
      .from("agents")
      .select("id, name")
      .in("id", agentIds);
    for (const agent of agents ?? []) {
      agentNameMap.set(agent.id as string, agent.name as string);
    }
  }

  return data.map((m) => ({
    id: m.id as string,
    conversationId: m.conversation_id as string,
    businessId: m.business_id as string,
    role: m.role as "user" | "agent" | "system",
    agentId: (m.agent_id as string) ?? null,
    agentName: m.agent_id
      ? agentNameMap.get(m.agent_id as string) ?? null
      : null,
    content: m.content as string,
    toolCalls: (m.tool_calls as ToolCallTrace[]) ?? [],
    metadata: (m.metadata as Record<string, unknown>) ?? {},
    createdAt: m.created_at as string,
  }));
}

/**
 * Look up the bot_user_id from slack_installations for @mention detection.
 */
async function lookupBotUserId(
  supabase: SupabaseClient,
  businessId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("slack_installations")
    .select("bot_user_id")
    .eq("business_id", businessId)
    .maybeSingle();

  return (data?.bot_user_id as string) ?? null;
}
