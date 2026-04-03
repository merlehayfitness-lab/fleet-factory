# CEO Self-Deploy Architecture

## Problem
The admin panel tries to deploy all agents via SSH which is complex and fragile. We need the fleet live in Slack fast.

## Solution
Wizard deploys CEO only. CEO reads a TEAM_PLAN.md and self-deploys all other agents by running Docker commands via mounted Docker socket.

## Flow
1. User creates one Slack app per agent
2. Wizard collects: business info, agent selection, OAuth token, per-agent Slack tokens
3. Wizard deploys CEO container only (via SSH)
4. CEO boots, reads TEAM_PLAN.md
5. CEO deploys sub-agents one by one (docker run via mounted socket)
6. Each agent connects to Slack with its own bot identity
7. Fleet is live and collaborating

## CEO Container Setup
- Docker socket mounted (-v /var/run/docker.sock:/var/run/docker.sock)
- Docker CLI installed in container
- OAuth auth-profiles.json mounted read-only
- Workspace files: SOUL.md, AGENTS.md, IDENTITY.md, TOOLS.md, MEMORY.md, TEAM_PLAN.md
- Pre-approved exec commands for docker run, docker ps, docker logs

## TEAM_PLAN.md
Written by the wizard into CEO's workspace. Contains:
- Business context (name, slug, industry)
- Shared OAuth token
- Per-agent definitions: department, container name, host port, Slack bot/app tokens, model

## CEO Deployment Process
For each agent in TEAM_PLAN.md:
1. Create workspace dir on host, write tailored SOUL.md/IDENTITY.md/AGENTS.md
2. Create memory dir
3. Run Docker container with agent's Slack tokens
4. Verify health (curl healthz)
5. Verify Slack connected (docker logs grep)
6. Announce in Slack
7. Mark as deployed in TEAM_PLAN.md

## Codebase Changes
- Wizard: strip to 5 steps, per-agent Slack tokens
- SSH deploy: CEO-only, mount Docker socket
- Dockerfile: add docker CLI
- New: team-plan.ts generator
- CEO workspace: AGENTS.md with deployment SOPs

## What We Skip
- Multi-agent SSH deploy (Phase C/D)
- MCP/AITMPL catalog
- Deployment progress streaming
- VPS proxy API
- Port allocation registry (CEO manages ports)
