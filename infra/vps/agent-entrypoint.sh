#!/bin/bash
# agent-entrypoint.sh — Container entrypoint for AI agents
#
# Bootstraps persistent memory, filters OpenClaw config for this agent,
# then starts the OpenClaw gateway process inside the container.
#
# Environment variables (set by docker run):
#   AGENT_ID        - VPS agent identifier
#   BUSINESS_SLUG   - Tenant business slug
#   DEPARTMENT_TYPE  - Agent's department
#   MODEL           - AI model to use
#   PORT            - Port to listen on (default: 18789)
#   ANTHROPIC_API_KEY - Anthropic API key for this business
#   TOKEN_BUDGET    - Max tokens per day
#   MEMORY_DIR      - Path to persistent memory directory
#   IS_CEO          - Whether this is the CEO agent

set -euo pipefail

echo "[entrypoint] Starting agent: ${AGENT_ID:-unknown}"
echo "[entrypoint] Department: ${DEPARTMENT_TYPE:-unknown}"
echo "[entrypoint] Model: ${MODEL:-unknown}"
echo "[entrypoint] Port: ${PORT:-18789}"

# ---------------------------------------------------------------------------
# Memory bootstrap
# ---------------------------------------------------------------------------

MEMORY_DIR="${MEMORY_DIR:-/memory}"

echo "[entrypoint] Memory directory: ${MEMORY_DIR}"

mkdir -p "${MEMORY_DIR}/context"
mkdir -p "${MEMORY_DIR}/sessions"

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
  sed -i "s/\"agent_id\": \"\"/\"agent_id\": \"${AGENT_ID}\"/" "${MEMORY_DIR}/memory.json"
  sed -i "s/\"created_at\": \"\"/\"created_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"/" "${MEMORY_DIR}/memory.json"
fi

LAST_SESSION=$(ls -t "${MEMORY_DIR}/sessions/" 2>/dev/null | head -1)
if [ -n "$LAST_SESSION" ]; then
  echo "[entrypoint] Loading previous session context: ${LAST_SESSION}"
  export PREVIOUS_SESSION_FILE="${MEMORY_DIR}/sessions/${LAST_SESSION}"
fi

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
# Workspace verification
# ---------------------------------------------------------------------------

if [ -d "/workspace" ]; then
  echo "[entrypoint] Workspace files:"
  ls -la /workspace/ 2>/dev/null || echo "  (empty)"
else
  echo "[entrypoint] WARNING: No workspace directory mounted"
fi

# ---------------------------------------------------------------------------
# OpenClaw config: filter for this agent only
# ---------------------------------------------------------------------------

OPENCLAW_CONFIG_DIR="/tmp/openclaw-config"
mkdir -p "${OPENCLAW_CONFIG_DIR}"
OPENCLAW_CONFIG="${OPENCLAW_CONFIG_DIR}/openclaw.json"

if [ -f "/config/openclaw.json" ]; then
  echo "[entrypoint] Filtering OpenClaw config for agent: ${AGENT_ID}"

  # Extract this agent's entry from the full config and build a single-agent config
  jq --arg agentId "${AGENT_ID}" '
    .agents.list = [.agents.list[] | select(.id == $agentId)] |
    if (.agents.list | length) == 0 then
      # Agent not found by exact ID — try matching by workspace path suffix
      .agents.list = [.agents.list // [] | .[] | select(.id | contains($agentId))]
    else . end
  ' /config/openclaw.json > "${OPENCLAW_CONFIG}" 2>/dev/null || {
    echo "[entrypoint] WARNING: jq filter failed, copying full config"
    cp /config/openclaw.json "${OPENCLAW_CONFIG}"
  }

  echo "[entrypoint] OpenClaw config written to ${OPENCLAW_CONFIG}"
else
  echo "[entrypoint] WARNING: No OpenClaw config found at /config/openclaw.json"
  # Create minimal config so gateway can start
  cat > "${OPENCLAW_CONFIG}" << CFGEOF
{
  "gateway": {
    "port": ${PORT:-18789},
    "mode": "local",
    "bind": "custom",
    "customBindHost": "0.0.0.0",
    "auth": { "mode": "password" },
    "http": {
      "endpoints": {
        "chatCompletions": { "enabled": true }
      }
    }
  },
  "agents": {
    "defaults": {
      "model": "${MODEL:-anthropic/claude-sonnet-4-6}"
    },
    "list": []
  }
}
CFGEOF
fi

