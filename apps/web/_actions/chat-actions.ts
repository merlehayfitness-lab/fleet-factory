"use server";

import { createServerClient } from "@/_lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  getOrCreateConversation,
  sendMessage,
  getMessages,
  getConversationsForBusiness,
  archiveConversation,
  getDepartmentChannels,
  routeAndRespond,
  getVpsAgentId,
  getVpsChatWsUrl,
  isVpsConfigured,
  selectAgent,
} from "@agency-factory/core/server";
import type { ChatMessage, ChatConversation, DepartmentChannel } from "@agency-factory/core";

/**
 * Send a message to a department channel.
 * Creates/reuses conversation, sends user message, routes to agent, returns both messages.
 */
export async function sendMessageAction(
  businessId: string,
  departmentId: string,
  content: string,
  fileMetadata?: { name: string; size: number; type: string },
): Promise<
  | { userMessage: ChatMessage; agentMessage: ChatMessage }
  | { error: string }
> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    // Get or create conversation for this department
    const conversation = await getOrCreateConversation(
      supabase,
      businessId,
      departmentId,
      user.id,
    );

    // Build metadata with file info if provided
    const metadata: Record<string, unknown> = {};
    if (fileMetadata) {
      metadata.file = {
        name: fileMetadata.name,
        size: fileMetadata.size,
        type: fileMetadata.type,
        url: "pending", // Actual storage upload deferred
      };
    }

    // Send user message
    const userMessage = await sendMessage(
      supabase,
      businessId,
      conversation.id,
      content,
      "user",
      undefined,
      undefined,
      Object.keys(metadata).length > 0 ? metadata : undefined,
    );

    // Route to agent and get response
    const agentMessage = await routeAndRespond(
      supabase,
      businessId,
      departmentId,
      conversation.id,
      content,
    );

    revalidatePath(`/businesses/${businessId}/chat`);
    return { userMessage, agentMessage };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to send message",
    };
  }
}

/**
 * Get messages for a conversation with optional pagination.
 */
export async function getMessagesAction(
  conversationId: string,
  before?: string,
): Promise<{ messages: ChatMessage[] } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  try {
    const messages = await getMessages(supabase, conversationId, 50, before);
    return { messages };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to fetch messages",
    };
  }
}

/**
 * Get all conversations for a business.
 */
export async function getConversationsAction(
  businessId: string,
): Promise<{ conversations: ChatConversation[] } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  try {
    const conversations = await getConversationsForBusiness(
      supabase,
      businessId,
    );
    return { conversations };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to fetch conversations",
    };
  }
}

/**
 * Get department channels with unread counts for the sidebar.
 */
export async function getDepartmentChannelsAction(
  businessId: string,
): Promise<{ channels: DepartmentChannel[] } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  try {
    const channels = await getDepartmentChannels(
      supabase,
      businessId,
      user.id,
    );
    return { channels };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Failed to fetch department channels",
    };
  }
}

/**
 * Archive a conversation.
 */
export async function archiveConversationAction(
  conversationId: string,
  businessId: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    await archiveConversation(supabase, conversationId);
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Failed to archive conversation",
    };
  }

  revalidatePath(`/businesses/${businessId}/chat`);
  return { success: true };
}

/**
 * Get the WebSocket URL for streaming chat from a VPS agent.
 * Returns { wsUrl } if VPS is configured and agent has a VPS mapping,
 * or { wsUrl: null } if VPS is not configured or agent is not mapped.
 */
export async function getVpsChatStreamUrl(
  businessId: string,
  departmentId: string,
): Promise<{ wsUrl: string | null }> {
  if (!isVpsConfigured()) {
    return { wsUrl: null };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { wsUrl: null };
  }

  try {
    // Find active agent for this department
    const agent = await selectAgent(supabase, departmentId, businessId);
    if (!agent) {
      return { wsUrl: null };
    }

    // Look up VPS agent ID
    const vpsAgentId = await getVpsAgentId(supabase, agent.id);
    if (!vpsAgentId) {
      return { wsUrl: null };
    }

    // Get or create conversation to get the conversation ID
    const conversation = await getOrCreateConversation(
      supabase,
      businessId,
      departmentId,
      user.id,
    );

    const wsUrl = getVpsChatWsUrl(vpsAgentId, conversation.id);
    return { wsUrl };
  } catch {
    return { wsUrl: null };
  }
}
