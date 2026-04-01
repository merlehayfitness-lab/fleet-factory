"use server";

import { createServerClient } from "@/_lib/supabase/server";
import { requireActiveBusiness } from "@/_lib/require-active-business";
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
  getSlackClient,
  getChannelMappings,
  extractText,
} from "@agency-factory/core/server";
import type { ChatMessage, ChatConversation, DepartmentChannel, KnowledgeFileType } from "@agency-factory/core";
import { randomUUID } from "node:crypto";

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

  const guard = await requireActiveBusiness(businessId);
  if (guard) return guard;

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

  const guard = await requireActiveBusiness(businessId);
  if (guard) return guard;

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
 * Send a message via Slack.
 * Posts the message to the mapped Slack channel AND stores it in Supabase.
 * Agent response comes asynchronously via Slack events + polling (not returned here).
 *
 * Flow:
 * 1. Auth check
 * 2. Get Slack client for business
 * 3. Look up channel mapping for this department
 * 4. Get or create conversation
 * 5. Store user message in Supabase with Slack metadata
 * 6. Post message to Slack channel
 * 7. Update stored message with Slack ts
 * 8. Return { userMessage } -- agent response comes via Slack events
 */
export async function sendSlackMessageAction(
  businessId: string,
  departmentId: string,
  content: string,
  files?: { name: string; size: number; type: string; url?: string }[],
): Promise<{ userMessage: ChatMessage; conversationId: string } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const guard = await requireActiveBusiness(businessId);
  if (guard) return guard;

  try {
    // Get Slack client
    const client = await getSlackClient(supabase, businessId);
    if (!client) {
      return { error: "Slack is not connected for this business" };
    }

    // Look up channel mapping for this department
    const mappings = await getChannelMappings(supabase, businessId);
    const mapping = mappings.find(
      (m) => m.departmentId === departmentId && m.agentId === null,
    );
    if (!mapping) {
      return { error: "No Slack channel mapped for this department" };
    }

    // Get or create conversation
    const conversation = await getOrCreateConversation(
      supabase,
      businessId,
      departmentId,
      user.id,
    );

    // Build metadata
    const metadata: Record<string, unknown> = {
      source: "admin_panel",
      slackChannelId: mapping.slackChannelId,
    };
    if (files && files.length > 0) {
      metadata.files = files.map((f) => ({
        name: f.name,
        size: f.size,
        type: f.type,
        url: f.url ?? "pending",
      }));
      // Keep legacy single-file field for backward compat with message bubble
      metadata.file = {
        name: files[0].name,
        size: files[0].size,
        type: files[0].type,
        url: files[0].url ?? "pending",
      };
    }

    // Store user message in Supabase
    const userMessage = await sendMessage(
      supabase,
      businessId,
      conversation.id,
      content,
      "user",
      undefined,
      undefined,
      metadata,
    );

    // Build Slack message text (include file mentions if attached)
    let slackText = content;
    if (files && files.length > 0) {
      const fileLines = files.map(
        (f) => `:paperclip: _Attached: ${f.name} (${(f.size / 1024).toFixed(1)}KB)_`,
      );
      slackText += "\n" + fileLines.join("\n");
    }

    // Post message to Slack channel as "Admin"
    try {
      const result = await client.chat.postMessage({
        channel: mapping.slackChannelId,
        text: slackText,
        username: "Admin",
        icon_emoji: ":bust_in_silhouette:",
      });

      // Update message record with Slack ts for deduplication
      if (result.ts) {
        await supabase
          .from("messages")
          .update({
            slack_ts: result.ts,
            slack_channel_id: mapping.slackChannelId,
          })
          .eq("id", userMessage.id);
      }
    } catch (slackErr) {
      // Message is stored in Supabase even if Slack post fails
      console.error("Failed to post message to Slack:", slackErr);
    }

    revalidatePath(`/businesses/${businessId}/chat`);
    return { userMessage, conversationId: conversation.id };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to send Slack message",
    };
  }
}

