# VPS Activation Checklist

Step-by-step guide for activating the Fleet Factory VPS from a bare server to running agents.

## Prerequisites

- [ ] Hostinger VPS with Ubuntu 22+ or Debian 12+
- [ ] Root SSH access to the VPS
- [ ] Fleet Factory admin app deployed to Vercel with `VPS_API_URL` and `VPS_API_KEY` env vars
- [ ] Anthropic API key for Claude API access on VPS
- [ ] OpenClaw account and auth token

## Step 1: Run Setup Script

```bash
# SSH into VPS
ssh root@your-vps-ip

# Upload setup files from the infra/vps directory
scp infra/vps/* root@your-vps-ip:/tmp/fleet-factory-setup/
ssh root@your-vps-ip

cd /tmp/fleet-factory-setup
chmod +x setup.sh
./setup.sh
```

This installs:
- Node.js 24
- Docker
- OpenClaw CLI
- Creates `/data/tenants/` and `/data/state/` directories
- Copies API proxy files to `/opt/fleet-factory/vps-proxy/`
- Installs npm dependencies (express, ws, ssh2, dockerode, dotenv)
- Creates systemd service (`fleet-factory-proxy`)

Verify the script completed without errors. All 10 steps should show success output.

## Step 2: Configure Environment

```bash
nano /opt/fleet-factory/vps-proxy/.env
```

Required values:

| Variable | Description | Example |
|----------|-------------|---------|
| `API_KEY` | Shared secret (must match `VPS_API_KEY` in Vercel) | `af-vps-key-xxxx` |
| `PORT` | API proxy port | `3100` |
| `OPENCLAW_AUTH_TOKEN` | Your OpenClaw gateway token | `oc-token-xxxx` |
| `OPENCLAW_HTTP_URL` | OpenClaw HTTP endpoint | `http://127.0.0.1:18789` |
| `OPENCLAW_WS_URL` | OpenClaw WebSocket endpoint | `ws://127.0.0.1:18789` |
| `TENANT_DATA_DIR` | Tenant workspace root | `/data/tenants` |
| `STATE_DIR` | Deployment state directory | `/data/state` |
| `SSH_USER` | SSH user for terminal bridge | `root` |
| `SSH_PASSWORD` | SSH password for terminal bridge | *(your SSH password)* |
| `ADMIN_APP_ORIGIN` | CORS origin for admin app | `https://your-app.vercel.app` |

For key-based SSH auth instead of password, set `SSH_PRIVATE_KEY_PATH`:
```bash
SSH_PRIVATE_KEY_PATH=/root/.ssh/id_rsa
```

## Step 3: Configure OpenClaw

```bash
openclaw config set api.http.enabled true
openclaw config set api.http.port 18789
openclaw daemon restart
```

Verify OpenClaw is running:
```bash
curl http://127.0.0.1:18789/api/status
# Should return JSON with status information
```

If the command fails, check:
```bash
openclaw daemon status
journalctl -u openclaw -f
```

## Step 4: Pull Docker Sandbox Image

```bash
docker pull openclaw-sandbox-common:bookworm-slim
```

If the image is not available from a registry, build locally:
```bash
# Check OpenClaw docs for sandbox image build instructions
openclaw sandbox build
```

Verify the image exists:
```bash
docker images | grep openclaw-sandbox
```

## Step 5: Configure SSH for Terminal Bridge

The embedded terminal connects via SSH to localhost. Ensure SSH daemon is running:

```bash
systemctl status sshd
```

If not running:
```bash
apt-get install -y openssh-server
systemctl enable sshd
systemctl start sshd
```

Verify the SSH credentials in `.env` match a user that can log in:
```bash
ssh root@127.0.0.1
# Should succeed with the password from .env
```

If using key-based auth, ensure the key has correct permissions:
```bash
chmod 600 /root/.ssh/id_rsa
```

## Step 6: Start the API Proxy

```bash
systemctl start fleet-factory-proxy
systemctl status fleet-factory-proxy
```

Verify the proxy is running:
```bash
# Health check (no auth required)
curl http://localhost:3100/healthz
# Expected: { "ok": true, "timestamp": "..." }

# Authenticated health check
curl -H "X-API-Key: YOUR_API_KEY" http://localhost:3100/api/health
# Expected: { "status": "online"|"degraded", "agentCount": 0, ... }
```

If the proxy fails to start, check logs:
```bash
journalctl -u fleet-factory-proxy -f
```

## Step 7: Bootstrap Claude Code

```bash
openclaw chat < /opt/fleet-factory/vps-proxy/bootstrap-prompt.md
```

This gives Claude Code its operational context for managing agent workspaces. The bootstrap prompt configures:
- Workspace structure conventions
- Agent file management rules
- Memory preservation policies
- Character budgets per workspace file

