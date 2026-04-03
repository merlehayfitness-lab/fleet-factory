/**
 * Generate TEAM_PLAN.md for the CEO agent.
 *
 * This file is placed in the CEO's workspace and tells it which agents
 * to deploy, their Slack tokens, and the Docker run template.
 */

export interface TeamPlanAgent {
  name: string;
  department: string;
  containerId: string;
  hostPort: number;
  slackBotToken: string;
  slackAppToken: string;
  model: string;
}

export interface TeamPlanInput {
  businessName: string;
  businessSlug: string;
  industry: string;
  oauthToken: string;
  slackTeamId: string;
  agents: TeamPlanAgent[];
}

export function generateTeamPlan(input: TeamPlanInput): string {
  const lines: string[] = [];

  lines.push("# Team Deployment Plan");
  lines.push("");
  lines.push("## Business");
  lines.push(`- Name: ${input.businessName}`);
  lines.push(`- Slug: ${input.businessSlug}`);
  lines.push(`- Industry: ${input.industry}`);
  lines.push("");
  lines.push("## Slack Team ID");
  lines.push(input.slackTeamId);
  lines.push("");
  lines.push("## Agents to Deploy");
  lines.push("");

  for (const agent of input.agents) {
    lines.push(`### ${agent.name}`);
    lines.push(`- Department: ${agent.department}`);
    lines.push(`- Container: ${agent.containerId}`);
    lines.push(`- Host Port: ${agent.hostPort}`);
    lines.push(`- Slack Bot Token: ${agent.slackBotToken}`);
    lines.push(`- Slack App Token: ${agent.slackAppToken}`);
    lines.push(`- Model: ${agent.model}`);
    lines.push(`- Status: pending`);
    lines.push("");
  }

  lines.push("## Deployment Instructions");
  lines.push("");
  lines.push("Deploy each agent in order. For each agent:");
  lines.push("");
  lines.push("1. Create the workspace directory on the host:");
  lines.push("   ```");
  lines.push(`   mkdir -p /home/${input.businessSlug}/tenants/${input.businessSlug}/workspace/workspace-{container-id}`);
  lines.push("   ```");
  lines.push("");
  lines.push("2. Write workspace files (SOUL.md, IDENTITY.md, AGENTS.md, TOOLS.md, USER.md, SKILL.md) tailored to the agent's department and role. Base these on your own workspace files but customize the identity, personality, and operational rules for their specific department.");
  lines.push("");
  lines.push("3. Create the memory directory:");
  lines.push("   ```");
  lines.push(`   mkdir -p /home/${input.businessSlug}/tenants/${input.businessSlug}/memory/{container-id}`);
  lines.push("   ```");
  lines.push("");
  lines.push("4. Run the Docker container:");
  lines.push("   ```");
  lines.push("   docker run -d \\");
  lines.push("     --name {container-id} \\");
  lines.push("     --label fleet-factory=true \\");
  lines.push(`     --label tenant=${input.businessSlug} \\`);
  lines.push("     -e AGENT_ID={container-id} \\");
  lines.push(`     -e BUSINESS_SLUG=${input.businessSlug} \\`);
  lines.push("     -e DEPARTMENT_TYPE={department} \\");
  lines.push("     -e MODEL={model} \\");
  lines.push("     -e PORT=18789 \\");
  lines.push("     -e IS_CEO=false \\");
  lines.push("     -e TOKEN_BUDGET=100000 \\");
  lines.push("     -e MEMORY_DIR=/memory \\");
  lines.push("     -e OPENCLAW_GATEWAY_PASSWORD=fleetfactory2026 \\");
  lines.push("     -e SLACK_BOT_TOKEN={slack-bot-token} \\");
  lines.push("     -e SLACK_APP_TOKEN={slack-app-token} \\");
  lines.push(`     -e SLACK_TEAM_ID=${input.slackTeamId} \\`);
  lines.push(`     -v /home/${input.businessSlug}/.openclaw:/root/.openclaw:ro \\`);
  lines.push(`     -v /home/${input.businessSlug}/tenants/${input.businessSlug}/workspace/workspace-{container-id}:/workspace:rw \\`);
  lines.push(`     -v /home/${input.businessSlug}/tenants/${input.businessSlug}/config:/config:ro \\`);
  lines.push(`     -v /home/${input.businessSlug}/tenants/${input.businessSlug}/memory/{container-id}:/memory:rw \\`);
  lines.push("     -p {host-port}:18789 \\");
  lines.push("     --memory=512m --cpus=0.5 \\");
  lines.push("     --restart=unless-stopped \\");
  lines.push("     fleet-factory/agent:latest");
  lines.push("   ```");
  lines.push("   Replace {container-id}, {department}, {model}, {slack-bot-token}, {slack-app-token}, and {host-port} with the values from the agent's section above.");
  lines.push("");
  lines.push("5. Verify the container is healthy:");
  lines.push("   ```");
  lines.push("   curl -sf http://127.0.0.1:{host-port}/healthz");
  lines.push("   ```");
  lines.push("");
  lines.push("6. Check Slack is connected:");
  lines.push("   ```");
  lines.push("   docker logs {container-id} 2>&1 | grep 'socket mode connected'");
  lines.push("   ```");
  lines.push("");
  lines.push("7. Announce in Slack that the agent is online.");
  lines.push("");
  lines.push("8. Update this file: change the agent's Status from `pending` to `deployed`.");
  lines.push("");
  lines.push("## Notes");
  lines.push("- All agents share the same OAuth token (mounted via /root/.openclaw)");
  lines.push("- Each agent has its own Slack bot identity (separate bot/app tokens)");
  lines.push("- If a container fails health check, check logs with: docker logs {container-id}");
  lines.push("- To restart a failed agent: docker rm -f {container-id} then re-run the docker run command");

  return lines.join("\n");
}
