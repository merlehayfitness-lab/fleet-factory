// Generates tenant-config.json from business, department, and agent data.
// This is the master configuration file for a tenant deployment.

interface TenantConfigInput {
  business: {
    id: string;
    name: string;
    slug: string;
    industry: string | null;
    status: string;
  };
  departments: Array<{ id: string; name: string; type: string }>;
  agents: Array<{ id: string; name: string; status: string; department_id: string }>;
  deploymentVersion: number;
}

export function generateTenantConfig(input: TenantConfigInput): string {
  const config = {
    version: input.deploymentVersion,
    tenant: {
      id: input.business.id,
      name: input.business.name,
      slug: input.business.slug,
      industry: input.business.industry ?? "general",
      status: input.business.status,
    },
    departments: input.departments.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
    })),
    agents: input.agents.map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      department_id: a.department_id,
      runtime_config: `agent-${a.id}.json`,
    })),
    generated_at: new Date().toISOString(),
  };
  return JSON.stringify(config, null, 2);
}