# Ensure the gateway port matches the container PORT env var
# OpenClaw expects gateway.port (NOT gateway.http.port)
jq --argjson port "${PORT:-18789}" '.gateway.port = $port' "${OPENCLAW_CONFIG}" > "${OPENCLAW_CONFIG}.tmp" && \
  mv "${OPENCLAW_CONFIG}.tmp" "${OPENCLAW_CONFIG}" 2>/dev/null || true

# ---------------------------------------------------------------------------
# OAuth token: prefer auth-profiles.json over API key
# ---------------------------------------------------------------------------

# Copy auth profiles to writable location for OpenClaw
OPENCLAW_STATE="/root/.openclaw-state"
mkdir -p "${OPENCLAW_STATE}/agents/${AGENT_ID}/agent"

if [ -f "/root/.openclaw/auth-profiles.json" ]; then
  echo "[entrypoint] OAuth auth-profiles.json found — setting up authentication"
  cp "/root/.openclaw/auth-profiles.json" "${OPENCLAW_STATE}/agents/${AGENT_ID}/agent/auth-profiles.json"
  # Point OpenClaw to writable state dir
  export OPENCLAW_STATE_DIR="${OPENCLAW_STATE}"
  unset ANTHROPIC_API_KEY
elif [ -f "/root/.openclaw/agents/${AGENT_ID}/agent/auth-profiles.json" ]; then
  echo "[entrypoint] Agent-specific auth found"
  cp "/root/.openclaw/agents/${AGENT_ID}/agent/auth-profiles.json" "${OPENCLAW_STATE}/agents/${AGENT_ID}/agent/auth-profiles.json"
  export OPENCLAW_STATE_DIR="${OPENCLAW_STATE}"
  unset ANTHROPIC_API_KEY
else
  echo "[entrypoint] No OAuth found — using ANTHROPIC_API_KEY"
  export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"
fi

# ---------------------------------------------------------------------------
# Slack: configure native channel if tokens are present
# ---------------------------------------------------------------------------

if [ -n "${SLACK_BOT_TOKEN:-}" ] && [ -n "${SLACK_APP_TOKEN:-}" ]; then
  echo "[entrypoint] Slack tokens found — adding native channel config"
  SLACK_ACCOUNT="${DEPARTMENT_TYPE:-default}"
  jq --arg botToken "${SLACK_BOT_TOKEN}" \
     --arg appToken "${SLACK_APP_TOKEN}" \
     --arg teamId "${SLACK_TEAM_ID:-}" \
     --arg account "${SLACK_ACCOUNT}" \
     --arg agentId "${AGENT_ID}" \
     '
     .channels.slack = {
       mode: "socket",
       enabled: true,
       requireMention: true,
       groupPolicy: "open",
       accounts: {
         ($account): {
           name: $agentId,
           enabled: true,
           botToken: $botToken,
           appToken: $appToken
         }
       }
     } |
     .bindings = [{ type: "route", agentId: $agentId, match: { channel: "slack", accountId: $account } }]
     ' "${OPENCLAW_CONFIG}" > "${OPENCLAW_CONFIG}.tmp" && \
    mv "${OPENCLAW_CONFIG}.tmp" "${OPENCLAW_CONFIG}" 2>/dev/null || \
    echo "[entrypoint] WARNING: Failed to inject Slack config"
fi

# ---------------------------------------------------------------------------
# Start OpenClaw gateway
# ---------------------------------------------------------------------------

echo "[entrypoint] Agent ${AGENT_ID} ready"
echo "[entrypoint] Starting OpenClaw gateway on port ${PORT:-18789}"

# Copy config to OpenClaw's expected location
mkdir -p /root/.openclaw 2>/dev/null || true
cp "${OPENCLAW_CONFIG}" /root/.openclaw/openclaw.json 2>/dev/null || true

# If we have a writable state dir, tell OpenClaw about it
if [ -n "${OPENCLAW_STATE_DIR:-}" ]; then
  # Copy config there too
  cp "${OPENCLAW_CONFIG}" "${OPENCLAW_STATE_DIR}/openclaw.json" 2>/dev/null || true
fi

exec openclaw gateway 2>&1
