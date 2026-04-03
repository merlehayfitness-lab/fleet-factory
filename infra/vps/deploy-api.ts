/**
 * VPS Deploy API — lightweight HTTP server that accepts deploy requests
 * from the Fleet Factory admin panel and executes them locally.
 *
 * Runs on the VPS, not on Vercel. Vercel calls this via HTTP.
 *
 * Setup:
 *   1. Copy this file + Dockerfile.agent + agent-entrypoint.sh to the VPS
 *   2. npm install express
 *   3. Set DEPLOY_API_KEY env var
 *   4. node deploy-api.ts (or use ts-node / tsx)
 *   5. Enter http://{vps-ip}:3100 in the wizard
 *
 * Endpoints:
 *   POST /deploy — deploy a CEO container with TEAM_PLAN.md
 *   GET  /health — check API + Docker status
 *   GET  /containers — list fleet-factory containers
 */

import express from "express";
import { execSync, exec } from "child_process";
import { mkdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const app = express();
app.use(express.json({ limit: "5mb" }));

const PORT = Number(process.env.DEPLOY_API_PORT) || 3100;
const API_KEY = process.env.DEPLOY_API_KEY || "ff-deploy-2026";
const AGENT_IMAGE = "fleet-factory/agent:latest";

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------
function authMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  const key = req.headers["x-api-key"] || req.query.key;
  if (key !== API_KEY) {
    res.status(401).json({ error: "Invalid API key" });
    return;
  }
  next();
}

app.use(authMiddleware);

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------
app.get("/health", (_req, res) => {
  try {
    const dockerVersion = execSync("docker --version", { encoding: "utf8" }).trim();
    const imageExists = execSync(
      `docker image inspect ${AGENT_IMAGE} > /dev/null 2>&1 && echo "yes" || echo "no"`,
      { encoding: "utf8" },
    ).trim();
    res.json({ ok: true, docker: dockerVersion, agentImage: imageExists === "yes" });
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message });
  }
});

// ---------------------------------------------------------------------------
// GET /containers
// ---------------------------------------------------------------------------
app.get("/containers", (_req, res) => {
  try {
    const output = execSync(
      'docker ps -a --filter "label=fleet-factory=true" --format "{{.Names}}\\t{{.Status}}\\t{{.Ports}}"',
      { encoding: "utf8" },
    );
    const containers = output
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [name, status, ports] = line.split("\t");
        return { name, status, ports };
      });
    res.json({ containers });
  } catch {
    res.json({ containers: [] });
  }
});

// ---------------------------------------------------------------------------
// POST /deploy
// ---------------------------------------------------------------------------
interface DeployRequest {
  businessSlug: string;
  businessName: string;
  industry: string;
  ceoContainerId: string;
  ceoPort: number;
  slackBotToken: string;
  slackAppToken: string;
  slackTeamId: string;
  workspaceFiles: Array<{ path: string; content: string }>;
  openclawConfig: string;
  teamPlan: string;
}

