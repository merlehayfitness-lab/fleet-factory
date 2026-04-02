"use client";

import { Wrench, FileText, Bot, User, Loader2, AlertCircle } from "lucide-react";
import type { ChatMessage } from "@fleet-factory/core";
import { KnowledgeSourceFootnotes } from "./knowledge-source-footnotes";

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

/** Get initials from a name */
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Individual chat message in a flat Slack-like layout.
 *
 * All messages are left-aligned with avatar + name on top row, content below.
 * User messages show Slack username when available (from metadata.slackUser),
 * or "You" for admin-sent messages.
 * Agent messages show agent name with AI avatar.
 * System messages are centered, small muted text.
 * Tool call traces and knowledge source footnotes are preserved.
 */
export function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  const isAgent = message.role === "agent";
  const isSystem = message.role === "system";

  // System messages
  if (isSystem) {
    // Queue status messages (rate-limited)
    const isQueueStatus = message.metadata?.isQueueStatus;
    if (isQueueStatus) {
      try {
        const queueInfo = JSON.parse(message.content) as { type: string; position: number };
        return (
          <div className="flex justify-center my-2">
            <div className="flex items-center gap-2 rounded-full bg-amber-500/10 border border-amber-500/20 px-4 py-2 text-sm text-amber-600">
              <Loader2 className="size-4 animate-spin" />
              <span>Your message is queued (position #{queueInfo.position}). It will be processed shortly.</span>
            </div>
          </div>
        );
      } catch {
        // Fallback to normal system message
      }
    }

    // Budget-exceeded messages
    if (message.content.includes("token budget")) {
      return (
        <div className="flex justify-center my-2">
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-2 text-sm text-destructive">
            <AlertCircle className="size-4" />
            <span>{message.content}</span>
          </div>
        </div>
      );
    }

    return (
      <div className="flex justify-center py-2">
        <p className="text-xs text-muted-foreground bg-muted/50 rounded-full px-4 py-1.5">
          {message.content}
        </p>
      </div>
    );
  }

  // Derive display name and avatar info
  const slackUser = message.metadata?.slackUser as string | undefined;
  const isFromSlack = message.metadata?.source === "slack";

  let displayName: string;
  if (isAgent) {
    displayName = message.agentName ?? "Agent";
  } else if (isFromSlack && slackUser) {
    displayName = slackUser;
  } else {
    displayName = "You";
  }

  // File attachments from metadata (multi-file or legacy single-file)
  const filesArr = (message.metadata?.files as
    | { name: string; size: number; type: string; url?: string }[]
    | undefined) ?? (message.metadata?.file
    ? [message.metadata.file as { name: string; size: number; type: string; url?: string }]
    : []);

  return (
    <div className="flex gap-2.5 py-1.5 hover:bg-muted/20 rounded px-1 -mx-1">
      {/* Avatar */}
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5">
        {isAgent ? (
          message.agentName ? (
            <span className="text-[10px] font-bold">
              {getInitials(message.agentName)}
            </span>
          ) : (
            <Bot className="size-4" />
          )
        ) : (
          <User className="size-4" />
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-0.5">
        {/* Name + timestamp row */}
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-semibold">{displayName}</span>
          <span className="text-[10px] text-muted-foreground/60">
            {relativeTime(message.createdAt)}
          </span>
        </div>

        {/* Message content */}
        <p className="text-sm whitespace-pre-wrap text-foreground/90">
          {message.content?.trim()
            ? message.content
            : isAgent
              ? <span className="italic text-muted-foreground">(no response)</span>
              : message.content}
        </p>

        {/* File attachment cards */}
        {filesArr.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {filesArr.map((f, i) => {
              const hasUrl = f.url && f.url !== "pending";
              const Tag = hasUrl ? "a" : "div";
              const linkProps = hasUrl
                ? { href: f.url, target: "_blank", rel: "noopener noreferrer" }
                : {};
              return (
                <Tag
                  key={`${f.name}-${i}`}
                  {...linkProps}
                  className={`flex items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground w-fit ${hasUrl ? "hover:bg-muted/60 hover:border-primary/30 cursor-pointer transition-colors" : ""}`}
                >
                  <FileText className="size-3.5 shrink-0" />
                  <span className="truncate">{f.name}</span>
                  <span className="shrink-0 text-[10px]">
                    {(f.size / 1024).toFixed(1)}KB
                  </span>
                </Tag>
              );
            })}
          </div>
        )}

        {/* Tool call traces */}
        {isAgent && message.toolCalls.length > 0 && (
          <div className="space-y-1 pt-1">
            {message.toolCalls.map((trace, i) => (
              <div
                key={`${trace.toolName}-${i}`}
                className="flex items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground w-fit"
              >
                <Wrench className="size-3 shrink-0" />
                <span className="font-medium">{trace.toolName}</span>
                <span className="text-muted-foreground/70">--</span>
                <span>{trace.summary}</span>
              </div>
            ))}
          </div>
        )}

        {/* Knowledge source footnotes */}
        {isAgent &&
          Array.isArray(message.metadata?.knowledgeSources) &&
          (
            message.metadata.knowledgeSources as Array<{
              chunkId: string;
              documentId: string;
              documentTitle: string;
              chunkPreview: string;
              similarity: number;
            }>
          ).length > 0 && (
            <KnowledgeSourceFootnotes
              sources={
                message.metadata.knowledgeSources as Array<{
                  chunkId: string;
                  documentId: string;
                  documentTitle: string;
                  chunkPreview: string;
                  similarity: number;
                }>
              }
            />
          )}
      </div>
    </div>
  );
}
