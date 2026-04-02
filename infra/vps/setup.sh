#!/bin/bash
set -euo pipefail

echo "=== Fleet Factory VPS Setup ==="
echo "This script installs Node.js, Docker, OpenClaw, and configures the API proxy server."
echo ""

# ---------------------------------------------------------------------------
# 1. Update system
# ---------------------------------------------------------------------------

echo "[1/10] Updating system packages..."
apt-get update && apt-get upgrade -y

# ---------------------------------------------------------------------------
# 2. Install Node.js 24
# ---------------------------------------------------------------------------

echo "[2/10] Installing Node.js 24..."
if command -v node &> /dev/null; then
  echo "  Node.js already installed: $(node --version)"
else
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
  echo "  Installed Node.js: $(node --version)"
fi

# ---------------------------------------------------------------------------
# 3. Install Docker
# ---------------------------------------------------------------------------

echo "[3/10] Installing Docker..."
if command -v docker &> /dev/null; then
  echo "  Docker already installed: $(docker --version)"
else
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  echo "  Installed Docker: $(docker --version)"
fi

# ---------------------------------------------------------------------------
# 4. Install OpenClaw
# ---------------------------------------------------------------------------

echo "[4/10] Installing OpenClaw..."
if command -v openclaw &> /dev/null; then
  echo "  OpenClaw already installed: $(openclaw --version 2>/dev/null || echo 'version unknown')"
else
  npm install -g @anthropic-ai/openclaw
  openclaw onboard --install-daemon
  echo "  OpenClaw installed"
fi

# ---------------------------------------------------------------------------
# 5. Create directory structure
# ---------------------------------------------------------------------------

echo "[5/10] Creating directory structure..."
mkdir -p /data/tenants
mkdir -p /data/state
mkdir -p /opt/fleet-factory/vps-proxy
echo "  /data/tenants/ created"
echo "  /data/state/ created"
echo "  /opt/fleet-factory/vps-proxy/ created"

# ---------------------------------------------------------------------------
# 6. Copy API proxy files
# ---------------------------------------------------------------------------

echo "[6/10] Copying API proxy files..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp "$SCRIPT_DIR/package.json" /opt/fleet-factory/vps-proxy/
cp "$SCRIPT_DIR/package-lock.json" /opt/fleet-factory/vps-proxy/ 2>/dev/null || true
cp "$SCRIPT_DIR/tsconfig.json" /opt/fleet-factory/vps-proxy/
cp "$SCRIPT_DIR/api-server.ts" /opt/fleet-factory/vps-proxy/
cp "$SCRIPT_DIR/api-routes.ts" /opt/fleet-factory/vps-proxy/
cp "$SCRIPT_DIR/api-types.ts" /opt/fleet-factory/vps-proxy/
cp "$SCRIPT_DIR/deploy-state.ts" /opt/fleet-factory/vps-proxy/
cp "$SCRIPT_DIR/container-manager.ts" /opt/fleet-factory/vps-proxy/
cp "$SCRIPT_DIR/openclaw-client.ts" /opt/fleet-factory/vps-proxy/
cp "$SCRIPT_DIR/.env.example" /opt/fleet-factory/vps-proxy/
cp "$SCRIPT_DIR/bootstrap-prompt.md" /opt/fleet-factory/vps-proxy/
cp "$SCRIPT_DIR/terminal-bridge.ts" /opt/fleet-factory/vps-proxy/
echo "  Files copied to /opt/fleet-factory/vps-proxy/"

# ---------------------------------------------------------------------------
# 7. Install proxy dependencies
# ---------------------------------------------------------------------------

echo "[7/10] Installing API proxy dependencies..."
cd /opt/fleet-factory/vps-proxy
npm install
echo "  Dependencies installed"

# ---------------------------------------------------------------------------
# 8. Create .env from example (if not exists)
# ---------------------------------------------------------------------------

echo "[8/10] Configuring environment..."
if [ ! -f /opt/fleet-factory/vps-proxy/.env ]; then
  cp /opt/fleet-factory/vps-proxy/.env.example /opt/fleet-factory/vps-proxy/.env
  echo "  IMPORTANT: Edit /opt/fleet-factory/vps-proxy/.env with your API key and OpenClaw token"
else
  echo "  .env already exists -- skipping (will not overwrite)"
fi

# ---------------------------------------------------------------------------
# 9. Pull sandbox images
# ---------------------------------------------------------------------------

echo "[9/10] Pulling Docker sandbox images..."
docker pull openclaw-sandbox-common:bookworm-slim 2>/dev/null || echo "  Sandbox image pull failed -- may need to build locally or pull from registry"

# ---------------------------------------------------------------------------
# 10. Set up systemd service
# ---------------------------------------------------------------------------

echo "[10/10] Configuring systemd service..."
cat > /etc/systemd/system/fleet-factory-proxy.service << 'SYSTEMD'
[Unit]
Description=Fleet Factory VPS API Proxy
After=network.target docker.service

[Service]
Type=simple
WorkingDirectory=/opt/fleet-factory/vps-proxy
ExecStart=/usr/bin/node --loader tsx api-server.ts
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
SYSTEMD

systemctl daemon-reload
systemctl enable fleet-factory-proxy
echo "  Service configured: fleet-factory-proxy"

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Edit /opt/fleet-factory/vps-proxy/.env with your values:"
echo "     - API_KEY: shared secret between admin app and VPS"
echo "     - OPENCLAW_AUTH_TOKEN: your OpenClaw gateway token"
echo "  2. Configure OpenClaw gateway:"
echo "     openclaw config set api.http.enabled true"
echo "     openclaw config set api.http.port 18790"
echo "     Restart OpenClaw daemon after configuration"
echo "  3. Start the API proxy:"
echo "     systemctl start fleet-factory-proxy"
echo "  4. Verify it's running:"
echo "     curl http://localhost:3100/healthz"
echo "  5. Bootstrap Claude Code:"
echo "     openclaw chat < /opt/fleet-factory/vps-proxy/bootstrap-prompt.md"
echo ""
echo "Logs:"
echo "  journalctl -u fleet-factory-proxy -f"
