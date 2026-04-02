// Generates docker-compose.generated.yml from business and agent data.
// Each active agent gets its own container service in the compose file.

interface DockerComposeInput {
  business: { slug: string };
  agents: Array<{ id: string; name: string; status: string }>;
  deploymentVersion: number;
}

/** Slugify a name: lowercase, replace non-alphanumeric with hyphens, collapse multiples */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generateDockerCompose(input: DockerComposeInput): string {
  const { business, agents, deploymentVersion } = input;

  // Filter out retired and frozen agents -- only deploy active/provisioning/paused
  const deployableAgents = agents.filter(
    (a) => a.status !== "retired" && a.status !== "frozen"
  );

  const lines: string[] = [];

  // Header comment
  lines.push(`# Generated docker-compose for ${business.slug} v${deploymentVersion}`);
  lines.push(`# Do not edit manually -- regenerated on each deployment`);
  lines.push("");
  lines.push("version: \"3.8\"");
  lines.push("");
  lines.push("services:");

  for (const agent of deployableAgents) {
    const serviceName = `agent-${slugify(agent.name)}`;
    const containerName = `${business.slug}-agent-${agent.id.slice(0, 8)}`;

    lines.push(`  ${serviceName}:`);
    lines.push(`    image: fleet-factory/openclaw-worker:latest`);
    lines.push(`    container_name: ${containerName}`);
    lines.push(`    environment:`);
    lines.push(`      - AGENT_ID=${agent.id}`);
    lines.push(`      - AGENT_NAME=${agent.name}`);
    lines.push(`      - BUSINESS_SLUG=${business.slug}`);
    lines.push(`      - CONFIG_PATH=/config/agent-${agent.id}.json`);
    lines.push(`    volumes:`);
    lines.push(`      - ./config:/config:ro`);
    lines.push(`      - ./logs:/logs`);
    lines.push(`    restart: unless-stopped`);
    lines.push(`    networks:`);
    lines.push(`      - tenant-network`);
    lines.push("");
  }

  lines.push("networks:");
  lines.push("  tenant-network:");
  lines.push("    driver: bridge");

  return lines.join("\n");
}
