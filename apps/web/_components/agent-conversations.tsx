"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { createBrowserClient } from "@/_lib/supabase/client";

interface Conversation {
  id: string;
  title: string | null;
  status: string;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
}

interface AgentConversationsProps {
  businessId: string;
  departmentId: string;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Agent conversations tab.
 *
 * Shows conversations from the agent's department channel,
 * with links to continue chatting.
 */
export function AgentConversations({
  businessId,
  departmentId,
}: AgentConversationsProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    const supabase = createBrowserClient();
    const { data } = await supabase
      .from("conversations")
      .select("id, title, status, message_count, last_message_at, created_at")
      .eq("business_id", businessId)
      .eq("department_id", departmentId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(50);

    setConversations((data as Conversation[]) ?? []);
    setIsLoading(false);
  }, [businessId, departmentId]);

  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  if (isLoading) {
    return (
      <div className="space-y-2 pt-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <MessageSquare className="mb-3 size-10 text-muted-foreground" />
        <p className="text-sm font-medium text-muted-foreground">
          No conversations yet
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Use the{" "}
          <Link
            href={`/businesses/${businessId}/chat`}
            className="text-primary underline underline-offset-2"
          >
            Chat page
          </Link>{" "}
          to start a conversation with this agent
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1 pt-4">
      {conversations.map((conv) => (
        <Link
          key={conv.id}
          href={`/businesses/${businessId}/chat`}
          className="flex items-center justify-between rounded-md border px-4 py-3 transition-colors hover:bg-muted/50"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {conv.title || "Untitled conversation"}
            </p>
            <p className="text-xs text-muted-foreground">
              {conv.message_count} message{conv.message_count !== 1 ? "s" : ""}
              {conv.last_message_at && ` · ${relativeTime(conv.last_message_at)}`}
            </p>
          </div>
          <Badge
            variant={conv.status === "active" ? "default" : "secondary"}
            className="ml-3 shrink-0"
          >
            {conv.status}
          </Badge>
        </Link>
      ))}
    </div>
  );
}
