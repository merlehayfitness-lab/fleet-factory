import { MessageSquare } from "lucide-react";

/**
 * Conversations tab placeholder.
 *
 * The conversations table does not exist yet -- this will be implemented
 * in Phase 5 alongside the command center chat feature.
 */
export function AgentConversations() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <MessageSquare className="mb-3 size-10 text-muted-foreground" />
      <p className="text-sm font-medium text-muted-foreground">
        Conversations will appear here
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        The command center chat will be available in Phase 5
      </p>
    </div>
  );
}
