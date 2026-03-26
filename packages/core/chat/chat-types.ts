// Chat type definitions for the command center chat interface.
// Client-safe -- no Supabase or server dependencies.

/** A chat conversation (one per department per user) */
export interface ChatConversation {
  id: string;
  businessId: string;
  departmentId: string;
  departmentName: string;
  departmentType: string;
  userId: string;
  title: string | null;
  status: "active" | "archived";
  lastMessageAt: string;
  messageCount: number;
  createdAt: string;
}

/** A single chat message */
export interface ChatMessage {
  id: string;
  conversationId: string;
  businessId: string;
  role: "user" | "agent" | "system";
  agentId: string | null;
  agentName: string | null;
  content: string;
  toolCalls: ToolCallTrace[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

/** A tool call trace for inline display */
export interface ToolCallTrace {
  toolName: string;
  summary: string;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
}

/** Stub response from the simulated agent */
export interface StubResponse {
  content: string;
  agentId: string;
  agentName: string;
  toolCalls: ToolCallTrace[];
}

/** Department channel info for sidebar */
export interface DepartmentChannel {
  departmentId: string;
  departmentName: string;
  departmentType: string;
  lastMessageAt: string | null;
  unreadCount: number;
  hasActiveAgent: boolean;
  agentFrozen: boolean;
}
