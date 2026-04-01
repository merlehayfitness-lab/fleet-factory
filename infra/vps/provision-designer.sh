#!/bin/bash
# provision-designer.sh — Deploy TJ's personal Designer Agent
#
# Not per-tenant — runs as a system-level agent at /data/system/designer-agent/
# Generates Next.js + Tailwind + shadcn/ui code from chat prompts.
#
# Usage: provision-designer.sh

set -euo pipefail

DESIGNER_DIR="/data/system/designer-agent"
ENTRYPOINT="/opt/agency-factory/agent-entrypoint.sh"
CONTAINER_NAME="designer-agent"
PORT=3200

echo "[designer] Provisioning Designer Agent"

# Create directory structure
mkdir -p "${DESIGNER_DIR}/workspace"
mkdir -p "${DESIGNER_DIR}/memory"
mkdir -p "${DESIGNER_DIR}/config"
mkdir -p "${DESIGNER_DIR}/output"

# Write designer system prompt
cat > "${DESIGNER_DIR}/workspace/SOUL.md" << 'EOF'
# Designer Agent

You are a UI/UX code generation agent for Agency Factory. You specialize in creating:

- Next.js 15+ App Router components (Server & Client Components)
- Tailwind CSS v4 styling
- shadcn/ui component library usage
- TypeScript strict mode
- Responsive, accessible designs

## Rules
1. Always use TypeScript with explicit types
2. Use `"use client"` directive only when necessary (state, effects, event handlers)
3. Prefer Server Components by default
4. Use shadcn/ui components: Button, Card, Input, Label, Select, Badge, Table, Tabs, Dialog
5. Follow Tailwind v4 conventions (no @apply in components, use utility classes)
6. Always include dark mode support via Tailwind dark: prefix
7. Make components self-contained and reusable
8. Include proper accessibility attributes (aria-*, role, labels)

## Output Format
Return complete, copy-pasteable code blocks. Include:
- Full import statements
- Component definition with TypeScript props interface
- Example usage comment at the bottom

## Style Guide
- Clean B2B SaaS aesthetic
- Minimal but polished
- Readable tables and status badges
- muted-foreground for secondary text
- Consistent spacing with space-y-* and gap-*
EOF

# Write OpenClaw config
cat > "${DESIGNER_DIR}/config/openclaw.json" << EOF
{
  "version": "1.0",
  "agent": {
    "id": "designer-agent",
    "name": "Designer Agent",
    "model": "claude-sonnet-4-6",
    "workspace": "/workspace"
  },
  "runtime": {
    "engine": "openclaw",
    "sandbox": {
      "default_image": "openclaw-sandbox-common:latest",
      "memory": "1g",
      "cpus": "1",
      "network_access": true
    }
  }
}
EOF

# Stop existing container if running
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "[designer] Stopping existing container"
  docker stop "${CONTAINER_NAME}" 2>/dev/null || true
  docker rm "${CONTAINER_NAME}" 2>/dev/null || true
fi

# Start container
echo "[designer] Starting container on port ${PORT}"
docker run -d \
  --name "${CONTAINER_NAME}" \
  --restart unless-stopped \
  -p "${PORT}:${PORT}" \
  -v "${DESIGNER_DIR}/workspace:/workspace:ro" \
  -v "${DESIGNER_DIR}/memory:/memory" \
  -v "${DESIGNER_DIR}/config:/config:ro" \
  -v "${DESIGNER_DIR}/output:/output" \
  -v "${ENTRYPOINT}:/entrypoint.sh:ro" \
  -e "AGENT_ID=designer-agent" \
  -e "BUSINESS_SLUG=system" \
  -e "DEPARTMENT_TYPE=designer" \
  -e "MODEL=claude-sonnet-4-6" \
  -e "PORT=${PORT}" \
  -e "TOKEN_BUDGET=500000" \
  -e "TEMPLATE_NAME=designer" \
  -e "IS_CEO=false" \
  -e "MEMORY_DIR=/memory" \
  --entrypoint "/entrypoint.sh" \
  ghcr.io/anthropics/anthropic-quickstarts:latest

echo "[designer] Designer Agent running on port ${PORT}"
echo "[designer] Output dir: ${DESIGNER_DIR}/output"
