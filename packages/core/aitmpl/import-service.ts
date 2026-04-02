/**
 * Import service: converts AITMPL components into Fleet Factory entities.
 *
 * - skill/command/setting/hook -> skills table
 * - agent -> agent system_prompt (or fallback to skill)
 * - mcp -> tool_profile.mcp_servers[] merge
 * - plugin -> error with decomposition guidance
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getComponentDetail, getCatalog } from "./catalog-service";
import type {
  AitmplImportOptions,
  AitmplImportResult,
  AitmplPlugin,
} from "./catalog-types";
import type { ToolProfileShape } from "../agent/tool-profile-schema";
import { createSkill, assignSkill } from "../skill/skill-service";

/**
 * Import an AITMPL component into Fleet Factory.
 *
 * Routes by component type:
 * - skill/command/setting/hook -> create a skill
 * - agent -> update target agent system_prompt (or fallback to skill)
 * - mcp -> merge into target agent tool_profile.mcp_servers[]
 * - plugin -> return error with decomposition guidance
 */
export async function importFromAitmpl(
  supabase: SupabaseClient,
  options: AitmplImportOptions,
): Promise<AitmplImportResult> {
  try {
    // -----------------------------------------------------------------------
    // Plugin: decompose (plugins live in catalog.plugins, not component arrays)
    // -----------------------------------------------------------------------
    if (options.componentType === "plugin") {
      const catalog = await getCatalog();
      const plugin = catalog.plugins.find(
        (p: AitmplPlugin) => p.id === options.componentPath,
      );

      const agentsList = plugin?.agentsList ?? [];
      const commandsList = plugin?.commandsList ?? [];
      const mcpServersList = plugin?.mcpServersList ?? [];

      const parts = [
        ...agentsList.map((a: string) => `  - Agent: ${a}`),
        ...commandsList.map((c: string) => `  - Command: ${c}`),
        ...mcpServersList.map((m: string) => `  - MCP: ${m}`),
      ].join("\n");

      return {
        success: false,
        entityType: "skill",
        name: plugin?.name ?? options.componentPath,
        error: `Plugin import requires decomposition. Import its parts individually:\n${parts}`,
      };
    }

    // -----------------------------------------------------------------------
    // Fetch full component detail
    // -----------------------------------------------------------------------
    const component = await getComponentDetail(
      options.componentPath,
      options.componentType,
    );

    if (!component) {
      return {
        success: false,
        entityType: "skill",
        name: options.componentPath,
        error: "Component not found in AITMPL catalog",
      };
    }

    // -----------------------------------------------------------------------
    // skill / command / setting / hook -> create a skill
    // -----------------------------------------------------------------------
    if (
      options.componentType === "skill" ||
      options.componentType === "command" ||
      options.componentType === "setting" ||
      options.componentType === "hook"
    ) {
      const skill = await createSkill(supabase, options.businessId, {
        name: component.name,
        description: component.description,
        content: component.content,
        source_type: "imported",
        source_url: `aitmpl://${options.componentType}/${component.path}`,
      });

      // Assign to target if specified
      if (options.targetAgentId) {
        await assignSkill(supabase, skill.id, options.businessId, {
          agent_id: options.targetAgentId,
        });
      } else if (options.targetDepartmentId) {
        await assignSkill(supabase, skill.id, options.businessId, {
          department_id: options.targetDepartmentId,
        });
      }

      return {
        success: true,
        entityType: "skill",
        entityId: skill.id,
        name: component.name,
      };
    }

    // -----------------------------------------------------------------------
    // agent -> update system_prompt (or fallback to skill)
    // -----------------------------------------------------------------------
    if (options.componentType === "agent") {
      if (options.targetAgentId) {
        // Update agent system_prompt directly
        const { error: updateError } = await supabase
          .from("agents")
          .update({
            system_prompt: component.content,
            updated_at: new Date().toISOString(),
          })
          .eq("id", options.targetAgentId);

        if (updateError) {
          return {
            success: false,
            entityType: "agent_prompt",
            name: component.name,
            error: `Failed to update agent system_prompt: ${updateError.message}`,
          };
        }

        return {
          success: true,
          entityType: "agent_prompt",
          entityId: options.targetAgentId,
          name: component.name,
        };
      }

      // No target agent -- fallback to creating a skill
      const skill = await createSkill(supabase, options.businessId, {
        name: component.name,
        description: `AITMPL agent template: ${component.description}`,
        content: component.content,
        source_type: "imported",
        source_url: `aitmpl://agent/${component.path}`,
      });

      if (options.targetDepartmentId) {
        await assignSkill(supabase, skill.id, options.businessId, {
          department_id: options.targetDepartmentId,
        });
      }

      return {
        success: true,
        entityType: "skill",
        entityId: skill.id,
        name: component.name,
      };
    }

    // -----------------------------------------------------------------------
    // mcp -> merge into tool_profile.mcp_servers[]
    // -----------------------------------------------------------------------
    if (options.componentType === "mcp") {
      if (!options.targetAgentId) {
        return {
          success: false,
          entityType: "tool_profile_mcp",
          name: component.name,
          error: "MCP import requires a target agent",
        };
      }

      // Parse MCP content as JSON
      let mcpConfig: Record<string, unknown>;
      try {
        mcpConfig = JSON.parse(component.content) as Record<string, unknown>;
      } catch {
        return {
          success: false,
          entityType: "tool_profile_mcp",
          name: component.name,
          error: "Failed to parse MCP content as JSON",
        };
      }

      // Fetch current agent tool_profile
      const { data: agent, error: fetchError } = await supabase
        .from("agents")
        .select("tool_profile")
        .eq("id", options.targetAgentId)
        .single();

      if (fetchError || !agent) {
        return {
          success: false,
          entityType: "tool_profile_mcp",
          name: component.name,
          error: `Failed to fetch agent: ${fetchError?.message ?? "Agent not found"}`,
        };
      }

      // Build profile with existing or default shape
      const profile = (agent.tool_profile ?? {
        allowed_tools: ["*"],
        mcp_servers: [],
      }) as ToolProfileShape;

      if (!profile.mcp_servers) {
        profile.mcp_servers = [];
      }

      // Build new MCP server entry from parsed config
      const newServer = {
        name: (mcpConfig.name as string) || component.name,
        url: (mcpConfig.command as string) || (mcpConfig.url as string) || "",
        transport: ((mcpConfig.transport as string) || "stdio") as "stdio" | "http" | "sse",
        env: (mcpConfig.env as Record<string, string>) || {},
        enabled: true,
      };

      profile.mcp_servers.push(newServer);

      // Update agent tool_profile
      const { error: updateError } = await supabase
        .from("agents")
        .update({
          tool_profile: profile,
          updated_at: new Date().toISOString(),
        })
        .eq("id", options.targetAgentId);

      if (updateError) {
        return {
          success: false,
          entityType: "tool_profile_mcp",
          name: component.name,
          error: `Failed to update agent tool_profile: ${updateError.message}`,
        };
      }

      return {
        success: true,
        entityType: "tool_profile_mcp",
        entityId: options.targetAgentId,
        name: component.name,
      };
    }

    // -----------------------------------------------------------------------
    // Unknown type
    // -----------------------------------------------------------------------
    return {
      success: false,
      entityType: "skill",
      name: options.componentPath,
      error: `Unknown component type: ${options.componentType}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      entityType: "skill",
      name: options.componentPath,
      error: message,
    };
  }
}
