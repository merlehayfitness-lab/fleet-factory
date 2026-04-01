/**
 * Orchestrates all OpenClaw workspace generators to produce a complete
 * deployment package for all active agents in a business.
 *
 * Returns workspace files (AGENTS.md, SOUL.md, IDENTITY.md, TOOLS.md, USER.md
 * per agent) and the shared openclaw.json config.
 */

/**
 * Derive a deterministic vpsAgentId from business/agent metadata.
 * Format: {businessSlug}-{departmentType}-{agentIdPrefix}
 *
 * NOTE: This is a LOCAL COPY of the canonical implementation in
 * packages/core/vps/vps-naming.ts. Duplicated here to avoid circular
 * package dependency (core -> runtime -> core). Any changes to the
 * naming convention MUST be updated in BOTH locations.
 */
function deriveVpsAgentId(
  businessSlug: string,
  departmentType: string,
  agentId: string,
): string {
  const prefix = agentId.replace(/-/g, "").slice(0, 8);
  return `${businessSlug}-${departmentType}-${prefix}`;
}

import { generateAgentsMd } from "./openclaw-agents-md";
import { generateSoulMd } from "./openclaw-soul-md";
import { generateIdentityMd } from "./openclaw-identity-md";
import { generateToolsMd } from "./openclaw-tools-md";
import { generateUserMd } from "./openclaw-user-md";
import { generateSkillMd } from "./openclaw-skill-md";
import { generateOpenClawConfig } from "./openclaw-config";

/** Agent workspace file in a deployment package (local definition to avoid circular dep) */
export interface WorkspaceFile {
  path: string;
  content: string;
}

interface BusinessInput {
  id: string;
  name: string;
  slug: string;
  industry: string;
}

interface AgentInput {
  id: string;
  name: string;
  department_id: string;
  system_prompt: string;
  tool_profile: Record<string, unknown>;
  model_profile: Record<string, unknown>;
  status: string;
  skill_definition: string | null;
  skills?: Array<{ name: string; content: string; level: "department" | "agent" }>;
  parent_agent_id?: string | null;
  token_budget?: number;
  role_level?: number;
  reporting_chain?: string | null;
  mcp_servers?: Array<{ name: string; type: string; config: Record<string, unknown> }>;
  skills_package?: Array<{ name: string; source: string; version?: string }>;
}

interface DepartmentInput {
  id: string;
  type: string;
  name: string;
  department_skill: string | null;
}

interface IntegrationInput {
  type: string;
  provider: string;
  config?: Record<string, unknown>;
  status: string;
}

export function generateOpenClawWorkspace(
  business: BusinessInput,
  agents: AgentInput[],
  departments: DepartmentInput[],
  integrationsByAgent: Record<string, IntegrationInput[]>,
): { files: WorkspaceFile[]; config: string } {
  const files: WorkspaceFile[] = [];

  // Build department lookup
  const deptById = new Map<string, DepartmentInput>();
  for (const dept of departments) {
    deptById.set(dept.id, dept);
  }

  // Filter to active agents only (skip frozen, retired, error)
  const activeAgents = agents.filter(
    (a) => a.status !== "frozen" && a.status !== "retired" && a.status !== "error",
  );

  // Generate per-agent workspace files
  for (const agent of activeAgents) {
    const dept = deptById.get(agent.department_id);
    if (!dept) continue; // skip agents without a valid department

    const vpsAgentId = deriveVpsAgentId(business.slug, dept.type, agent.id);
    const workspaceDir = `workspace-${vpsAgentId}`;

    // AGENTS.md
    files.push({
      path: `${workspaceDir}/AGENTS.md`,
      content: generateAgentsMd(
        agent.name,
        agent.system_prompt,
        agent.tool_profile,
        dept.type,
      ),
    });

    // SOUL.md
    files.push({
      path: `${workspaceDir}/SOUL.md`,
      content: generateSoulMd(dept.type, agent.name, business.industry),
    });

    // IDENTITY.md
    files.push({
      path: `${workspaceDir}/IDENTITY.md`,
      content: generateIdentityMd(agent.name, dept.type),
    });

    // TOOLS.md
    const agentIntegrations = integrationsByAgent[agent.id] || [];
    files.push({
      path: `${workspaceDir}/TOOLS.md`,
      content: generateToolsMd(agentIntegrations, dept.type),
    });

    // USER.md
    files.push({
      path: `${workspaceDir}/USER.md`,
      content: generateUserMd(business.name, business.industry, business.slug),
    });

    // SKILL.md -- use multi-skill array when available, fall back to legacy two-blob merge
    if (agent.skills && agent.skills.length > 0) {
      files.push({
        path: `${workspaceDir}/SKILL.md`,
        content: generateSkillMd(agent.name, agent.skills),
      });
    } else {
      files.push({
        path: `${workspaceDir}/SKILL.md`,
        content: generateSkillMd(agent.name, dept.department_skill, agent.skill_definition),
      });
    }
  }

  // Generate shared openclaw.json with full agent metadata
  const configAgents = activeAgents
    .map((agent) => {
      const dept = deptById.get(agent.department_id);
      if (!dept) return null;

      // Build MCP server entries from template data
      const mcpServers = (agent.mcp_servers ?? []).map((mcp) => ({
        name: mcp.name,
        command: (mcp.config?.command as string) ?? undefined,
        args: (mcp.config?.args as string[]) ?? undefined,
        url: (mcp.config?.url as string) ?? undefined,
        env: (mcp.config?.env as Record<string, string>) ?? undefined,
      }));

      // Build skills package entries
      const skillsPackage = (agent.skills_package ?? []).map((s) => ({
        name: s.name,
        source: s.source,
        version: s.version,
      }));

      // Build reporting chain from parent agent
      let reportingChain: string | undefined;
      if (agent.reporting_chain) {
        reportingChain = agent.reporting_chain;
      } else if (agent.parent_agent_id) {
        const parent = activeAgents.find((a) => a.id === agent.parent_agent_id);
        if (parent) {
          const parentDept = deptById.get(parent.department_id);
          if (parentDept) {
            reportingChain = `Reports to ${parent.name} (${parentDept.type})`;
          }
        }
      }

      return {
        id: agent.id,
        departmentType: dept.type,
        name: agent.name,
        modelProfile: agent.model_profile,
        mcpServers: mcpServers.length > 0 ? mcpServers : undefined,
        skillsPackage: skillsPackage.length > 0 ? skillsPackage : undefined,
        tokenBudget: agent.token_budget,
        reportingChain,
        roleLevel: agent.role_level,
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);

  const config = generateOpenClawConfig(business.slug, configAgents);

  return { files, config };
}
