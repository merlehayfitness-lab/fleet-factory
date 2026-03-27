"use client";

import { useEffect, useRef } from "react";
import { MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessageBubble } from "./chat-message-bubble";
import type { ChatMessage } from "@agency-factory/core";

interface ChatMessageListProps {
  messages: ChatMessage[];
  isAgentTyping: boolean;
  departmentName: string;
  onLoadMore: () => void;
  hasMoreMessages: boolean;
  streamingContent?: string | null;
  streamingAgentName?: string | null;
}

/**
 * Scrollable message area with bubbles, agent labels, and tool call traces.
 *
 * Features:
 * - Auto-scroll to bottom on new messages
 * - "Load more" button at top for pagination
 * - Typing indicator with animated dots
 * - Empty state when no messages
 */
export function ChatMessageList({
  messages,
  isAgentTyping,
  departmentName,
  onLoadMore,
  hasMoreMessages,
  streamingContent = null,
  streamingAgentName = null,
}: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(messages.length);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > prevCountRef.current || messages.length === 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevCountRef.current = messages.length;
  }, [messages.length]);

  // Scroll to bottom on typing indicator or streaming content
  useEffect(() => {
    if (isAgentTyping || streamingContent !== null) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isAgentTyping, streamingContent]);

  return (
    <ScrollArea className="flex-1 overflow-hidden">
      <div className="flex flex-col p-4 space-y-1">
        {/* Load more button */}
        {hasMoreMessages && (
          <div className="flex justify-center pb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onLoadMore}
              className="text-xs text-muted-foreground"
            >
              Load older messages
            </Button>
          </div>
        )}

        {/* Empty state */}
        {messages.length === 0 && !isAgentTyping && (
          <div className="flex flex-1 flex-col items-center justify-center py-20 text-muted-foreground">
            <MessageSquare className="size-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No messages yet</p>
            <p className="text-xs mt-1">
              Start the conversation with {departmentName}!
            </p>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg) => (
          <ChatMessageBubble key={msg.id} message={msg} />
        ))}

        {/* Streaming message from VPS WebSocket */}
        {streamingContent !== null && (
          <div className="flex flex-col gap-0.5 py-1 pl-2">
            {streamingAgentName && (
              <span className="pl-7 text-[10px] font-medium text-muted-foreground">
                {streamingAgentName}
              </span>
            )}
            <div className="flex items-start gap-2">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                AI
              </div>
              <div className="max-w-[75%] rounded-lg bg-muted/60 px-3 py-2 text-sm">
                {streamingContent}
                <span className="inline-block w-1.5 h-4 ml-0.5 bg-primary/60 animate-pulse" />
              </div>
            </div>
          </div>
        )}

        {/* Typing indicator */}
        {isAgentTyping && streamingContent === null && (
          <div className="flex items-center gap-2 py-2 pl-9">
            <div className="flex items-center gap-1.5 rounded-lg bg-muted/60 px-3 py-2">
              <Loader2 className="size-3 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Agent is thinking
              </span>
              <span className="flex gap-0.5">
                <span className="size-1 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
                <span className="size-1 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
                <span className="size-1 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
              </span>
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
