#!/bin/bash
# provision-tenant.sh — Idempotent VPS tenant provisioning script (OpenClaw-native)
#
# Usage: provision-tenant.sh <business-slug>
#
# Reads provision.json from /data/tenants/<slug>/config/
# Creates workspace directories and merges tenant config into OpenClaw gateway.
# No Docker containers — OpenClaw handles agent execution natively.
#
# Idempotent: safe to re-run. Existing workspaces are preserved.

set -euo pipefail

SLUG="${1:?Usage: provision-tenant.sh <business-slug>}"
TENANT_DIR="/data/tenants/${SLUG}"
CONFIG_FILE="${TENANT_DIR}/config/provision.json"
OPENCLAW_CONFIG="${TENANT_DIR}/config/openclaw.json"
GATEWAY_CONFIG_DIR="${HOME}/.openclaw"
GATEWAY_CONFIG="${GATEWAY_CONFIG_DIR}/openclaw.json"

# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

if [ ! -f "$CONFIG_FILE" ]; then
  echo "[provision] ERROR: Config not found: ${CONFIG_FILE}"
  exit 1
fi

echo "[provision] Starting provisioning for tenant: ${SLUG}"
echo "[provision] Config: ${CONFIG_FILE}"

# Parse config
BUSINESS_ID=$(jq -r '.businessId' "$CONFIG_FILE")
AGENT_COUNT=$(jq -r '.agents | length' "$CONFIG_FILE")

echo "[provision] Business ID: ${BUSINESS_ID}"
echo "[provision] Agents: ${AGENT_COUNT}"

# ---------------------------------------------------------------------------
# Directory setup
# ---------------------------------------------------------------------------

echo "[provision] Creating directory structure"
mkdir -p "${TENANT_DIR}/workspace"
mkdir -p "${TENANT_DIR}/memory"
mkdir -p "${TENANT_DIR}/config"
mkdir -p "${TENANT_DIR}/logs"

# ---------------------------------------------------------------------------
# Create per-agent workspace directories
# ---------------------------------------------------------------------------

echo "[provision] Setting up agent workspaces"
for i in $(seq 0 $((AGENT_COUNT - 1))); do
  VPS_AGENT_ID=$(jq -r ".agents[${i}].vpsAgentId" "$CONFIG_FILE")
  DEPT_TYPE=$(jq -r ".agents[${i}].departmentType" "$CONFIG_FILE")
  IS_CEO=$(jq -r ".agents[${i}].isCeo" "$CONFIG_FILE")

  echo "[provision] Setting up workspace for: ${VPS_AGENT_ID} (${DEPT_TYPE}, CEO=${IS_CEO})"

  # Create agent workspace directory (files uploaded by ssh-deploy.ts)
  AGENT_WORKSPACE="${TENANT_DIR}/workspace/workspace-${VPS_AGENT_ID}"
  mkdir -p "${AGENT_WORKSPACE}"

  # Create agent memory directory (preserved across redeploys)
  mkdir -p "${TENANT_DIR}/memory/${VPS_AGENT_ID}"

  # Verify workspace files exist
  if [ -f "${AGENT_WORKSPACE}/IDENTITY.md" ]; then
    echo "[provision] Agent ${VPS_AGENT_ID}: workspace ready (IDENTITY.md found)"
  else
    echo "[provision] WARN: Agent ${VPS_AGENT_ID}: IDENTITY.md not found in workspace"
  fi
done

# ---------------------------------------------------------------------------
# Merge tenant config into gateway config
# ---------------------------------------------------------------------------

echo "[provision] Merging tenant config into OpenClaw gateway"
mkdir -p "${GATEWAY_CONFIG_DIR}"

if [ -f "$OPENCLAW_CONFIG" ]; then
  if [ -f "$GATEWAY_CONFIG" ]; then
    # Merge: add this tenant's agents to the gateway's agent list
    # Use jq to deep-merge tenant config into gateway config
    MERGED=$(jq -s '
      .[0] as $gateway |
      .[1] as $tenant |
      $gateway * {
        agents: {
          list: (
            ($gateway.agents.list // []) |
            map(select(.id | startswith("'"${SLUG}"'-") | not))
          ) + ($tenant.agents.list // [])
        },
        mcp: {
          servers: (($gateway.mcp.servers // {}) * ($tenant.mcp.servers // {}))
        },
        gateway: ($gateway.gateway // {}) * ($tenant.gateway // {})
      }
    ' "$GATEWAY_CONFIG" "$OPENCLAW_CONFIG") || {
      echo "[provision] ERROR: jq merge failed — preserving existing gateway config to protect other tenants"
      echo "[provision] ERROR: Tenant ${SLUG} agents may not be registered. Check JSON validity of:"
      echo "[provision]   Gateway: ${GATEWAY_CONFIG}"
      echo "[provision]   Tenant:  ${OPENCLAW_CONFIG}"
      # Do NOT overwrite — other tenants' agents would be lost
      MERGED=""
    }

    if [ -n "$MERGED" ]; then
      echo "$MERGED" > "$GATEWAY_CONFIG"
      echo "[provision] Merged tenant config into existing gateway config"
    fi
  else
    # No existing gateway config — use tenant config as base
    cp "$OPENCLAW_CONFIG" "$GATEWAY_CONFIG"
    echo "[provision] Created gateway config from tenant config"
  fi
else
  echo "[provision] WARN: No openclaw.json found for tenant, skipping gateway config merge"
fi

# ---------------------------------------------------------------------------
# Restart OpenClaw gateway to pick up new agents
# ---------------------------------------------------------------------------

echo "[provision] Restarting OpenClaw gateway"
if systemctl --user restart openclaw-gateway 2>/dev/null; then
  echo "[provision] OpenClaw gateway restarted successfully"

  # Wait for gateway to be ready
  echo "[provision] Waiting for gateway health check..."
  sleep 2
  for attempt in $(seq 1 10); do
    if curl -sf http://127.0.0.1:18789/healthz > /dev/null 2>&1; then
      echo "[provision] Gateway is healthy (attempt ${attempt})"
      break
    fi
    if [ "$attempt" -eq 10 ]; then
      echo "[provision] WARN: Gateway health check timed out after 10 attempts"
    fi
    sleep 2
  done
else
  echo "[provision] WARN: Failed to restart OpenClaw gateway (may not be installed as systemd service)"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

echo ""
echo "[provision] ================================"
echo "[provision] Provisioning complete for: ${SLUG}"
echo "[provision] Agents registered: ${AGENT_COUNT}"
echo "[provision] Tenant dir: ${TENANT_DIR}"
echo "[provision] Gateway config: ${GATEWAY_CONFIG}"
echo "[provision] ================================"

# List agent workspaces
echo ""
echo "[provision] Agent workspaces:"
for i in $(seq 0 $((AGENT_COUNT - 1))); do
  VPS_AGENT_ID=$(jq -r ".agents[${i}].vpsAgentId" "$CONFIG_FILE")
  DEPT_TYPE=$(jq -r ".agents[${i}].departmentType" "$CONFIG_FILE")
  WORKSPACE="${TENANT_DIR}/workspace/workspace-${VPS_AGENT_ID}"
  FILE_COUNT=$(find "${WORKSPACE}" -type f 2>/dev/null | wc -l | tr -d ' ')
  echo "  ${VPS_AGENT_ID} (${DEPT_TYPE}): ${FILE_COUNT} files"
done