Verify bootstrap was applied:
```bash
openclaw sessions list
# Should show at least one session
```

## Step 8: Configure Admin App

In Vercel (or `.env.local` for local development), set:

```
VPS_API_URL=https://your-vps-ip:3100
VPS_API_KEY=your-shared-api-key
```

The `VPS_API_KEY` value must match the `API_KEY` in the VPS `.env` file from Step 2.

Verify from the admin app:
- Navigate to any business dashboard
- The VPS status indicator should show **Online** or **Degraded** (not "Not configured")
- The status indicator auto-polls every 30 seconds

---

## End-to-End Verification Scenario

Follow this sequence to verify the full loop works after completing all 8 setup steps.

### 1. Create a Business

- Go to `/businesses/new` in the admin panel
- Create "Test Corp" with industry "Technology"
- Verify 4 default departments are created (Owner, Sales, Support, Operations)
- Verify starter agents are seeded for each department

### 2. Deploy to VPS

- Go to `/businesses/{id}/deployments`
- Click **Deploy**
- Watch deployment progress stream (should show real phases: writing files, optimizing, starting containers)
- Verify deployment status reaches **Live**
- Check VPS terminal: `docker ps` should show running containers for each agent

### 3. Chat with an Agent

- Go to `/businesses/{id}/chat`
- Select the Sales department
- Send: "What services does Test Corp offer?"
- Verify the agent responds with a real Claude response (not stub text)

### 4. Create a Task

- Go to `/businesses/{id}/tasks`
- Create task: "Qualify lead: John Smith at Acme Inc, interested in AI consulting"
- Assign to Sales department
- Verify the task routes to VPS agent and executes

### 5. Verify Approval Flow

- Create a high-priority task that triggers approval
- Go to `/businesses/{id}/approvals`
- Verify approval request appears
- Approve it
- Verify the result flows back from VPS

### 6. Test Terminal Access

- On the business dashboard, click the **Terminal** icon next to VPS status
- Verify the terminal opens with dark theme
- Run: `ls` -- should show tenant workspace files
- Run: `docker ps` -- should show running agent containers
- Run: `cat workspaces/*/AGENTS.md` -- should show agent config

### 7. Verify Health Monitoring

- Dashboard VPS status should show **Online**
- Agent health grid should show running agents
- Stop a container: `docker stop {agent-name}`
- Wait 30 seconds -- agent health should update to show stopped state
- Restart: `docker start {agent-name}`
- Wait 30 seconds -- agent health should recover

---

## Troubleshooting

### VPS Status Shows "Offline"

1. Check the proxy is running:
   ```bash
   systemctl status fleet-factory-proxy
   ```
2. Check the port is accessible:
   ```bash
   curl http://localhost:3100/healthz
   ```
3. Check the API key matches between admin app (`VPS_API_KEY`) and VPS (`.env` `API_KEY`)
4. Check firewall allows port 3100 from Vercel IP:
   ```bash
   ufw status
   # If blocked: ufw allow 3100/tcp
   ```

### Deployment Fails at "Optimizing"

1. Check OpenClaw gateway is running:
   ```bash
   curl http://127.0.0.1:18789/api/status
   ```
2. Check `OPENCLAW_AUTH_TOKEN` is valid
3. Check Claude Code was bootstrapped:
   ```bash
   openclaw sessions list
   ```

### Agent Not Responding to Chat

1. Check the container is running:
   ```bash
   docker ps | grep {business-slug}
   ```
2. Check OpenClaw gateway routes to agent:
   ```bash
   curl -H "Authorization: Bearer TOKEN" http://127.0.0.1:18789/api/sessions/{agent-id}/messages
   ```
3. Check agent workspace files exist:
   ```bash
   ls /data/tenants/{slug}/workspaces/
   ```

### Terminal Connection Fails

1. Check SSH daemon:
   ```bash
   systemctl status sshd
   ```
2. Check SSH credentials in `.env` match a valid user
3. Check proxy logs for terminal WebSocket entries:
   ```bash
   journalctl -u fleet-factory-proxy -f
   ```
   Look for `[ws:terminal]` entries
4. Verify the WebSocket URL includes the correct `apiKey` parameter

### Docker Permission Issues

1. Ensure the proxy runs as root or a user in the docker group:
   ```bash
   groups $(whoami) | grep docker
   ```
2. Check socket permissions:
   ```bash
   ls -la /var/run/docker.sock
   ```
3. If needed, add the user to the docker group:
   ```bash
   usermod -aG docker $(whoami)
   # Then restart the proxy
   systemctl restart fleet-factory-proxy
   ```

---

*Last updated: Phase 17 -- VPS Activation & Embedded Terminal*
