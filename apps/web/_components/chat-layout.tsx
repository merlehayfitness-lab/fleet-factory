"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { WifiOff } from "lucide-react";
import { ChatChannelList } from "./chat-channel-list";
import { ChatMessageList } from "./chat-message-list";
import { ChatMessageInput } from "./chat-message-input";
import { SlackConnectPrompt } from "./slack-connect-prompt";
import { SlackChannelHeader } from "./slack-channel-header";
import {
  getMessagesAction,
  getDepartmentChannelsAction,
  getConversationsAction,
  sendSlackMessageAction,
} from "@/_actions/chat-actions";
import type { ChatMessage, DepartmentChannel, SlackConnectionStatus, SlackChannelMapping } from "@agency-factory/core";

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
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isVpsOffline = vpsStatus?.status === "offline";

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

    async function loadExistingMessages() {
      // Refresh channels
      const result = await getDepartmentChannelsAction(businessId);
      if (cancelled) return;

      if ("channels" in result) {
        setChannels(result.channels);
      }

      // Find active conversation for this department
      const convResult = await getConversationsAction(businessId);
      if (cancelled) return;

      if ("conversations" in convResult) {
        const conv = convResult.conversations.find(
          (c) =>
            c.departmentId === selectedDepartmentId && c.status === "active",
        );
        if (conv) {
          setConversationId(conv.id);
          const msgResult = await getMessagesAction(conv.id);
          if (cancelled) return;
          if ("messages" in msgResult) {
            setMessages(msgResult.messages);
            setHasMoreMessages(msgResult.messages.length >= 50);
          }
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
    if (!conversationId) return;

    pollingRef.current = setInterval(async () => {
      const result = await getMessagesAction(conversationId);
      if ("messages" in result) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newMsgs = result.messages.filter(
            (m) => !existingIds.has(m.id),
          );
          if (newMsgs.length > 0) {
            return [...prev, ...newMsgs];
          }
          return prev;
        });
      }
    }, 10000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [conversationId]);

  // Handle department selection
  const handleSelectDepartment = useCallback((departmentId: string) => {
    setSelectedDepartmentId(departmentId);
  }, []);

  // Handle send message via Slack
  const handleSendMessage = useCallback(
    async (
      content: string,
      fileMetadata?: { name: string; size: number; type: string },
    ) => {
      if (!selectedDepartmentId || isSending) return;

      setIsSending(true);

      const result = await sendSlackMessageAction(
        businessId,
        selectedDepartmentId,
        content,
        fileMetadata,
      );

      if ("error" in result) {
        setIsSending(false);
        return;
      }

      // Show user message immediately
      setMessages((prev) => [...prev, result.userMessage]);

      // Update conversation ID if this is the first message
      if (!conversationId && result.userMessage.conversationId) {
        setConversationId(result.userMessage.conversationId);
      }

      setIsSending(false);
      // Agent response comes asynchronously via Slack events + polling
    },
    [businessId, selectedDepartmentId, isSending, conversationId],
  );

  // Handle load more messages
  const handleLoadMore = useCallback(async () => {
    if (!conversationId || messages.length === 0) return;

    const oldestMessage = messages[0];
    const result = await getMessagesAction(
      conversationId,
      oldestMessage.createdAt,
    );

    if ("messages" in result) {
      setMessages((prev) => [...result.messages, ...prev]);
      setHasMoreMessages(result.messages.length >= 50);
    }
  }, [conversationId, messages]);

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
            ) : (
              <ChatMessageList
                messages={messages}
                isAgentTyping={false}
                departmentName={selectedChannel.departmentName}
                onLoadMore={handleLoadMore}
                hasMoreMessages={hasMoreMessages}
              />
            )}

            <ChatMessageInput
              onSendMessage={handleSendMessage}
              disabled={isAgentFrozen}
              disabledReason={
                isAgentFrozen
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
