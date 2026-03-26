"use client";

import { Wrench, FileText, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@agency-factory/core";

interface ChatMessageBubbleProps {
  message: ChatMessage;
}

/** Format relative time from ISO string */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Get initials from agent name */
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Individual chat message bubble.
 *
 * User messages: right-aligned, accent background.
 * Agent messages: left-aligned, muted background, with avatar and agent name label.
 * System messages: centered, small muted text.
 * Includes tool call traces as compact cards and file attachment cards.
 */
export function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  const isUser = message.role === "user";
  const isAgent = message.role === "agent";
  const isSystem = message.role === "system";

  // System messages
  if (isSystem) {
    return (
      <div className="flex justify-center py-2">
        <p className="text-xs text-muted-foreground bg-muted/50 rounded-full px-4 py-1.5">
          {message.content}
        </p>
      </div>
    );
  }

  // File attachment from metadata
  const fileInfo = message.metadata?.file as
    | { name: string; size: number; type: string }
    | undefined;

  return (
    <div
      className={cn(
        "flex gap-2 py-1.5",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      {/* Agent avatar */}
      {isAgent && (
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-5">
          {message.agentName ? (
            <span className="text-[10px] font-bold">
              {getInitials(message.agentName)}
            </span>
          ) : (
            <Bot className="size-3.5" />
          )}
        </div>
      )}

      <div
        className={cn(
          "max-w-[75%] space-y-1",
          isUser ? "items-end" : "items-start",
        )}
      >
        {/* Agent name label */}
        {isAgent && message.agentName && (
          <p className="text-[11px] font-medium text-muted-foreground pl-1">
            {message.agentName}
          </p>
        )}

        {/* Message bubble */}
        <div
          className={cn(
            "rounded-lg px-3 py-2 text-sm",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted/60 text-foreground",
          )}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* File attachment card */}
        {fileInfo && (
          <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground">
            <FileText className="size-3.5 shrink-0" />
            <span className="truncate">{fileInfo.name}</span>
            <span className="shrink-0 text-[10px]">
              {(fileInfo.size / 1024).toFixed(1)}KB
            </span>
          </div>
        )}

        {/* Tool call traces */}
        {isAgent && message.toolCalls.length > 0 && (
          <div className="space-y-1 pt-0.5">
            {message.toolCalls.map((trace, i) => (
              <div
                key={`${trace.toolName}-${i}`}
                className="flex items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground"
              >
                <Wrench className="size-3 shrink-0" />
                <span className="font-medium">{trace.toolName}</span>
                <span className="text-muted-foreground/70">--</span>
                <span>{trace.summary}</span>
              </div>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <p
          className={cn(
            "text-[10px] text-muted-foreground/60 pt-0.5",
            isUser ? "text-right pr-1" : "pl-1",
          )}
        >
          {relativeTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}
