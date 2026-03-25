// Generates per-agent runtime config JSON files.
// Each agent gets its own config file containing prompt, tools, model, and integrations.

interface AgentRuntimeInput {
  agent: {
    id: string;
    name: string;
    system_prompt: string;
    tool_profile: Record<string, unknown>;
    model_profile: Record<string, unknown>;
    department_id: string;
  };
  department: { name: string; type: string };
  integrations: Array<{
    type: string;
    provider: string;
    status: string;
    config: Record<string, unknown>;
  }>;
  businessSlug: string;
}

export function generateAgentRuntimeConfig(input: AgentRuntimeInput): string {
  const { agent, department, integrations, businessSlug } = input;

  const config = {
    agent_id: agent.id,
    agent_name: agent.name,
    department: {
      name: department.name,
      type: department.type,
    },
    business_slug: businessSlug,
    system_prompt: agent.system_prompt,
    tool_profile: agent.tool_profile,
    model_profile: agent.model_profile,
    integrations: integrations.map((i) => ({
      type: i.type,
      provider: i.provider,
      status: i.status,
    })),
    generated_at: new Date().toISOString(),
  };

  return JSON.stringify(config, null, 2);
}

interface AllAgentConfigsInput {
  agents: Array<{
    id: string;
    name: string;
    system_prompt: string;
    tool_profile: Record<string, unknown>;
    model_profile: Record<string, unknown>;
    department_id: string;
  }>;
  departments: Array<{ id: string; name: string; type: string }>;
  integrationsByAgent: Record<
    string,
    Array<{
      type: string;
      provider: string;
      status: string;
      config: Record<string, unknown>;
    }>
  >;
  businessSlug: string;
}

export function generateAllAgentConfigs(
  input: AllAgentConfigsInput
): Array<{ agentId: string; filename: string; content: string }> {
  const { agents, departments, integrationsByAgent, businessSlug } = input;

  const departmentMap = new Map(departments.map((d) => [d.id, d]));

  return agents.map((agent) => {
    const department = departmentMap.get(agent.department_id) ?? {
      name: "Unknown",
      type: "custom",
    };
    const integrations = integrationsByAgent[agent.id] ?? [];

    const content = generateAgentRuntimeConfig({
      agent,
      department,
      integrations,
      businessSlug,
    });

    return {
      agentId: agent.id,
      filename: `agent-${agent.id}.json`,
      content,
    };
  });
}
