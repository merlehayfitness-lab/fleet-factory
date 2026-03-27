import { MessageSquare } from "lucide-react";

/**
 * Conversations tab placeholder.
 *
 * Agent-level conversation history. Use the Chat page in the sidebar
 * to interact with agents via department channels.
 */
export function AgentConversations() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <MessageSquare className="mb-3 size-10 text-muted-foreground" />
      <p className="text-sm font-medium text-muted-foreground">
        Conversations will appear here
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Use the Chat page to interact with this agent
      </p>
    </div>
  );
}
