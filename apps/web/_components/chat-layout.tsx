"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { WifiOff, Loader2 } from "lucide-react";
import { ChatChannelList } from "./chat-channel-list";
import { ChatMessageList } from "./chat-message-list";
import { ChatMessageInput } from "./chat-message-input";
import { SlackConnectPrompt } from "./slack-connect-prompt";
import { SlackChannelHeader } from "./slack-channel-header";
import { useBusinessStatus } from "@/_components/business-status-provider";
import {
  getMessagesAction,
  getDepartmentChannelsAction,
  getConversationsAction,
  sendSlackMessageAction,
  triggerAgentResponseAction,
  uploadChatFilesAction,
} from "@/_actions/chat-actions";
import { getSlackFeedMessagesAction } from "@/_actions/slack-actions";
import type { ChatMessage, DepartmentChannel, SlackConnectionStatus, SlackChannelMapping } from "@fleet-factory/core";

interface SlackChannelWithDept extends SlackChannelMapping {
  departmentName: string;
  departmentType: string;
}

interface ChatLayoutProps {
  businessId: string;
  businessName: string;
  businessSlug: string;
  channels: DepartmentChannel[];
  vpsStatus: { status: string; lastCheckedAt: string } | null;
  slackStatus: SlackConnectionStatus;
  slackChannels: SlackChannelWithDept[];
  slackTeamId: string | null;
}

/**
 * Full-page chat layout with Slack-powered or Connect Slack UI.
 *
 * When Slack is connected:
 * - Channel sidebar shows Slack channel names with # prefix
 * - Messages display in flat Slack-like layout
 * - Sending messages posts to Slack AND stores in Supabase
 * - Polling picks up agent responses from Slack events
 *
 * When Slack is not connected:
 * - Shows SlackConnectPrompt directing to integrations page
 */
export function ChatLayout({
  businessId,
  businessName,
  businessSlug,
  channels: initialChannels,
  vpsStatus,
  slackStatus,
  slackChannels,
  slackTeamId,
}: ChatLayoutProps) {
  const isSlackConnected = slackStatus.connected;

  // If Slack is not connected, show the connect prompt
  if (!isSlackConnected) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)]">
        <SlackConnectPrompt businessId={businessId} />
      </div>
    );
  }

  // Slack is connected -- render the Slack-powered chat UI
  return (
    <SlackChatUI
      businessId={businessId}
      businessName={businessName}
      businessSlug={businessSlug}
      channels={initialChannels}
      vpsStatus={vpsStatus}
      slackChannels={slackChannels}
      slackTeamId={slackTeamId ?? ""}
    />
  );
}

/**
 * Slack-powered chat UI -- extracted to avoid hooks in conditional branches.
 */