/**
 * Trigger agent response for a message.
 * Called separately from sendSlackMessageAction so it gets its own fresh
 * Supabase client (the original request-scoped client becomes invalid after
 * the server action response is sent).
 *
 * The agent response gets saved to DB and posted to Slack.
 * The UI picks it up via polling -- this action is fire-and-forget from the client.
 */
export async function triggerAgentResponseAction(
  businessId: string,
  departmentId: string,
  conversationId: string,
  content: string,
  fileContext?: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Prepend file context to the message so the agent can see file contents
  const enrichedContent = fileContext
    ? `${content}\n\n---\n\n**Attached file contents:**\n\n${fileContext}`
    : content;

  try {
    await routeAndRespond(
      supabase,
      businessId,
      departmentId,
      conversationId,
      enrichedContent,
    );
    return { success: true };
  } catch (err) {
    console.error("Agent routing failed:", err);
    return {
      error: err instanceof Error ? err.message : "Agent routing failed",
    };
  }
}

/** File extension to KnowledgeFileType mapping for text extraction */
const CHAT_FILE_TYPE_MAP: Record<string, KnowledgeFileType> = {
  txt: "text",
  md: "markdown",
  pdf: "pdf",
  docx: "docx",
  xlsx: "xlsx",
};

const MAX_EXTRACTED_TEXT = 50 * 1024; // 50KB truncation limit

export interface ChatFileUpload {
  name: string;
  size: number;
  type: string;
  url: string;
  extractedText: string | null;
}

/**
 * Upload chat files to Supabase Storage and extract text for supported types.
 *
 * Accepts FormData with:
 * - businessId: string
 * - files: File[] (multiple file entries under key "files")
 *
 * Returns array of uploaded file info with signed URLs and extracted text.
 */
export async function uploadChatFilesAction(
  formData: FormData,
): Promise<{ uploads: ChatFileUpload[] } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const businessId = formData.get("businessId") as string;
  if (!businessId) {
    return { error: "Business ID is required" };
  }

  const guard = await requireActiveBusiness(businessId);
  if (guard) return guard;

  const files = formData.getAll("files") as File[];
  if (!files || files.length === 0) {
    return { error: "No files provided" };
  }

  if (files.length > 5) {
    return { error: "Maximum 5 files allowed" };
  }

  const uploads: ChatFileUpload[] = [];

  for (const file of files) {
    if (!(file instanceof File)) continue;
    if (file.size > 10 * 1024 * 1024) {
      return { error: `File "${file.name}" exceeds 10MB limit` };
    }

    const fileId = randomUUID();
    const storagePath = `${businessId}/chat/${fileId}/${file.name}`;

    try {
      // Upload to Supabase Storage
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await supabase.storage
        .from("knowledge-docs")
        .upload(storagePath, buffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error(`Failed to upload ${file.name}:`, uploadError);
        return { error: `Failed to upload ${file.name}: ${uploadError.message}` };
      }

      // Generate signed URL (7 days)
      const { data: signedData, error: signError } = await supabase.storage
        .from("knowledge-docs")
        .createSignedUrl(storagePath, 7 * 24 * 60 * 60);

      const url = signError ? "pending" : signedData.signedUrl;

      // Extract text for supported types
      let extractedText: string | null = null;
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const fileType = CHAT_FILE_TYPE_MAP[ext];

      if (fileType) {
        try {
          let text = await extractText(buffer, fileType);
          if (text.length > MAX_EXTRACTED_TEXT) {
            text = text.slice(0, MAX_EXTRACTED_TEXT) + "\n\n[... text truncated at 50KB ...]";
          }
          extractedText = text;
        } catch (err) {
          console.error(`Text extraction failed for ${file.name}:`, err);
        }
      }

      uploads.push({
        name: file.name,
        size: file.size,
        type: file.type,
        url,
        extractedText,
      });
    } catch (err) {
      console.error(`Error processing ${file.name}:`, err);
      return {
        error: `Failed to process ${file.name}: ${err instanceof Error ? err.message : "Unknown error"}`,
      };
    }
  }

  return { uploads };
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
