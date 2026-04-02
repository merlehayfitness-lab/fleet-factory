# Fleet Factory

## Project
Single-operator control panel for deploying AI agent swarms across dedicated VPS instances for client businesses.

This is NOT multi-tenant SaaS -- it's TJ's personal tool for spinning up and managing per-business AI agent fleets.

Each business gets:
- Its own VPS with Docker containers (one per agent)
- Claude Code OAuth for AI access (shared across agents on the VPS)
- OpenClaw per container for agent runtime
- Slack-only agent interaction (no web chat)
- Live config sync from admin panel to VPS containers

## Architecture
```
TJ's Browser
    |
    v
[Fleet Factory Admin Panel]  (Vercel / Next.js)
    |
    +-- Supabase (DB, Auth, RLS)
    |
    +-- SSH per-business VPS
         |
         v
    [VPS: business-a]
    +-- Docker containers (one per agent)
    +-- Claude Code (OAuth token, shared via volume mount)
    +-- OpenClaw per container (uses Claude Code auth)
    +-- VPS Proxy (:3100) -- routes Slack msgs to containers
    +-- Slack integration (events webhook -> Vercel -> VPS)
```

Agent lifecycle:
1. Wizard deploys CEO only
2. Other agents seeded as "ready_to_configure"
3. TJ configures each via agent wizard in admin
4. TJ clicks Deploy per agent -> SSH hot-adds container
5. Config changes live-sync via SSH (no redeploy)

## Tech Stack
- Next.js 14+ App Router
- TypeScript (strict)
- Tailwind CSS
- shadcn/ui
- Supabase (Auth, Postgres, RLS)
- Server Actions where useful
- Docker for VPS deployment
- OpenClaw agent runtime per container
- Claude Code OAuth for AI access
- Slack-only agent interaction

## Repo Structure
- apps/web = admin panel
- packages/db = schema, SQL, types, helpers
- packages/core = shared domain logic
- packages/ui = shared UI components
- packages/runtime = runtime builders, OpenClaw config generation, deployment helpers
- infra = docker, scripts, VPS deployment helpers

## Core Entities
Main entities:
- businesses
- profiles
- business_users
- departments
- agent_templates
- agents
- integrations
- deployments
- tasks
- approvals
- conversations
- audit_logs

Rules:
- `businesses` is the tenant root
- Most operational tables should include `business_id`
- Never mix tenant data across businesses
- Prefer explicit status fields over implicit state
- Track important actions in `audit_logs`

## Coding Rules
- Use TypeScript strictly; avoid `any` unless unavoidable
- Server Components by default
- Use shadcn/ui components for app UI
- Keep files small and focused, ideally under 200 lines
- Prefer simple composable functions over deep abstractions
- Extract reusable logic into `packages/core` or `packages/runtime`
- Always handle loading, error, and empty states
- Validate all external inputs
- Do not hardcode secrets
- Put environment variable access behind helper functions
- Add brief TODOs only for real deferred integrations

## Data Rules
- Respect Supabase RLS assumptions in all app code
- Tenant membership determines access
- New business creation should:
  1. create the business
  2. create owner membership
  3. seed default departments
  4. create starter agents from templates (status: ready_to_configure)
  5. create a deployment record
  6. deploy CEO container only
- Use idempotent-safe patterns where possible for provisioning and deployment jobs

## UI Rules
Admin panel nav (10 items):
- Overview
- Departments
- Agents
- Templates
- Skills
- Deployments
- Integrations
- Knowledge Base
- Settings
- Logs

Dashboard (business overview) shows:
- business name + deployment status
- active containers + Slack status
- RevOps metrics (cost today/month/budget)
- activity feed (recent tasks + approvals from Slack)

UI style:
- clean B2B SaaS
- minimal but polished
- readable tables and status badges
- fast operator workflows over flashy design

## Working Style
When working on this repo:
1. Inspect existing code first
2. Propose a short plan
3. Implement in small batches
4. Summarize what changed
5. State what remains
6. Suggest the next command or step

If not blocked, create files directly instead of only describing them.

Choose the simplest solid implementation and keep momentum.

Do not ask unnecessary questions when a reasonable default exists.

## Commands
- `pnpm dev` = development
- `pnpm build` = production build
- `pnpm test` = tests
- `pnpm lint` = linting, if available
- `pnpm typecheck` = type checking, if available

## Safe Command Policy
Usually safe:
- `pnpm install`
- `pnpm dev`
- `pnpm build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `git diff`
- `git status`
- `git add`
- `git commit`

Ask before running:
- `git push`
- destructive deletes
- database migrations against shared environments
- schema resets
- production deploy commands
- commands that modify remote infrastructure
- commands that rotate or expose secrets

## Output Expectations
When making changes:
- explain what changed briefly
- reference exact files touched
- keep responses concise and execution-focused
- prefer shipping working scaffolds over long theory
- if something is stubbed, clearly mark what is stubbed and what is real

## Definition of Good
A good change for this project:
- supports per-business agent deployment on dedicated VPS
- keeps business isolation clear (one VPS per business)
- enables Slack-only agent interaction
- supports live config sync from admin to VPS
- is easy to extend later
- is understandable by a single operator
- helps us reach a working fleet faster
