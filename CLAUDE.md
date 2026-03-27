# Agency Factory

## Project
Multi-tenant SaaS platform for deploying and managing AI agent stacks for client businesses.

Each business gets its own command center, department-specific agents, deployment records, approvals, tasks, and logs.

Current MVP goal:
- Create a business workspace
- Seed default departments and starter agents
- Queue and run a deployment job
- Generate tenant runtime config files
- Show deployment status, agents, approvals, tasks, and logs in the admin panel

## Product Context
This is not a generic chatbot app.

This product is a business command center for managing per-client AI agent systems.

Default department pack for MVP:
- Owner
- Sales
- Support
- Operations

Each business is a tenant.
Each tenant must stay isolated in data, deployment, secrets, logs, and agent runtime config.

## Tech Stack
- Next.js 14+ App Router
- TypeScript (strict)
- Tailwind CSS
- shadcn/ui
- Supabase (Auth, Postgres, RLS)
- Server Actions where useful
- Docker for VPS deployment artifacts
- OpenClaw-oriented runtime config generation
- Claude-powered builder/deployment workflows later

## Architecture
Preferred repo shape:
- apps/web = admin panel
- packages/db = schema, SQL, types, helpers
- packages/core = shared domain logic
- packages/ui = shared UI components
- packages/runtime = runtime builders, OpenClaw config generation, deployment helpers
- apps/worker or packages/worker = async deployment jobs
- infra = docker, scripts, deployment helpers
- templates = department agent templates

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
  4. create starter agents from templates
  5. create a deployment record
  6. queue deployment
- Use idempotent-safe patterns where possible for provisioning and deployment jobs

## Runtime Rules
Deployment runner should generate:
- `tenant-config.json`
- `docker-compose.generated.yml`
- `.env.generated`
- one runtime config file per agent

For now:
- prefer safe stubs or mock adapters over pretending real integrations exist
- keep external integrations modular
- design for OpenClaw-based worker runtime on a VPS
- do not block MVP progress on full orchestration or perfect infra

## UI Rules
Required MVP routes:
- `/businesses`
- `/businesses/new`
- `/businesses/[businessId]`
- `/businesses/[businessId]/deployments`
- `/businesses/[businessId]/approvals`
- `/businesses/[businessId]/tasks`
- `/businesses/[businessId]/logs`

Dashboard should show:
- business name
- deployment status
- number of agents
- pending approvals
- recent activity
- quick links to key pages

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
- `npm run dev` = development
- `npm run build` = production build
- `npm test` = tests
- `npm run lint` = linting, if available
- `npm run typecheck` = type checking, if available

## Safe Command Policy
Usually safe:
- `npm install`
- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run typecheck`
- `npm test`
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
- improves the multi-tenant command center
- supports per-business agent deployment
- keeps tenant isolation clear
- is easy to extend later
- is understandable by a small team
- helps us reach a demoable MVP faster
