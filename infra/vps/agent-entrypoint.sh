#!/bin/bash
# agent-entrypoint.sh — Container entrypoint for AI agents
#
# Bootstraps claude-mem for persistent memory, then starts the agent process.
# Memory is preserved in /memory (volume-mounted from host).
#
# Environment variables (set by provision-tenant.sh):
#   AGENT_ID       - VPS agent identifier
#   BUSINESS_SLUG  - Tenant business slug
#   DEPARTMENT_TYPE - Agent's department
#   MODEL          - AI model to use
#   PORT           - Port to listen on
#   TOKEN_BUDGET   - Max tokens per day
#   MEMORY_DIR     - Path to persistent memory directory
#   IS_CEO         - Whether this is the CEO agent

set -euo pipefail

echo "[entrypoint] Starting agent: ${AGENT_ID:-unknown}"
echo "[entrypoint] Department: ${DEPARTMENT_TYPE:-unknown}"
echo "[entrypoint] Model: ${MODEL:-unknown}"
echo "[entrypoint] Port: ${PORT:-unknown}"

# ---------------------------------------------------------------------------
# Memory bootstrap (claude-mem)
# ---------------------------------------------------------------------------

MEMORY_DIR="${MEMORY_DIR:-/memory}"

echo "[entrypoint] Memory directory: ${MEMORY_DIR}"

# Create memory structure if it doesn't exist
mkdir -p "${MEMORY_DIR}/context"
mkdir -p "${MEMORY_DIR}/sessions"

# Initialize memory index if not present
if [ ! -f "${MEMORY_DIR}/memory.json" ]; then
  echo "[entrypoint] Initializing memory store"
  cat > "${MEMORY_DIR}/memory.json" << 'MEMEOF'
{
  "version": 1,
  "agent_id": "",
  "created_at": "",
  "sessions": [],
  "facts": [],
  "preferences": []
}
MEMEOF
  # Fill in agent-specific values
  sed -i "s/\"agent_id\": \"\"/\"agent_id\": \"${AGENT_ID}\"/" "${MEMORY_DIR}/memory.json"
  sed -i "s/\"created_at\": \"\"/\"created_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"/" "${MEMORY_DIR}/memory.json"
fi

# Load previous session context if available
LAST_SESSION=$(ls -t "${MEMORY_DIR}/sessions/" 2>/dev/null | head -1)
if [ -n "$LAST_SESSION" ]; then
  echo "[entrypoint] Loading previous session context: ${LAST_SESSION}"
  export PREVIOUS_SESSION_FILE="${MEMORY_DIR}/sessions/${LAST_SESSION}"
fi

# Create new session file
SESSION_ID=$(date -u +%Y%m%d_%H%M%S)_$$
SESSION_FILE="${MEMORY_DIR}/sessions/session_${SESSION_ID}.json"
cat > "${SESSION_FILE}" << SESSEOF
{
  "session_id": "${SESSION_ID}",
  "agent_id": "${AGENT_ID}",
  "started_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "model": "${MODEL}",
  "events": []
}
SESSEOF
export CURRENT_SESSION_FILE="${SESSION_FILE}"

echo "[entrypoint] New session: ${SESSION_ID}"

# ---------------------------------------------------------------------------
# Workspace setup
# ---------------------------------------------------------------------------

# Verify workspace files exist
if [ -d "/workspace" ]; then
  echo "[entrypoint] Workspace files:"
  ls -la /workspace/ 2>/dev/null || echo "  (empty)"
else
  echo "[entrypoint] WARNING: No workspace directory mounted"
fi

# Verify config exists
if [ -f "/config/openclaw.json" ]; then
  echo "[entrypoint] OpenClaw config loaded"
else
  echo "[entrypoint] WARNING: No OpenClaw config found"
fi

# ---------------------------------------------------------------------------
# Start agent process
# ---------------------------------------------------------------------------

echo "[entrypoint] Agent ${AGENT_ID} ready"
echo "[entrypoint] Listening on port ${PORT}"

# Keep container running (agent process connects via OpenClaw gateway)
# In production, this would start the actual agent runtime.
# For now, we run a simple HTTP health endpoint.
exec python3 -c "
import http.server
import json
import os
import socketserver

PORT = int(os.environ.get('PORT', 8080))

class HealthHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'status': 'healthy',
                'agent_id': os.environ.get('AGENT_ID', ''),
                'department': os.environ.get('DEPARTMENT_TYPE', ''),
                'model': os.environ.get('MODEL', ''),
                'memory_dir': os.environ.get('MEMORY_DIR', ''),
                'is_ceo': os.environ.get('IS_CEO', 'false')
            }).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass  # Suppress access logs

with socketserver.TCPServer(('', PORT), HealthHandler) as httpd:
    print(f'[agent] Health endpoint on port {PORT}')
    httpd.serve_forever()
" 2>&1
