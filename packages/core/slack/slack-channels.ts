// Slack channel creation and mapping CRUD.
// Creates department channels in Slack, stores channel-department mappings.

import type { WebClient } from "@slack/web-api";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SlackChannelMapping } from "./slack-types";

/**
 * Sanitize a string for use as a Slack channel name.
 * Rules: lowercase, only alphanumeric/hyphens/underscores, max 80 chars.
 */
function sanitizeChannelName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/**
 * Create a single Slack channel with name_taken fallback.
 * If the channel name is already taken, appends a short suffix and retries.
 */
async function createChannelWithFallback(
  client: WebClient,
  channelName: string,
): Promise<{ channelId: string; channelName: string }> {
  try {
    const result = await client.conversations.create({
      name: channelName,
      is_private: false,
    });
    return {
      channelId: result.channel?.id ?? "",
      channelName: (result.channel?.name as string) ?? channelName,
    };
  } catch (error: unknown) {
    const slackError = error as { data?: { error?: string } };
    if (slackError?.data?.error === "name_taken") {
      const suffixed = `${channelName}-${Date.now().toString(36)}`.slice(0, 80);
      const result = await client.conversations.create({
        name: suffixed,
        is_private: false,
      });
      return {
        channelId: result.channel?.id ?? "",
        channelName: (result.channel?.name as string) ?? suffixed,
      };
    }
    throw error;
  }
}

/**
 * Create Slack channels for all departments in a business.
 * Creates one channel per department (name: {slug}-{dept-type})
 * and one sub-channel per sub-agent (name: {slug}-{dept-type}-{agent-slug}).
 * Saves all mappings to slack_channel_mappings.
 */
export async function createDepartmentChannels(
  client: WebClient,
  supabase: SupabaseClient,
  businessId: string,
  businessSlug: string,
): Promise<SlackChannelMapping[]> {
  // Fetch all departments for this business
  const { data: departments, error: deptError } = await supabase
    .from("departments")
    .select("id, name, type")
    .eq("business_id", businessId)
    .order("name");

  if (deptError || !departments) {
    throw new Error(`Failed to fetch departments: ${deptError?.message ?? "No data"}`);
  }

  const mappings: SlackChannelMapping[] = [];

  for (const dept of departments) {
    const deptId = dept.id as string;
    const deptType = dept.type as string;

    // Create main department channel
    const channelName = sanitizeChannelName(`${businessSlug}-${deptType}`);
    const channel = await createChannelWithFallback(client, channelName);

    // Save department-level mapping (agent_id = NULL)
    const deptMapping = await saveChannelMapping(supabase, {
      businessId,
      departmentId: deptId,
      agentId: null,
      slackChannelId: channel.channelId,
      slackChannelName: channel.channelName,
    });
    mappings.push(deptMapping);

    // Fetch sub-agents for this department (agents with a parent_agent_id)
    const { data: subAgents } = await supabase
      .from("agents")
      .select("id, name, role")
      .eq("department_id", deptId)
      .eq("business_id", businessId)
      .not("parent_agent_id", "is", null);

    if (subAgents && subAgents.length > 0) {
      for (const subAgent of subAgents) {
        const agentSlug = sanitizeChannelName(subAgent.role as string || subAgent.name as string);
        const subChannelName = sanitizeChannelName(`${businessSlug}-${deptType}-${agentSlug}`);
        const subChannel = await createChannelWithFallback(client, subChannelName);

        const subMapping = await saveChannelMapping(supabase, {
          businessId,
          departmentId: deptId,
          agentId: subAgent.id as string,
          slackChannelId: subChannel.channelId,
          slackChannelName: subChannel.channelName,
        });
        mappings.push(subMapping);
      }
    }
  }

  return mappings;
}

/**
 * Fetch all channel mappings for a business.
 */
export async function getChannelMappings(
  supabase: SupabaseClient,
  businessId: string,
): Promise<SlackChannelMapping[]> {
  const { data, error } = await supabase
    .from("slack_channel_mappings")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at");

  if (error) {
    throw new Error(`Failed to fetch channel mappings: ${error.message}`);
  }

  return (data ?? []).map(mapRow);
}

/**
 * Fetch a single channel mapping by Slack channel ID.
 */
export async function getChannelMapping(
  supabase: SupabaseClient,
  businessId: string,
  slackChannelId: string,
): Promise<SlackChannelMapping | null> {
  const { data, error } = await supabase
    .from("slack_channel_mappings")
    .select("*")
    .eq("business_id", businessId)
    .eq("slack_channel_id", slackChannelId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch channel mapping: ${error.message}`);
  }

  return data ? mapRow(data) : null;
}

/**
 * Reverse lookup: find business_id and department_id from a team_id + channel_id.
 * Used by the Events API handler to route inbound messages.
 */
export async function getDepartmentForChannel(
  supabase: SupabaseClient,
  slackTeamId: string,
  slackChannelId: string,
): Promise<{ businessId: string; departmentId: string; agentId: string | null } | null> {
  // Find the business from the team_id
  const { data: installation } = await supabase
    .from("slack_installations")
    .select("business_id")
    .eq("slack_team_id", slackTeamId)
    .single();

  if (!installation) return null;

  const businessId = installation.business_id as string;

  // Find the channel mapping
  const { data: mapping } = await supabase
    .from("slack_channel_mappings")
    .select("department_id, agent_id")
    .eq("business_id", businessId)
    .eq("slack_channel_id", slackChannelId)
    .maybeSingle();

  if (!mapping) return null;

  return {
    businessId,
    departmentId: mapping.department_id as string,
    agentId: (mapping.agent_id as string) ?? null,
  };
}

/**
 * Save a channel mapping to the database.
 */
export async function saveChannelMapping(
  supabase: SupabaseClient,
  mapping: Omit<SlackChannelMapping, "id" | "createdAt">,
): Promise<SlackChannelMapping> {
  const { data, error } = await supabase
    .from("slack_channel_mappings")
    .insert({
      business_id: mapping.businessId,
      department_id: mapping.departmentId,
      agent_id: mapping.agentId,
      slack_channel_id: mapping.slackChannelId,
      slack_channel_name: mapping.slackChannelName,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Failed to save channel mapping: ${error?.message ?? "No data"}`);
  }

  return mapRow(data);
}

/** Map a database row to a SlackChannelMapping. */
function mapRow(row: Record<string, unknown>): SlackChannelMapping {
  return {
    id: row.id as string,
    businessId: row.business_id as string,
    departmentId: row.department_id as string,
    agentId: (row.agent_id as string) ?? null,
    slackChannelId: row.slack_channel_id as string,
    slackChannelName: row.slack_channel_name as string,
    createdAt: row.created_at as string,
  };
}
