"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Snowflake, Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ChatChannelList } from "./chat-channel-list";
import { ChatMessageList } from "./chat-message-list";
import { ChatMessageInput } from "./chat-message-input";
import {
  sendMessageAction,
  getMessagesAction,
  getDepartmentChannelsAction,
} from "@/_actions/chat-actions";
import type { ChatMessage, DepartmentChannel } from "@agency-factory/core";

interface ChatLayoutProps {
  businessId: string;
  businessName: string;
  channels: DepartmentChannel[];
}

/**
 * Full-page Slack-like chat layout with department channel sidebar and message area.
 *
 * Features:
 * - Department channel selection with unread badges
 * - Message list with auto-scroll and load more
 * - Typing indicator (1.5s delay before showing agent response)
 * - File upload support (metadata only for MVP)
 * - Frozen agent detection with disabled input
 * - Message polling every 10 seconds
 */
export function ChatLayout({
  businessId,
  businessName,
  channels: initialChannels,
}: ChatLayoutProps) {
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
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Get selected channel info
  const selectedChannel = channels.find(
    (c) => c.departmentId === selectedDepartmentId,
  );
  const isAgentFrozen = selectedChannel?.agentFrozen === true && !selectedChannel?.hasActiveAgent;

  // Load messages when department changes
  useEffect(() => {
    if (!selectedDepartmentId) return;

    let cancelled = false;
    setIsLoading(true);
    setMessages([]);
    setConversationId(null);
    setHasMoreMessages(false);

    // We need to get the conversation first, which happens on first message send.
    // For now, check if a conversation exists by fetching messages via a temporary action.
    // The sendMessageAction handles getOrCreateConversation.
    // To load existing messages, we check conversations via the channels action.
    async function loadExistingMessages() {
      // Get conversation for this department (by checking conversations)
      const result = await getDepartmentChannelsAction(businessId);
      if (cancelled) return;

      if ("channels" in result) {
        setChannels(result.channels);
      }

      // We need to find if there's an active conversation for this department
      // The getMessagesAction requires a conversationId, so we check via server
      // For now, we try to send a getMessages with a fake conversation to discover one
      // Better approach: use getConversationsAction and find by department
      const { getConversationsAction } = await import(
        "@/_actions/chat-actions"
      );
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

  // Message polling every 10 seconds
  useEffect(() => {
    if (!conversationId) return;

    pollingRef.current = setInterval(async () => {
      const result = await getMessagesAction(conversationId);
      if ("messages" in result) {
        setMessages((prev) => {
          // Merge new messages, avoiding duplicates by ID
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

  // Handle send message
  const handleSendMessage = useCallback(
    async (
      content: string,
      fileMetadata?: { name: string; size: number; type: string },
    ) => {
      if (!selectedDepartmentId || isSending) return;

      setIsSending(true);

      const result = await sendMessageAction(
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

      // Show typing indicator for 1.5 seconds then reveal agent response
      setIsAgentTyping(true);
      setTimeout(() => {
        setIsAgentTyping(false);
        setMessages((prev) => [...prev, result.agentMessage]);
      }, 1500);
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

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Channel sidebar */}
      <ChatChannelList
        channels={channels}
        selectedDepartmentId={selectedDepartmentId}
        onSelectDepartment={handleSelectDepartment}
      />

      {/* Message area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Channel header */}
        {selectedChannel && (
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">
                {selectedChannel.departmentName}
              </h2>
              {isAgentFrozen && (
                <>
                  <Snowflake className="size-3.5 text-blue-500" />
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                  >
                    Frozen
                  </Badge>
                </>
              )}
              {!selectedChannel.hasActiveAgent && !isAgentFrozen && (
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0"
                >
                  No active agent
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Bot className="size-3" />
              <span>{businessName}</span>
            </div>
          </div>
        )}

        {/* No channel selected */}
        {!selectedChannel && (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Select a department channel to start chatting
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
                isAgentTyping={isAgentTyping}
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
            />
          </>
        )}
      </div>
    </div>
  );
}
