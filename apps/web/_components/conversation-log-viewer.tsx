"use client";

import { useState, useMemo, useCallback } from "react";
import {
  MessageSquare,
  Search,
  X,
  LayoutList,
  Table2,
  ChevronLeft,
  Bot,
  User,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ConversationEntry } from "@/_components/logs-page-client";

interface ConversationLogViewerProps {
  businessId: string;
  conversations: ConversationEntry[];
}

interface MessageEntry {
  id: string;
  role: string;
  content: string;
  agentName: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

/** Format relative time */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Format timestamp for table */
function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/**
 * Conversation log viewer with filters and transcript views.
 * Shows conversation list with client-side filtering by department and date.
 * Clicking a conversation shows transcript in chat replay or structured log view.
 */
export function ConversationLogViewer({
  businessId,
  conversations,
}: ConversationLogViewerProps) {
  // Filter state
  const [department, setDepartment] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");

  // Selected conversation
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageEntry[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [transcriptView, setTranscriptView] = useState<"chat" | "log">("chat");
  const [messageSearch, setMessageSearch] = useState("");

  // Derive unique departments for filter
  const departments = useMemo(() => {
    const depts = new Map<string, string>();
    for (const c of conversations) {
      depts.set(c.departmentId, c.departmentName);
    }
    return Array.from(depts.entries());
  }, [conversations]);

  // Filter conversations (client-side)
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      if (department && c.departmentId !== department) return false;
      if (dateFrom && c.createdAt < dateFrom) return false;
      if (dateTo && c.createdAt > dateTo) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchTitle = (c.title ?? "").toLowerCase().includes(q);
        const matchDept = c.departmentName.toLowerCase().includes(q);
        if (!matchTitle && !matchDept) return false;
      }
      return true;
    });
  }, [conversations, department, dateFrom, dateTo, search]);

  // Load messages for selected conversation
  const selectConversation = useCallback(
    async (conversationId: string) => {
      setSelectedId(conversationId);
      setLoadingMessages(true);
      setMessages([]);

      // Fetch messages -- this is a client-side call to our messages table
      // For now, since we don't have a dedicated server action,
      // we use the Supabase client via a dynamic import pattern
      // TODO: Create a getConversationMessages server action when chat is built (05-03)
      try {
        const { createBrowserClient } = await import("@/_lib/supabase/client");
        const supabase = createBrowserClient();
        const { data } = await supabase
          .from("messages")
          .select("id, role, content, agent_id, created_at, metadata, agents(name)")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const msgs: MessageEntry[] = (data ?? []).map((m: any) => {
          const agentData = Array.isArray(m.agents)
            ? m.agents[0]
            : m.agents;
          return {
            id: m.id as string,
            role: m.role as string,
            content: m.content as string,
            agentName: (agentData?.name as string) ?? null,
            createdAt: m.created_at as string,
            metadata: (m.metadata as Record<string, unknown>) ?? {},
          };
        });
        setMessages(msgs);
      } catch {
        // If messages table doesn't exist or error, show empty
        setMessages([]);
      }
      setLoadingMessages(false);
    },
    [],
  );

  const selectedConversation = conversations.find((c) => c.id === selectedId);

  // Filter messages by search
  const filteredMessages = useMemo(() => {
    if (!messageSearch) return messages;
    const q = messageSearch.toLowerCase();
    return messages.filter((m) => m.content.toLowerCase().includes(q));
  }, [messages, messageSearch]);

  const clearFilters = () => {
    setDepartment("");
    setDateFrom("");
    setDateTo("");
    setSearch("");
  };

  const hasFilters = department || dateFrom || dateTo || search;

  // If no conversations exist
  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-sm text-muted-foreground">
        <MessageSquare className="mb-3 size-10" />
        <p className="font-medium">No conversations yet</p>
        <p className="mt-1 text-xs">
          Start chatting in the Command Center to see conversations here.
        </p>
      </div>
    );
  }

  // Conversation detail view
  if (selectedId && selectedConversation) {
    return (
      <div className="space-y-4">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedId(null)}
          className="gap-1 text-xs"
        >
          <ChevronLeft className="size-3.5" />
          Back to conversations
        </Button>

        {/* Conversation header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">
              {selectedConversation.title ?? "Untitled conversation"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {selectedConversation.departmentName} &middot;{" "}
              {relativeTime(selectedConversation.updatedAt)}
            </p>
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border">
              <button
                type="button"
                onClick={() => setTranscriptView("chat")}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors rounded-l-lg",
                  transcriptView === "chat"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted",
                )}
              >
                <MessageSquare className="size-3.5" />
                Chat
              </button>
              <button
                type="button"
                onClick={() => setTranscriptView("log")}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors rounded-r-lg",
                  transcriptView === "log"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted",
                )}
              >
                <LayoutList className="size-3.5" />
                Log
              </button>
            </div>
          </div>
        </div>

        {/* Message search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search messages..."
            value={messageSearch}
            onChange={(e) => setMessageSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>

        {/* Transcript */}
        {loadingMessages ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            Loading messages...
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            No messages in this conversation
          </div>
        ) : transcriptView === "chat" ? (
          <ChatReplayView messages={filteredMessages} />
        ) : (
          <StructuredLogView messages={filteredMessages} />
        )}
      </div>
    );
  }

  // Conversation list view
  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-end gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>

        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="h-8 min-w-[130px] rounded-lg border border-input bg-transparent px-2 text-xs outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
        >
          <option value="">All departments</option>
          {departments.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>

        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="h-8 text-xs w-[130px]"
        />

        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="h-8 text-xs w-[130px]"
        />

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="gap-1 text-xs text-muted-foreground"
          >
            <X className="size-3" />
            Clear
          </Button>
        )}
      </div>

      {/* Results */}
      <p className="text-xs text-muted-foreground">
        {filteredConversations.length} conversation
        {filteredConversations.length !== 1 ? "s" : ""}
      </p>

      {filteredConversations.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          No conversations match filters
        </div>
      ) : (
        <div className="space-y-2">
          {filteredConversations.map((conv) => (
            <Card
              key={conv.id}
              className="cursor-pointer transition-colors hover:bg-accent/50"
              onClick={() => selectConversation(conv.id)}
            >
              <CardHeader className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                    <CardTitle className="text-sm truncate">
                      {conv.title ?? "Untitled"}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0"
                    >
                      {conv.departmentName}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[10px] px-1.5 py-0",
                        conv.status === "active"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
                      )}
                    >
                      {conv.status}
                    </Badge>
                  </div>
                </div>
                <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground pl-6">
                  <span>{conv.messageCount} messages</span>
                  <span>Last activity: {relativeTime(conv.updatedAt)}</span>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/** Chat replay view -- renders messages as chat bubbles */
function ChatReplayView({ messages }: { messages: MessageEntry[] }) {
  return (
    <div className="space-y-3 max-w-2xl">
      {messages.map((msg) => {
        const isAgent = msg.role === "agent";
        const isSystem = msg.role === "system";

        return (
          <div
            key={msg.id}
            className={cn(
              "flex gap-2",
              isAgent ? "justify-start" : "justify-end",
              isSystem && "justify-center",
            )}
          >
            {isAgent && (
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Bot className="size-4 text-primary" />
              </div>
            )}

            <div
              className={cn(
                "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                isAgent && "bg-muted",
                !isAgent && !isSystem && "bg-primary text-primary-foreground",
                isSystem && "bg-amber-50 text-amber-800 text-xs dark:bg-amber-900/20 dark:text-amber-400",
              )}
            >
              {isAgent && msg.agentName && (
                <p className="text-[10px] font-medium text-muted-foreground mb-0.5">
                  {msg.agentName}
                </p>
              )}
              <p className="whitespace-pre-wrap">{msg.content}</p>
              <p
                className={cn(
                  "mt-1 text-[10px]",
                  isAgent
                    ? "text-muted-foreground"
                    : isSystem
                      ? "text-amber-600"
                      : "text-primary-foreground/70",
                )}
              >
                {relativeTime(msg.createdAt)}
              </p>
            </div>

            {!isAgent && !isSystem && (
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                <User className="size-4 text-muted-foreground" />
              </div>
            )}

            {isSystem && (
              <Settings className="size-3.5 shrink-0 text-amber-600 mt-1" />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Structured log view -- table with metadata per message */
function StructuredLogView({ messages }: { messages: MessageEntry[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Timestamp</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Agent</TableHead>
          <TableHead>Content</TableHead>
          <TableHead>Tool Calls</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {messages.map((msg) => (
          <TableRow key={msg.id} className="text-xs">
            <TableCell className="font-mono text-[11px]">
              {formatTimestamp(msg.createdAt)}
            </TableCell>
            <TableCell>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {msg.role}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {msg.agentName ?? "-"}
            </TableCell>
            <TableCell className="max-w-[300px] truncate">
              {msg.content}
            </TableCell>
            <TableCell className="text-muted-foreground text-[11px]">
              {msg.metadata?.tool_calls
                ? JSON.stringify(msg.metadata.tool_calls)
                : "-"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
