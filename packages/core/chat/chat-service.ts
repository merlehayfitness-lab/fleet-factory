// Chat CRUD service for conversations and messages.
// All functions accept SupabaseClient as first argument (server-only pattern).

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ChatConversation,
  ChatMessage,
  DepartmentChannel,
  ToolCallTrace,
} from "./chat-types";
import type { RetrievedContext } from "../knowledge/knowledge-types";
import { selectAgent } from "../orchestrator/router";
import { generateStubResponse } from "./chat-stub";
import { isVpsConfigured } from "../vps/vps-config";

import { getVpsAgentId, sendChatToVps } from "../vps/vps-chat";

/**
 * Get or create a conversation for a business + department + user.
 * Creates one conversation per department per user and reuses existing active ones.
 */
export async function getOrCreateConversation(
  supabase: SupabaseClient,
  businessId: string,
  departmentId: string,
  userId: string,
): Promise<ChatConversation> {
  // Check for existing active conversation
  const { data: existing, error: fetchError } = await supabase
    .from("conversations")
    .select(
      "id, business_id, department_id, user_id, title, status, last_message_at, message_count, created_at",
    )
    .eq("business_id", businessId)
    .eq("department_id", departmentId)
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1);

  if (fetchError) {
    throw new Error(
      `Failed to fetch conversation: ${fetchError.message}`,
    );
  }

  if (existing && existing.length > 0) {
    const conv = existing[0];
    // Fetch department info for the response
    const { data: dept } = await supabase
      .from("departments")
      .select("name, type")
      .eq("id", departmentId)
      .single();

    return {
      id: conv.id as string,
      businessId: conv.business_id as string,
      departmentId: conv.department_id as string,
      departmentName: (dept?.name as string) ?? "Unknown",
      departmentType: (dept?.type as string) ?? "custom",
      userId: conv.user_id as string,
      title: conv.title as string | null,
      status: conv.status as "active" | "archived",
      lastMessageAt: conv.last_message_at as string,
      messageCount: conv.message_count as number,
      createdAt: conv.created_at as string,
    };
  }

  // Create new conversation
  const { data: newConv, error: insertError } = await supabase
    .from("conversations")
    .insert({
      business_id: businessId,
      department_id: departmentId,
      user_id: userId,
      status: "active",
    })
    .select(
      "id, business_id, department_id, user_id, title, status, last_message_at, message_count, created_at",
    )
    .single();

  if (insertError || !newConv) {
    throw new Error(
      `Failed to create conversation: ${insertError?.message ?? "No data returned"}`,
    );
  }

  // Fetch department info
  const { data: dept } = await supabase
    .from("departments")
    .select("name, type")
    .eq("id", departmentId)
    .single();

  return {
    id: newConv.id as string,
    businessId: newConv.business_id as string,
    departmentId: newConv.department_id as string,
    departmentName: (dept?.name as string) ?? "Unknown",
    departmentType: (dept?.type as string) ?? "custom",
    userId: newConv.user_id as string,
    title: newConv.title as string | null,
    status: newConv.status as "active" | "archived",
    lastMessageAt: newConv.last_message_at as string,
    messageCount: newConv.message_count as number,
    createdAt: newConv.created_at as string,
  };
}

/**
 * Send a message in a conversation.
 * Creates the message record and updates conversation counters.
 */
export async function sendMessage(
  supabase: SupabaseClient,
  businessId: string,
  conversationId: string,
  content: string,
  role: "user" | "agent" | "system",
  agentId?: string,
  toolCalls?: ToolCallTrace[],
  metadata?: Record<string, unknown>,
): Promise<ChatMessage> {
  // Insert message
  const { data: msg, error: insertError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      business_id: businessId,
      role,
      agent_id: agentId ?? null,
      content,
      tool_calls: toolCalls ?? [],
      metadata: metadata ?? {},
    })
    .select("id, conversation_id, business_id, role, agent_id, content, tool_calls, metadata, created_at")
    .single();

  if (insertError || !msg) {
    throw new Error(
      `Failed to send message: ${insertError?.message ?? "No data returned"}`,
    );
  }

  // Update conversation counters and auto-title from first user message
  try {
    const update: Record<string, unknown> = {
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Auto-set title from first user message if untitled
    if (role === "user") {
      const { data: conv } = await supabase
        .from("conversations")
        .select("title")
        .eq("id", conversationId)
        .single();
      if (!conv?.title) {
        update.title = content.length > 60 ? `${content.slice(0, 57)}...` : content;
      }
    }

    await supabase
      .from("conversations")
      .update(update)
      .eq("id", conversationId);
  } catch {
    // Best-effort counter update -- message is already saved
    console.error("Failed to update conversation counters");
  }

  // Fetch agent name if this is an agent message
  let agentName: string | null = null;
  if (agentId) {
    const { data: agent } = await supabase
      .from("agents")
      .select("name")
      .eq("id", agentId)
      .single();
    agentName = (agent?.name as string) ?? null;
  }

  return {
    id: msg.id as string,
    conversationId: msg.conversation_id as string,
    businessId: msg.business_id as string,
    role: msg.role as "user" | "agent" | "system",
    agentId: (msg.agent_id as string) ?? null,
    agentName,
    content: msg.content as string,
    toolCalls: (msg.tool_calls as ToolCallTrace[]) ?? [],
    metadata: (msg.metadata as Record<string, unknown>) ?? {},
    createdAt: msg.created_at as string,
  };
}

