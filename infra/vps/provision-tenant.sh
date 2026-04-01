#!/bin/bash
# provision-tenant.sh — Idempotent VPS tenant provisioning script
#
# Usage: provision-tenant.sh <business-slug>
#
# Reads provision.json from /data/tenants/<slug>/config/
# Creates tenant directories, writes workspace files, starts Docker containers.
# CEO agent deploys first, then hires the rest with 2s stagger.
#
# Idempotent: safe to re-run. Existing containers are stopped and recreated.

set -euo pipefail

SLUG="${1:?Usage: provision-tenant.sh <business-slug>}"
TENANT_DIR="/data/tenants/${SLUG}"
CONFIG_FILE="${TENANT_DIR}/config/provision.json"
ENTRYPOINT="/opt/agency-factory/agent-entrypoint.sh"

# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

if [ ! -f "$CONFIG_FILE" ]; then
  echo "[provision] ERROR: Config not found: ${CONFIG_FILE}"
  exit 1
fi

if [ ! -f "$ENTRYPOINT" ]; then
  echo "[provision] ERROR: Entrypoint script not found: ${ENTRYPOINT}"
  exit 1
fi

echo "[provision] Starting provisioning for tenant: ${SLUG}"
echo "[provision] Config: ${CONFIG_FILE}"

# Parse config
BUSINESS_ID=$(jq -r '.businessId' "$CONFIG_FILE")
PORT_START=$(jq -r '.portRangeStart' "$CONFIG_FILE")
AGENT_COUNT=$(jq -r '.agents | length' "$CONFIG_FILE")

echo "[provision] Business ID: ${BUSINESS_ID}"
echo "[provision] Port range: ${PORT_START}-$((PORT_START + AGENT_COUNT - 1))"
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
# Deploy agents (CEO first, then the rest)
# ---------------------------------------------------------------------------

deploy_agent() {
  local INDEX=$1
  local VPS_AGENT_ID=$(jq -r ".agents[${INDEX}].vpsAgentId" "$CONFIG_FILE")
  local DEPT_TYPE=$(jq -r ".agents[${INDEX}].departmentType" "$CONFIG_FILE")
  local MODEL=$(jq -r ".agents[${INDEX}].model" "$CONFIG_FILE")
  local IS_CEO=$(jq -r ".agents[${INDEX}].isCeo" "$CONFIG_FILE")
  local PORT=$(jq -r ".agents[${INDEX}].port" "$CONFIG_FILE")
  local TOKEN_BUDGET=$(jq -r ".agents[${INDEX}].tokenBudget" "$CONFIG_FILE")
  local TEMPLATE_NAME=$(jq -r ".agents[${INDEX}].templateName" "$CONFIG_FILE")

  echo "[provision] Deploying agent: ${VPS_AGENT_ID} (${DEPT_TYPE}) on port ${PORT}"

  # Create agent memory directory (preserved across redeploys)
  mkdir -p "${TENANT_DIR}/memory/${VPS_AGENT_ID}"

  # Create agent workspace directory
  local AGENT_WORKSPACE="${TENANT_DIR}/workspace/workspace-${DEPT_TYPE}"
  mkdir -p "${AGENT_WORKSPACE}"

  # Stop existing container if running
  if docker ps -a --format '{{.Names}}' | grep -q "^${VPS_AGENT_ID}$"; then
    echo "[provision] Stopping existing container: ${VPS_AGENT_ID}"
    docker stop "${VPS_AGENT_ID}" 2>/dev/null || true
    docker rm "${VPS_AGENT_ID}" 2>/dev/null || true
  fi

  # Start new container
  docker run -d \
    --name "${VPS_AGENT_ID}" \
    --restart unless-stopped \
    -p "${PORT}:${PORT}" \
    -v "${AGENT_WORKSPACE}:/workspace:ro" \
    -v "${TENANT_DIR}/memory/${VPS_AGENT_ID}:/memory" \
    -v "${TENANT_DIR}/config:/config:ro" \
    -v "${ENTRYPOINT}:/entrypoint.sh:ro" \
    -e "AGENT_ID=${VPS_AGENT_ID}" \
    -e "BUSINESS_SLUG=${SLUG}" \
    -e "DEPARTMENT_TYPE=${DEPT_TYPE}" \
    -e "MODEL=${MODEL}" \
    -e "PORT=${PORT}" \
    -e "TOKEN_BUDGET=${TOKEN_BUDGET}" \
    -e "TEMPLATE_NAME=${TEMPLATE_NAME}" \
    -e "IS_CEO=${IS_CEO}" \
    -e "MEMORY_DIR=/memory" \
    --entrypoint "/entrypoint.sh" \
    ghcr.io/anthropics/anthropic-quickstarts:latest \
    2>&1

  local EXIT_CODE=$?

  if [ $EXIT_CODE -eq 0 ]; then
    echo "[provision] Agent ${VPS_AGENT_ID} started on port ${PORT}"
  else
    echo "[provision] ERROR: Failed to start agent ${VPS_AGENT_ID} (exit code: ${EXIT_CODE})"
    return 1
  fi
}

# Deploy CEO first
CEO_INDEX=-1
for i in $(seq 0 $((AGENT_COUNT - 1))); do
  IS_CEO=$(jq -r ".agents[${i}].isCeo" "$CONFIG_FILE")
  if [ "$IS_CEO" = "true" ]; then
    CEO_INDEX=$i
    break
  fi
done

if [ $CEO_INDEX -ge 0 ]; then
  echo "[provision] === Deploying CEO agent first ==="
  deploy_agent $CEO_INDEX

  # Wait for CEO to initialize before deploying sub-agents
  echo "[provision] Waiting for CEO initialization (5s)"
  sleep 5
fi

# Deploy remaining agents with 2s stagger
echo "[provision] === Deploying remaining agents ==="
for i in $(seq 0 $((AGENT_COUNT - 1))); do
  if [ $i -eq $CEO_INDEX ]; then
    continue  # Skip CEO, already deployed
  fi

  deploy_agent $i

  # 2-second stagger between agent startups
  if [ $i -lt $((AGENT_COUNT - 1)) ]; then
    echo "[provision] Staggering next agent (2s)"
    sleep 2
  fi
done

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

echo ""
echo "[provision] ================================"
echo "[provision] Provisioning complete for: ${SLUG}"
echo "[provision] Agents deployed: ${AGENT_COUNT}"
echo "[provision] Port range: ${PORT_START}-$((PORT_START + AGENT_COUNT - 1))"
echo "[provision] Tenant dir: ${TENANT_DIR}"
echo "[provision] ================================"

# List running containers for this tenant
echo ""
echo "[provision] Running containers:"
docker ps --filter "name=${SLUG}" --format "  {{.Names}}\t{{.Status}}\t{{.Ports}}"