app.post("/deploy", async (req, res) => {
  const body = req.body as DeployRequest;
  const log: string[] = [];

  try {
    const { businessSlug, ceoContainerId, ceoPort } = body;
    const homeDir = `/home/${businessSlug}`;
    const tenantDir = `${homeDir}/tenants/${businessSlug}`;

    // 1. Create Linux user
    log.push(`Creating user: ${businessSlug}`);
    try {
      execSync(`id "${businessSlug}" 2>/dev/null || useradd --create-home --shell /bin/bash "${businessSlug}"`, { stdio: "pipe" });
    } catch { /* user may already exist */ }

    // 2. Create directory structure
    log.push("Creating directories");
    mkdirSync(`${tenantDir}/workspace`, { recursive: true });
    mkdirSync(`${tenantDir}/memory`, { recursive: true });
    mkdirSync(`${tenantDir}/config`, { recursive: true });
    mkdirSync(`${homeDir}/.openclaw/agents`, { recursive: true });

    // 3. Copy OAuth credentials from Claude Code
    log.push("Copying OAuth credentials");
    try {
      const credsPath = "/root/.claude/.credentials.json";
      if (existsSync(credsPath)) {
        execSync(`python3 -c "
import json
with open('${credsPath}') as f:
    creds = json.load(f)
oauth = creds.get('claudeAiOauth', {})
if oauth.get('accessToken'):
    profile = {
        'version': 1,
        'profiles': {
            'anthropic:oauth': {
                'type': 'oauth',
                'provider': 'anthropic',
                'access': oauth['accessToken'],
                'refresh': oauth.get('refreshToken', ''),
                'expires': oauth.get('expiresAt', 0)
            }
        },
        'lastGood': {'anthropic': 'anthropic:oauth'},
        'usageStats': {}
    }
    with open('${homeDir}/.openclaw/auth-profiles.json', 'w') as f:
        json.dump(profile, f, indent=2)
"`, { stdio: "pipe" });
      }
    } catch { log.push("WARNING: OAuth copy failed"); }

    // 4. Write workspace files
    log.push(`Writing ${body.workspaceFiles.length} workspace files`);
    for (const file of body.workspaceFiles) {
      const fullPath = join(tenantDir, "workspace", file.path);
      mkdirSync(join(fullPath, ".."), { recursive: true });
      writeFileSync(fullPath, file.content, "utf8");
    }

    // 5. Write TEAM_PLAN.md to CEO workspace
    const ceoWorkspaceDir = join(tenantDir, "workspace", `workspace-${ceoContainerId}`);
    mkdirSync(ceoWorkspaceDir, { recursive: true });
    writeFileSync(join(ceoWorkspaceDir, "TEAM_PLAN.md"), body.teamPlan, "utf8");
    log.push("TEAM_PLAN.md written");

    // 6. Write OpenClaw config
    writeFileSync(join(tenantDir, "config", "openclaw.json"), body.openclawConfig, "utf8");
    log.push("OpenClaw config written");

    // 7. Create memory dir for CEO
    mkdirSync(join(tenantDir, "memory", ceoContainerId), { recursive: true });

    // 8. Set ownership
    execSync(`chown -R "${businessSlug}:${businessSlug}" "${homeDir}"`, { stdio: "pipe" });

    // 9. Remove old containers for this tenant
    log.push("Cleaning up old containers");
    try {
      execSync(`docker stop $(docker ps --filter "label=tenant=${businessSlug}" -q) 2>/dev/null || true`, { stdio: "pipe" });
      execSync(`docker rm $(docker ps -a --filter "label=tenant=${businessSlug}" -q) 2>/dev/null || true`, { stdio: "pipe" });
    } catch { /* no old containers */ }

    // 10. Check Docker image exists
    const imageExists = execSync(
      `docker image inspect ${AGENT_IMAGE} > /dev/null 2>&1 && echo "yes" || echo "no"`,
      { encoding: "utf8" },
    ).trim();
    if (imageExists !== "yes") {
      res.status(500).json({ ok: false, error: "Docker image fleet-factory/agent:latest not found. Build it first.", log });
      return;
    }

    // 11. Deploy CEO container
    log.push(`Deploying CEO container: ${ceoContainerId} on port ${ceoPort}`);
    const dockerCmd = [
      "docker run -d",
      `--name ${ceoContainerId}`,
      "--label fleet-factory=true",
      `--label tenant=${businessSlug}`,
      `-e AGENT_ID=${ceoContainerId}`,
      `-e BUSINESS_SLUG=${businessSlug}`,
      "-e DEPARTMENT_TYPE=executive",
      "-e MODEL=claude-sonnet-4-6",
      "-e PORT=18789",
      "-e IS_CEO=true",
      "-e TOKEN_BUDGET=100000",
      "-e MEMORY_DIR=/memory",
      "-e OPENCLAW_GATEWAY_PASSWORD=fleetfactory2026",
      `-e SLACK_BOT_TOKEN=${body.slackBotToken}`,
      `-e SLACK_APP_TOKEN=${body.slackAppToken}`,
      `-e SLACK_TEAM_ID=${body.slackTeamId}`,
      `-v ${homeDir}/.openclaw:/root/.openclaw:ro`,
      `-v ${tenantDir}/workspace/workspace-${ceoContainerId}:/workspace:rw`,
      `-v ${tenantDir}/config:/config:ro`,
      `-v ${tenantDir}/memory/${ceoContainerId}:/memory:rw`,
      "-v /var/run/docker.sock:/var/run/docker.sock",
      `-v ${tenantDir}:${tenantDir}:rw`,
      `-p ${ceoPort}:18789`,
      "--memory=512m --cpus=0.5",
      "--restart=unless-stopped",
      AGENT_IMAGE,
    ].join(" ");

    execSync(dockerCmd, { stdio: "pipe" });
    log.push("Container started");

    // 12. Health check (wait up to 60s)
    log.push("Waiting for health check...");
    let healthy = false;
    for (let i = 0; i < 20; i++) {
      await sleep(3000);
      try {
        const result = execSync(
          `curl -sf -H "Authorization: Bearer fleetfactory2026" http://127.0.0.1:${ceoPort}/healthz 2>/dev/null`,
          { encoding: "utf8" },
        );
        if (result.includes("ok") || result.includes("live")) {
          healthy = true;
          break;
        }
      } catch { /* not ready yet */ }
    }

    if (!healthy) {
      const logs = execSync(`docker logs --tail 20 ${ceoContainerId} 2>&1`, { encoding: "utf8" });
      log.push(`Health check failed. Container logs:\n${logs}`);
      res.status(500).json({ ok: false, error: "CEO container failed health check", log });
      return;
    }

    log.push("CEO container healthy!");

    // 13. Check Slack
    try {
      const containerLogs = execSync(`docker logs ${ceoContainerId} 2>&1`, { encoding: "utf8" });
      const slackConnected = containerLogs.includes("socket mode connected");
      log.push(`Slack: ${slackConnected ? "connected" : "not connected yet (may take a moment)"}`);
    } catch { log.push("Slack: unable to check"); }

    res.json({ ok: true, containerId: ceoContainerId, port: ceoPort, log });
  } catch (e) {
    log.push(`FATAL: ${(e as Error).message}`);
    res.status(500).json({ ok: false, error: (e as Error).message, log });
  }
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Fleet Factory Deploy API running on port ${PORT}`);
  console.log(`API Key: ${API_KEY.substring(0, 4)}...`);
});
