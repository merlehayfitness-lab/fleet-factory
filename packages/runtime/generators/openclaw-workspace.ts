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

    // SKILL.md
    files.push({
      path: `${workspaceDir}/SKILL.md`,
      content: generateSkillMd(agent.name, dept.department_skill, agent.skill_definition),
    });
  }

  // Generate shared openclaw.json
  const configAgents = activeAgents
    .map((agent) => {
      const dept = deptById.get(agent.department_id);
      if (!dept) return null;
      return {
        id: agent.id,
        departmentType: dept.type,
        name: agent.name,
        modelProfile: agent.model_profile,
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);

  const config = generateOpenClawConfig(business.slug, configAgents);

  return { files, config };
}