/**
 * Get messages for a conversation with pagination.
 * Returns messages ordered by created_at ASC (oldest first).
 */
export async function getMessages(
  supabase: SupabaseClient,
  conversationId: string,
  limit = 50,
  before?: string,
): Promise<ChatMessage[]> {
  let query = supabase
    .from("messages")
    .select(
      "id, conversation_id, business_id, role, agent_id, content, tool_calls, metadata, created_at",
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (before) {
    query = query.lt("created_at", before);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch messages: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Batch fetch agent names for agent messages
  const agentIds = [
    ...new Set(
      data
        .filter((m) => m.agent_id)
        .map((m) => m.agent_id as string),
    ),
  ];
  const agentNameMap = new Map<string, string>();
  if (agentIds.length > 0) {
    const { data: agents } = await supabase
      .from("agents")
      .select("id, name")
      .in("id", agentIds);
    for (const agent of agents ?? []) {
      agentNameMap.set(agent.id as string, agent.name as string);
    }
  }

  return data.map((m) => ({
    id: m.id as string,
    conversationId: m.conversation_id as string,
    businessId: m.business_id as string,
    role: m.role as "user" | "agent" | "system",
    agentId: (m.agent_id as string) ?? null,
    agentName: m.agent_id
      ? agentNameMap.get(m.agent_id as string) ?? null
      : null,
    content: m.content as string,
    toolCalls: (m.tool_calls as ToolCallTrace[]) ?? [],
    metadata: (m.metadata as Record<string, unknown>) ?? {},
    createdAt: m.created_at as string,
  }));
}

/**
 * Get all conversations for a business.
 * Returns conversations ordered by last_message_at DESC.
 */
export async function getConversationsForBusiness(
  supabase: SupabaseClient,
  businessId: string,
): Promise<ChatConversation[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id, business_id, department_id, user_id, title, status, last_message_at, message_count, created_at",
    )
    .eq("business_id", businessId)
    .order("last_message_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch conversations: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Batch fetch department info
  const deptIds = [
    ...new Set(data.map((c) => c.department_id as string)),
  ];
  const deptMap = new Map<
    string,
    { name: string; type: string }
  >();
  if (deptIds.length > 0) {
    const { data: depts } = await supabase
      .from("departments")
      .select("id, name, type")
      .in("id", deptIds);
    for (const dept of depts ?? []) {
      deptMap.set(dept.id as string, {
        name: dept.name as string,
        type: dept.type as string,
      });
    }
  }

  return data.map((c) => {
    const dept = deptMap.get(c.department_id as string);
    return {
      id: c.id as string,
      businessId: c.business_id as string,
      departmentId: c.department_id as string,
      departmentName: dept?.name ?? "Unknown",
      departmentType: dept?.type ?? "custom",
      userId: c.user_id as string,
      title: c.title as string | null,
      status: c.status as "active" | "archived",
      lastMessageAt: c.last_message_at as string,
      messageCount: c.message_count as number,
      createdAt: c.created_at as string,
    };
  });
}

/**
 * Archive a conversation.
 * Updates status to 'archived' and creates an audit log entry.
 */
export async function archiveConversation(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<void> {
  // Get conversation for audit log
  const { data: conv } = await supabase
    .from("conversations")
    .select("business_id")
    .eq("id", conversationId)
    .single();

  const { error } = await supabase
    .from("conversations")
    .update({
      status: "archived",
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  if (error) {
    throw new Error(`Failed to archive conversation: ${error.message}`);
  }

  // Audit log (best-effort)
  if (conv) {
    try {
      await supabase.from("audit_logs").insert({
        business_id: conv.business_id,
        action: "conversation.archived",
        entity_type: "conversation",
        entity_id: conversationId,
        metadata: {},
      });
    } catch {
      console.error("Failed to create conversation archive audit log");
    }
  }
}

/**
 * Get department channels for a business with unread counts.
 * Returns all departments with conversation status and agent health info.
 */
export async function getDepartmentChannels(
  supabase: SupabaseClient,
  businessId: string,
  userId: string,
): Promise<DepartmentChannel[]> {
  // Fetch all departments for this business
  const { data: departments, error: deptError } = await supabase
    .from("departments")
    .select("id, name, type")
    .eq("business_id", businessId)
    .order("name");

  if (deptError) {
    throw new Error(`Failed to fetch departments: ${deptError.message}`);
  }

  if (!departments || departments.length === 0) {
    return [];
  }

  // Fetch active conversations for this user in this business
  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, department_id, last_message_at, message_count")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .eq("status", "active");

  // Build conversation map by department
  const convMap = new Map<
    string,
    { id: string; lastMessageAt: string; messageCount: number }
  >();
  for (const conv of conversations ?? []) {
    convMap.set(conv.department_id as string, {
      id: conv.id as string,
      lastMessageAt: conv.last_message_at as string,
      messageCount: conv.message_count as number,
    });
  }

  // Fetch agent status per department
  const { data: agents } = await supabase
    .from("agents")
    .select("id, department_id, status")
    .eq("business_id", businessId);

  // Build agent status map by department
  const agentStatusMap = new Map<
    string,
    { hasActive: boolean; hasFrozen: boolean }
  >();
  for (const agent of agents ?? []) {
    const deptId = agent.department_id as string;
    const current = agentStatusMap.get(deptId) ?? {
      hasActive: false,
      hasFrozen: false,
    };
    if (agent.status === "active") current.hasActive = true;
    if (agent.status === "frozen") current.hasFrozen = true;
    agentStatusMap.set(deptId, current);
  }

  // Compute unread counts: count agent messages after the user's last message in each conversation
  const channels: DepartmentChannel[] = [];
  for (const dept of departments) {
    const deptId = dept.id as string;
    const conv = convMap.get(deptId);
    const agentStatus = agentStatusMap.get(deptId) ?? {
      hasActive: false,
      hasFrozen: false,
    };

    let unreadCount = 0;
    if (conv) {
      // Get the user's last message timestamp
      const { data: lastUserMsg } = await supabase
        .from("messages")
        .select("created_at")
        .eq("conversation_id", conv.id)
        .eq("role", "user")
        .order("created_at", { ascending: false })
        .limit(1);

      if (lastUserMsg && lastUserMsg.length > 0) {
        // Count agent messages after the user's last message
        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", conv.id)
          .eq("role", "agent")
          .gt("created_at", lastUserMsg[0].created_at as string);
        unreadCount = count ?? 0;
      }
    }

    channels.push({
      departmentId: deptId,
      departmentName: dept.name as string,
      departmentType: dept.type as string,
      lastMessageAt: conv?.lastMessageAt ?? null,
      unreadCount,
      hasActiveAgent: agentStatus.hasActive,
      agentFrozen: agentStatus.hasFrozen,
    });
  }

  return channels;
}

// --- Agent Self-Naming Detection ---

/** Words that commonly start sentences but aren't agent names */
const FALSE_POSITIVE_NAMES = new Set([
  "Here", "Sorry", "Happy", "Sure", "Great", "Thank", "Thanks",
  "Yes", "No", "Hello", "Hi", "Hey", "Well", "OK", "Okay",
  "Absolutely", "Certainly", "Unfortunately", "However", "Actually",
  "Please", "Let", "Now", "First", "Just", "Right", "Good",
]);

/**
 * Detect an agent self-naming declaration in a message.
 *
 * Matches patterns like:
 * - "I'm **Quota Quinn**"
 * - "I am Quota Quinn"
 * - "Call me Sales Bot"
 * - "My name is Revenue Rex"
 *
 * Returns the extracted name or null if no match.
 */
export function detectAgentName(content: string): string | null {
  // Patterns: "I'm [Name]", "I am [Name]", "Call me [Name]", "My name is [Name]"
  // Names can be wrapped in ** markdown bold **
  const patterns = [
    /\bI['']m\s+\*{0,2}([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})\*{0,2}/,
    /\bI am\s+\*{0,2}([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})\*{0,2}/,
    /\bCall me\s+\*{0,2}([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})\*{0,2}/i,
    /\bMy name is\s+\*{0,2}([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})\*{0,2}/i,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match?.[1]) {
      const name = match[1].trim();
      const firstName = name.split(" ")[0];
      if (FALSE_POSITIVE_NAMES.has(firstName)) continue;
      if (name.length < 2 || name.length > 50) continue;
      return name;
    }
  }

  return null;
}

/**
 * Try to detect and persist an agent self-naming from a response.
 * Best-effort: errors are logged but never thrown.
 * Mutates agentMessage.agentName in-place so Slack posts use the new name.
 */
async function tryDetectSelfName(
  supabase: SupabaseClient,
  agentMessage: ChatMessage,
  businessId: string,
): Promise<void> {
  if (!agentMessage.agentId) return;

  const detectedName = detectAgentName(agentMessage.content);
  if (!detectedName) return;

  try {
    const { updateAgentName } = await import("../agent/service");
    await updateAgentName(supabase, agentMessage.agentId, businessId, detectedName);
    // Mutate in-place so the current Slack post uses the new name
    agentMessage.agentName = detectedName;
  } catch (err) {
    console.error("Agent self-naming failed (non-fatal):", err);
  }
}

/**
 * Route a user message to the appropriate agent and generate a stub response.
 *
 * Uses the orchestrator's selectAgent to find the right agent in the department.
 * If the agent is frozen, returns a system message.
 * Otherwise, generates a department-appropriate stub response.
 */
export async function routeAndRespond(
  supabase: SupabaseClient,
  businessId: string,
  departmentId: string,
  conversationId: string,
  userMessage: string,
): Promise<ChatMessage> {
  // Get department type for stub response
  const { data: dept } = await supabase
    .from("departments")
    .select("type")
    .eq("id", departmentId)
    .single();
  const departmentType = (dept?.type as string) ?? "owner";

  // Check for frozen agents in the department
  const { data: frozenAgents } = await supabase
    .from("agents")
    .select("id, name, status")
    .eq("department_id", departmentId)
    .eq("business_id", businessId)
    .eq("status", "frozen")
    .limit(1);

  // Try to select an agent (active first, then provisioning for stub responses)
  let agent: { id: string; name: string; status: string } | null = null;
  try {
    agent = await selectAgent(supabase, departmentId, businessId);
  } catch {
    // No active agent found
  }

  // Fallback: try provisioning agents for stub chat (they exist but haven't deployed yet)
  if (!agent) {
    const { data: provAgents } = await supabase
      .from("agents")
      .select("id, name, status")
      .eq("department_id", departmentId)
      .eq("business_id", businessId)
      .eq("status", "provisioning")
      .limit(1);
    if (provAgents && provAgents.length > 0) {
      agent = provAgents[0] as { id: string; name: string; status: string };
    }
  }

  // If no active agent but frozen agents exist, return frozen message
  if (!agent && frozenAgents && frozenAgents.length > 0) {
    return sendMessage(
      supabase,
      businessId,
      conversationId,
      "This agent has been frozen. Contact an admin to restore access.",
      "system",
    );
  }

  // If no agent at all, return a system message
  if (!agent) {
    return sendMessage(
      supabase,
      businessId,
      conversationId,
      "No active agent available in this department. Please contact an administrator.",
      "system",
    );
  }

  // --- RAG Knowledge Injection ---
  // Retrieve relevant knowledge context before routing to agent
  let knowledgeContext: RetrievedContext | null = null;
  try {
    const { retrieveKnowledgeContext } = await import("../knowledge/retriever");
    knowledgeContext = await retrieveKnowledgeContext(
      supabase,
      businessId,
      agent.id,
      userMessage,
      { conversationId },
    );
  } catch (err) {
    // Best-effort: if retrieval fails (e.g., no OPENAI_API_KEY), continue without context
    console.error("Knowledge retrieval failed, proceeding without context:", err);
  }

  // Route to VPS agent if configured (skip health check -- sendChatToVps handles errors)
  if (isVpsConfigured()) {
    try {
      const vpsAgentId = await getVpsAgentId(supabase, agent.id);
      if (vpsAgentId) {
          // Extract model from agent's model_profile (falls back to sonnet)
          const agentModel =
            ((agent as Record<string, unknown>).model_profile as Record<string, unknown>)
              ?.model as string | undefined;

          const vpsResponse = await sendChatToVps(
            businessId,
            agent.id,
            vpsAgentId,
            conversationId,
            userMessage,
            knowledgeContext?.contextString || undefined,
            agentModel || "claude-sonnet-4-6",
          );

          // Build message metadata with knowledge sources if available
          const vpsMessageMetadata: Record<string, unknown> = {};
          if (knowledgeContext?.sources && knowledgeContext.sources.length > 0) {
            vpsMessageMetadata.knowledgeSources = knowledgeContext.sources;
          }

          // Store agent message from VPS response
          const agentMessage = await sendMessage(
            supabase,
            businessId,
            conversationId,
            vpsResponse.content,
            "agent",
            agent.id,
            vpsResponse.toolCalls?.map((tc) => ({
              toolName: tc.toolName,
              summary: tc.summary,
              inputs: tc.inputs,
              outputs: tc.outputs,
            })),
            Object.keys(vpsMessageMetadata).length > 0 ? vpsMessageMetadata : undefined,
          );

          // Audit log (best-effort)
          try {
            await supabase.from("audit_logs").insert({
              business_id: businessId,
              action: "chat.vps_routed",
              entity_type: "conversation",
              entity_id: conversationId,
              metadata: { agentId: agent.id, vpsAgentId, departmentType },
            });
          } catch {
            /* best-effort */
          }

          // Detect agent self-naming (best-effort, mutates agentMessage.agentName)
          await tryDetectSelfName(supabase, agentMessage, businessId);

          // Post agent response to Slack (best-effort, if connected)
          await postResponseToSlackIfConnected(
            supabase,
            businessId,
            departmentId,
            departmentType,
            agentMessage,
          );

          return agentMessage;
        }

    } catch {
      // VPS call failed, fall through to stub response
    }
  }

  // Existing stub response path (preserved as fallback)
  const stub = generateStubResponse(departmentType, userMessage);

  // Build message metadata with knowledge sources if available
  const stubMessageMetadata: Record<string, unknown> = {};
  if (knowledgeContext?.sources && knowledgeContext.sources.length > 0) {
    stubMessageMetadata.knowledgeSources = knowledgeContext.sources;
  }

  // Create agent message
  const agentMessage = await sendMessage(
    supabase,
    businessId,
    conversationId,
    stub.content,
    "agent",
    agent.id,
    stub.toolCalls,
    Object.keys(stubMessageMetadata).length > 0 ? stubMessageMetadata : undefined,
  );

  // Audit log (best-effort)
  try {
    await supabase.from("audit_logs").insert({
      business_id: businessId,
      action: "chat.message_routed",
      entity_type: "conversation",
      entity_id: conversationId,
      metadata: {
        agentId: agent.id,
        agentName: agent.name,
        departmentId,
        departmentType,
      },
    });
  } catch {
    console.error("Failed to create chat routing audit log");
  }

  // Detect agent self-naming (best-effort, mutates agentMessage.agentName)
  await tryDetectSelfName(supabase, agentMessage, businessId);

  // Post agent response to Slack (best-effort, if connected)
  await postResponseToSlackIfConnected(
    supabase,
    businessId,
    departmentId,
    departmentType,
    agentMessage,
  );

  return agentMessage;
}

/**
 * Post an agent response to Slack if the business has Slack connected.
 * Best-effort: errors are logged but never thrown to avoid breaking the response pipeline.
 * Dynamically imports Slack modules to avoid hard dependency.
 */
async function postResponseToSlackIfConnected(
  supabase: SupabaseClient,
  businessId: string,
  departmentId: string,
  departmentType: string,
  agentMessage: ChatMessage,
): Promise<void> {
  try {
    // Check if business has Slack connected
    const { data: installation } = await supabase
      .from("slack_installations")
      .select("id")
      .eq("business_id", businessId)
      .maybeSingle();

    if (!installation) return;

    // Look up the department's Slack channel mapping
    const { data: channelMapping } = await supabase
      .from("slack_channel_mappings")
      .select("slack_channel_id")
      .eq("business_id", businessId)
      .eq("department_id", departmentId)
      .is("agent_id", null)
      .maybeSingle();

    if (!channelMapping) return;

    const slackChannelId = channelMapping.slack_channel_id as string;

    // Dynamic import to avoid hard dependency (like knowledge retrieval pattern)
    const { getSlackClient } = await import("../slack/slack-client");
    const { postAgentResponseToSlack } = await import("../slack/slack-messages");

    const client = await getSlackClient(supabase, businessId);
    if (!client) return;

    const slackTs = await postAgentResponseToSlack(
      client,
      slackChannelId,
      agentMessage.agentName ?? "Agent",
      departmentType,
      agentMessage.content,
      agentMessage.toolCalls,
    );

    // Update the agent message record with slack_ts and slack_channel_id
    if (slackTs) {
      await supabase
        .from("messages")
        .update({
          slack_ts: slackTs,
          slack_channel_id: slackChannelId,
        })
        .eq("id", agentMessage.id);
    }
  } catch (err) {
    // Best-effort: Slack posting failure should never break the response pipeline
    console.error("Failed to post agent response to Slack:", err);
  }
}
