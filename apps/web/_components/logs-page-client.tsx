"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AuditLogViewer } from "@/_components/audit-log-viewer";
import { ConversationLogViewer } from "@/_components/conversation-log-viewer";
import type { AuditLogEntry } from "@/_actions/log-actions";
import { ScrollText, MessageSquare } from "lucide-react";

export interface ConversationEntry {
  id: string;
  title: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  departmentId: string;
  departmentName: string;
  messageCount: number;
}

interface LogsPageClientProps {
  businessId: string;
  initialLogs: AuditLogEntry[];
  conversations: ConversationEntry[];
}

/**
 * Client-side tabbed layout for the logs page.
 * Tab 1: Audit Log - shows the AuditLogViewer
 * Tab 2: Conversations - shows the ConversationLogViewer
 */
export function LogsPageClient({
  businessId,
  initialLogs,
  conversations,
}: LogsPageClientProps) {
  return (
    <Tabs defaultValue="audit-log">
      <TabsList>
        <TabsTrigger value="audit-log">
          <ScrollText className="size-3.5" />
          Audit Log
        </TabsTrigger>
        <TabsTrigger value="conversations">
          <MessageSquare className="size-3.5" />
          Conversations
        </TabsTrigger>
      </TabsList>

      <TabsContent value="audit-log" className="mt-4">
        <AuditLogViewer businessId={businessId} initialLogs={initialLogs} />
      </TabsContent>

      <TabsContent value="conversations" className="mt-4">
        <ConversationLogViewer
          businessId={businessId}
          conversations={conversations}
        />
      </TabsContent>
    </Tabs>
  );
}