function SlackChatUI({
  businessId,
  businessName,
  businessSlug,
  channels: initialChannels,
  vpsStatus,
  slackChannels,
  slackTeamId,
}: {
  businessId: string;
  businessName: string;
  businessSlug: string;
  channels: DepartmentChannel[];
  vpsStatus: { status: string; lastCheckedAt: string } | null;
  slackChannels: SlackChannelWithDept[];
  slackTeamId: string;
}) {
  const { isDisabled } = useBusinessStatus();
  const searchParams = useSearchParams();
  const departmentParam = searchParams.get("department");

  // State
  const [channels, setChannels] =
    useState<DepartmentChannel[]>(initialChannels);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<
    string | null
  >(departmentParam ?? initialChannels[0]?.departmentId ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const isAgentTypingRef = useRef(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queuePollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep ref in sync with state (for use inside interval callbacks)
  useEffect(() => {
    isAgentTypingRef.current = isAgentTyping;
  }, [isAgentTyping]);

  // Queue status polling: when the latest message is a queue status, poll for real response
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    const isQueueStatus = lastMsg?.role === "system" && lastMsg?.metadata?.isQueueStatus;

    if (!isQueueStatus || !selectedDepartmentId) {
      if (queuePollRef.current) {
        clearInterval(queuePollRef.current);
        queuePollRef.current = null;
      }
      return;
    }

    queuePollRef.current = setInterval(async () => {
      const result = await getSlackFeedMessagesAction(
        businessId,
        selectedDepartmentId,
        50,
      );
      if ("messages" in result && result.messages.length > 0) {
        const lastFeedMsg = result.messages[result.messages.length - 1];
        const stillQueued = lastFeedMsg?.role === "system" && lastFeedMsg?.metadata?.isQueueStatus;
        if (!stillQueued) {
          // Real response arrived, replace messages and clear queue poll
          setMessages(result.messages);
          if (queuePollRef.current) {
            clearInterval(queuePollRef.current);
            queuePollRef.current = null;
          }
        }
      }
    }, 3000);

    return () => {
      if (queuePollRef.current) {
        clearInterval(queuePollRef.current);
        queuePollRef.current = null;
      }
    };
  }, [messages, selectedDepartmentId, businessId]);

  const isVpsOffline = vpsStatus?.status === "offline";

  // Detect high demand from queue status messages
  const lastMessage = messages[messages.length - 1];
  const isHighDemand = lastMessage?.role === "system" && lastMessage?.metadata?.isQueueStatus;

  // Get selected channel info from department channels
  const selectedChannel = channels.find(
    (c) => c.departmentId === selectedDepartmentId,
  );
  const isAgentFrozen =
    selectedChannel?.agentFrozen === true &&
    !selectedChannel?.hasActiveAgent;

  // Get matching Slack channel mapping for selected department
  const selectedSlackChannel = slackChannels.find(
    (sc) => sc.departmentId === selectedDepartmentId && sc.agentId === null,
  );

  // Load messages when department changes
  useEffect(() => {
    if (!selectedDepartmentId) return;

    let cancelled = false;
    setIsLoading(true);
    setMessages([]);
    setConversationId(null);
    setHasMoreMessages(false);
    setIsAgentTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    async function loadExistingMessages() {
      // Refresh channels
      const result = await getDepartmentChannelsAction(businessId);
      if (cancelled) return;

      if ("channels" in result) {
        setChannels(result.channels);
      }

      // Load Slack-synced messages for the department (Slack feed view)
      const feedResult = await getSlackFeedMessagesAction(
        businessId,
        selectedDepartmentId!,
      );
      if (cancelled) return;

      if ("messages" in feedResult && feedResult.messages.length > 0) {
        setMessages(feedResult.messages);
        setHasMoreMessages(feedResult.messages.length >= 50);
      }

      // Also look up conversation ID for polling and sending
      const convResult = await getConversationsAction(businessId);
      if (cancelled) return;

      if ("conversations" in convResult) {
        const conv = convResult.conversations.find(
          (c) =>
            c.departmentId === selectedDepartmentId && c.status === "active",
        );
        if (conv) {
          setConversationId(conv.id);
        }
      }

      if (!cancelled) setIsLoading(false);
    }

    void loadExistingMessages();

    return () => {
      cancelled = true;
    };
  }, [selectedDepartmentId, businessId]);

  // Message polling every 10 seconds (Slack events store messages in Supabase)
  useEffect(() => {
    if (!selectedDepartmentId) return;

    pollingRef.current = setInterval(async () => {
      const result = await getSlackFeedMessagesAction(
        businessId,
        selectedDepartmentId,
      );
      if ("messages" in result && result.messages.length > 0) {
        setMessages((prev) => {
          // Check if agent responded (new agent message appeared)
          if (isAgentTypingRef.current) {
            const hasNewAgentMsg = result.messages.some(
              (m) => m.role === "agent" && !prev.find((p) => p.id === m.id),
            );
            if (hasNewAgentMsg) {
              setIsAgentTyping(false);
              if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            }
          }

          // Merge: use feed as source of truth, keep optimistic messages
          const feedIds = new Set(result.messages.map((m) => m.id));
          const optimistic = prev.filter((m) => !feedIds.has(m.id));
          if (optimistic.length === 0) return result.messages;
          return [...result.messages, ...optimistic].sort(
            (a, b) =>
              new Date(a.createdAt).getTime() -
              new Date(b.createdAt).getTime(),
          );
        });
      }
    }, 10000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [selectedDepartmentId, businessId]);

  // Handle department selection
  const handleSelectDepartment = useCallback((departmentId: string) => {
    setSelectedDepartmentId(departmentId);
  }, []);

  // Handle send message via Slack
  const handleSendMessage = useCallback(
    async (
      content: string,
      files?: File[],
    ) => {
      if (!selectedDepartmentId || isSending) return;

      setIsSending(true);

      // Step 1: Upload files if any
      let filesMeta: { name: string; size: number; type: string; url?: string }[] | undefined;
      let fileContext: string | undefined;

      if (files && files.length > 0) {
        const formData = new FormData();
        formData.set("businessId", businessId);
        for (const file of files) {
          formData.append("files", file);
        }

        const uploadResult = await uploadChatFilesAction(formData);
        if ("error" in uploadResult) {
          console.error("File upload failed:", uploadResult.error);
          setIsSending(false);
          return;
        }

        // Build files metadata with real URLs
        filesMeta = uploadResult.uploads.map((u) => ({
          name: u.name,
          size: u.size,
          type: u.type,
          url: u.url,
        }));

        // Build file context string from extracted text
        const textParts = uploadResult.uploads
          .filter((u) => u.extractedText)
          .map((u) => `## File: ${u.name}\n${u.extractedText}`);

        if (textParts.length > 0) {
          fileContext = textParts.join("\n\n---\n\n");
        }
      }

      // Step 2: Send message to Slack with real file URLs
      const result = await sendSlackMessageAction(
        businessId,
        selectedDepartmentId,
        content,
        filesMeta,
      );

      if ("error" in result) {
        setIsSending(false);
        return;
      }

      // Show user message immediately (agent response arrives via polling)
      setMessages((prev) => [...prev, result.userMessage]);

      // Update conversation ID
      const convId = result.conversationId;
      if (!conversationId && convId) {
        setConversationId(convId);
      }

      setIsSending(false);

      // Step 3: Trigger agent response with file context
      const deptId = selectedDepartmentId;

      // Show typing indicator while waiting for agent
      setIsAgentTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setIsAgentTyping(false), 60_000);

      triggerAgentResponseAction(
        businessId,
        deptId,
        convId,
        content,
        fileContext,
      ).catch((err) => {
        console.error("Agent response trigger failed:", err);
        setIsAgentTyping(false);
      });

      // Quick re-polls to pick up agent response faster than the 10s interval
      const prevMsgCount = messages.length + 1; // +1 for the optimistic user message
      const quickPoll = async () => {
        const r = await getSlackFeedMessagesAction(businessId, deptId, 50);
        if ("messages" in r && r.messages.length > 0) {
          // Check if agent responded (new agent message appeared)
          const hasNewAgentMsg = r.messages.some(
            (m) => m.role === "agent" && !messages.find((prev) => prev.id === m.id),
          );
          if (hasNewAgentMsg) {
            setIsAgentTyping(false);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          }

          setMessages((prev) => {
            // Merge: keep any optimistic messages not yet in the feed
            const feedIds = new Set(r.messages.map((m) => m.id));
            const optimistic = prev.filter((m) => !feedIds.has(m.id));
            if (optimistic.length === 0) return r.messages;
            return [...r.messages, ...optimistic].sort(
              (a, b) =>
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime(),
            );
          });
        }
      };
      setTimeout(quickPoll, 3000);
      setTimeout(quickPoll, 6000);
      setTimeout(quickPoll, 10000);
    },
    [businessId, selectedDepartmentId, isSending, conversationId],
  );

  // Handle load more messages
  const handleLoadMore = useCallback(async () => {
    if (!selectedDepartmentId || messages.length === 0) return;

    const oldestMessage = messages[0];
    const result = await getSlackFeedMessagesAction(
      businessId,
      selectedDepartmentId,
      50,
      oldestMessage.createdAt,
    );

    if ("messages" in result) {
      setMessages((prev) => [...result.messages, ...prev]);
      setHasMoreMessages(result.messages.length >= 50);
    }
  }, [businessId, selectedDepartmentId, messages]);

  // Determine channel name for input placeholder
  const channelDisplayName =
    selectedSlackChannel?.slackChannelName ??
    selectedChannel?.departmentName ??
    undefined;

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Channel sidebar */}
      <ChatChannelList
        channels={channels}
        selectedDepartmentId={selectedDepartmentId}
        onSelectDepartment={handleSelectDepartment}
        slackChannels={slackChannels}
      />

      {/* Message area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Channel header */}
        {selectedChannel && selectedSlackChannel && (
          <SlackChannelHeader
            channelName={selectedSlackChannel.slackChannelName}
            departmentName={selectedChannel.departmentName}
            slackChannelId={selectedSlackChannel.slackChannelId}
            slackTeamId={slackTeamId}
            isAgentFrozen={isAgentFrozen}
            hasActiveAgent={selectedChannel.hasActiveAgent}
          />
        )}

        {/* VPS offline banner (agents are offline but Slack is connected) */}
        {isVpsOffline && selectedChannel && (
          <div className="flex items-center gap-2 border-b bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
            <WifiOff className="size-3.5 shrink-0" />
            <span>
              Agents are offline -- messages will be saved and agent responses
              will be delivered when agents come back online
            </span>
          </div>
        )}

        {/* No channel selected */}
        {!selectedChannel && (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Select a channel to start chatting
          </div>
        )}

        {/* Message list */}
        {selectedChannel && (
          <>
            {isLoading ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Loading messages...
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <span>No messages yet</span>
                <span className="text-xs">
                  Send a message below or @mention the bot in Slack to start a conversation
                </span>
              </div>
            ) : (
              <ChatMessageList
                messages={messages}
                isAgentTyping={isAgentTyping}
                departmentName={selectedChannel.departmentName}
                onLoadMore={handleLoadMore}
                hasMoreMessages={hasMoreMessages}
              />
            )}

            {isHighDemand && (
              <div className="flex items-center justify-center gap-1.5 py-1 text-[11px] text-amber-600">
                <Loader2 className="size-3 animate-spin" />
                <span>High demand -- your message is being processed</span>
              </div>
            )}

            <ChatMessageInput
              onSendMessage={handleSendMessage}
              disabled={isDisabled || isAgentFrozen}
              disabledReason={
                isDisabled
                  ? "Business is suspended"
                  : isAgentFrozen
                    ? "Agent is frozen -- emergency action is active"
                    : undefined
              }
              isSending={isSending}
              channelName={channelDisplayName}
            />
          </>
        )}
      </div>
    </div>
  );
}
