# Stack Research

**Domain:** Multi-tenant AI agent deployment and management platform (SaaS)
**Researched:** 2026-03-25
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 15.5.x (latest 15.5.9 patched) | Full-stack web framework for admin panel | The PROJECT.md specifies Next.js 14+. Use 15.5.x, NOT 16. Next.js 16 introduces breaking changes (fully async request APIs, Turbopack default, middleware-to-proxy migration) that add migration risk with zero value for MVP. 15.5.x is battle-tested, has excellent App Router support, and receives security backports. Upgrade to 16 post-MVP when the breaking changes justify the effort. |
| React | 19.2.x (latest 19.2.4) | UI library | Required by Next.js 15. React 19 brings Server Components, Actions, use() hook, and optimistic updates -- all essential for a data-heavy admin panel. |
| TypeScript | 5.5+ (strict mode) | Type safety | Non-negotiable for a multi-service architecture. Strict mode catches tenant isolation bugs at compile time. Required by Zod v4. |
| Tailwind CSS | 4.2.x (latest 4.2.0) | Utility-first CSS | 5x faster builds, zero-config with auto content detection. Uses @theme directives in CSS instead of JS config. shadcn/ui's CLI v4 is built around Tailwind v4. |
| Supabase | Platform (supabase-js 2.99.x) | Auth, Postgres, RLS, Queues, Edge Functions | Already decided. Supabase is THE choice for multi-tenant SaaS with RLS. Native Postgres queues (pgmq) eliminate Redis dependency for job processing. Auth hooks let you inject tenant_id into JWT claims. |
| Anthropic Claude API | @anthropic-ai/sdk 0.80.x | LLM provider for builder and worker agents | Claude is the specified model. The official SDK provides streaming, structured outputs (strict tool use), and type-safe tool definitions. 7M+ weekly npm downloads confirm production readiness. |

### AI / Agent Layer

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| AI SDK (Vercel) | 6.0.x (latest 6.0.134) | Unified LLM interface, agent orchestration, streaming UI | AI SDK 6 introduces the Agent abstraction with ToolLoopAgent and orchestrator-worker patterns -- exactly what Paperclip (orchestrator) and OpenClaw (worker) need. Provider-agnostic design means you can swap models per department without rewriting. Streaming integration with Next.js App Router is seamless. Backwards compatible despite major version bump. |
| @ai-sdk/anthropic | 3.0.x (latest 3.0.64) | Claude provider for AI SDK | Bridges AI SDK to Anthropic API. Supports extended thinking, context management, web search tools, and adaptive reasoning for claude-sonnet and claude-opus models. 1365+ dependents. |
| Zod | 4.3.x (latest 4.3.6) | Runtime validation and schema definition | 14x faster parsing vs v3. Used everywhere: API request validation, tool parameter schemas for Claude (zodOutputFormat()), form validation, config file parsing. The single schema language across the entire stack. |

### Database and Data Layer

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Supabase Postgres | 15.6+ | Primary database | RLS for tenant isolation at the database level. pgvector for agent memory/embeddings. pgmq for durable job queues. All in one Postgres instance -- no separate Redis, no separate vector DB. |
| @supabase/supabase-js | 2.99.x | Database client | Type-safe queries, auth helpers, realtime subscriptions, storage. Use the Supabase client for RLS-respecting queries (anon/user key) and a service-role client for admin operations that bypass RLS. |
| pgvector (extension) | Latest (bundled) | Vector similarity search | Agent memory, conversation embeddings, semantic search over knowledge bases. Stored alongside relational data in the same schema -- no separate vector DB needed. |
| pgmq (extension) | Latest (bundled) | Durable message queues | Deployment jobs, task routing, agent work queues. Postgres-native with guaranteed exactly-once delivery within visibility windows. Eliminates BullMQ + Redis dependency entirely. |
| Drizzle ORM | 0.45.x | Type-safe query builder (optional, Phase 2+) | Use Supabase client for MVP (simpler RLS integration). Consider Drizzle later for complex joins and type-safe schema definitions. Drizzle + Supabase RLS requires careful transaction management with two client pattern (admin bypasses RLS, user respects RLS). Not worth the complexity in Phase 1. |

### UI Components

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| shadcn/ui | CLI v4 (March 2026) | Component library | Not a dependency -- copies components into your repo. CLI v4 includes AI agent skills for coding agents, design system presets, choice of Radix or Base UI primitives, and RTL support. Uses unified radix-ui package. |
| radix-ui | Unified package | Accessible primitives | Single import instead of 20+ individual @radix-ui/react-* packages. Powers shadcn/ui's dialog, dropdown, tabs, tooltip, etc. |
| Lucide React | Latest | Icons | Default icon library for shadcn/ui. Tree-shakeable, consistent with the design system. |
| Recharts or Tremor | Latest | Dashboard charts | Business overview dashboard needs charts for agent health, task volume, deployment status. Recharts is lightweight; Tremor is purpose-built for dashboards. Pick one. |

### Monorepo and Build

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Turborepo | 2.8.x (latest 2.8.20) | Monorepo build orchestration | Vercel-backed, minimal config (~20 lines turbo.json), 3x faster than Nx in benchmarks. Perfect for the 6-package repo structure defined in PROJECT.md (apps/web, packages/db, packages/core, packages/ui, packages/runtime, apps/worker). No plugin ecosystem to learn -- it just caches and parallelizes tasks. |
| pnpm | 9.x | Package manager | Workspace support, strict dependency resolution, disk-efficient via content-addressable store. The standard for Turborepo monorepos. |

### Infrastructure

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Docker | Latest | Container runtime | Tenant workspace isolation. Each tenant deployment generates docker-compose.yml, .env, and per-agent configs. Single VPS target for MVP. |
| Docker Compose | V2 (spec v5.0) | Multi-container orchestration | Defines tenant agent stacks declaratively. Template-based: generate per-tenant compose files from templates. Supports GPU passthrough, health checks, modular includes. |
| Nginx or Traefik | Latest | Reverse proxy | Route tenant traffic to correct container. Traefik has Docker-native auto-discovery; Nginx is simpler but requires manual config generation. Recommend Traefik for MVP -- it reads container labels automatically. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | 4.x | Date manipulation | Audit logs, deployment timestamps, task scheduling displays |
| nanoid | 5.x | ID generation | Slugs, short identifiers, non-sequential IDs where UUID is overkill |
| superjson | 2.x | Serialization | Server Action return types with Dates, Maps, Sets -- Next.js strips these by default |
| nuqs | Latest | URL state management | Query params for filters on tasks, agents, audit logs pages -- type-safe URL state |
| @tanstack/react-table | Latest | Data tables | Tasks list, agents list, audit log viewer, deployments table -- headless, sortable, filterable |
| sonner | Latest | Toast notifications | Deployment status updates, approval actions, error messages |
| react-hook-form | 7.x | Form management | Create business wizard, department setup, agent configuration forms |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Biome | Linting + formatting | Replaces ESLint + Prettier. 35x faster. Single tool for lint and format. Rust-based. |
| Supabase CLI | Local development, migrations, type generation | `supabase gen types` generates TypeScript types from your schema. `supabase db push` for migrations. Run local Supabase with `supabase start`. |
| Docker Desktop | Local container testing | Test tenant deployment flows locally before pushing to VPS. |
| tsx | TypeScript execution | Run scripts, seed data, test services without compiling. Faster than ts-node. |

## Installation

```bash
# Initialize monorepo
pnpm dlx create-turbo@latest fleet-factory

# Core framework (apps/web)
pnpm add next@15 react@19 react-dom@19

# Styling
pnpm add tailwindcss@4

# Supabase
pnpm add @supabase/supabase-js @supabase/ssr

# AI / LLM
pnpm add ai @ai-sdk/anthropic @anthropic-ai/sdk

# Validation
pnpm add zod

# UI Components (run in apps/web)
pnpm dlx shadcn@latest init

# Supporting
pnpm add date-fns nanoid superjson nuqs sonner react-hook-form
pnpm add @tanstack/react-table

# Dev dependencies
pnpm add -D typescript @types/react @types/node
pnpm add -D turbo
pnpm add -D @biomejs/biome
pnpm add -D supabase tsx
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Next.js 15 | Next.js 16 | Upgrade post-MVP when async request APIs and Turbopack are worth the migration cost. 16 is better long-term but adds risk now. |
| AI SDK 6 | Direct @anthropic-ai/sdk only | If you ONLY ever use Claude and never need model switching, streaming UI helpers, or the Agent abstraction. AI SDK adds a thin layer that pays for itself in agent orchestration. |
| Supabase Queues (pgmq) | BullMQ + Redis | If you need sub-millisecond job latency or massive throughput (100K+ jobs/sec). pgmq is slower but eliminates an entire infrastructure dependency. For MVP volume, pgmq is more than sufficient. |
| Supabase Queues (pgmq) | Inngest | If deploying to Vercel (serverless) where you cannot run persistent workers. Inngest is hosted and handles durable workflows without infrastructure. But it cannot be self-hosted and adds vendor lock-in. For VPS deployment, pgmq wins. |
| Turborepo | Nx | If you have 5+ teams, need enforced architectural boundaries, or want built-in code generation. Nx is more powerful but adds conceptual overhead. For a solo/small team, Turborepo's simplicity wins. |
| Biome | ESLint + Prettier | If you need ESLint plugins not available in Biome (rare for this stack). Biome covers 95% of cases and is dramatically faster. |
| Tailwind CSS v4 | Tailwind CSS v3 | No reason to use v3 for a greenfield project. v4 is faster, simpler (CSS-only config), and what shadcn/ui CLI v4 targets. |
| Supabase client | Drizzle ORM | If you need complex multi-table joins with type inference, consider Drizzle in Phase 2+. For MVP, Supabase client is simpler and RLS works without transaction gymnastics. |
| Traefik | Nginx | If you prefer manual config and maximum control. Nginx is faster for static content but Traefik auto-discovers Docker containers via labels -- ideal for dynamic tenant deployments. |
| pnpm | npm/yarn | No reason to use npm/yarn in a Turborepo monorepo. pnpm workspace protocol and strict hoisting prevent phantom dependencies. |
| Recharts | Chart.js, D3 | Recharts is simpler for standard dashboard charts. Use D3 only if you need highly custom visualizations (you do not for MVP). |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| LangChain (direct) | Massive dependency tree, over-abstracted for custom agent systems. You are building Paperclip and OpenClaw from scratch -- LangChain's opinions will fight your architecture. | AI SDK 6 for LLM interface + custom orchestration logic |
| Redis (for MVP) | Adds infrastructure dependency when Supabase pgmq provides durable queues in Postgres. One less service to deploy, monitor, and pay for. | Supabase Queues (pgmq) |
| Prisma | Generated client is heavy (~2MB), cold starts are slow, and Prisma's RLS story is worse than Drizzle's. Supabase types generated from schema are lighter. | @supabase/supabase-js + generated types, or Drizzle ORM later |
| Pages Router | Maintenance mode. All new Next.js development is App Router. Server Components and Server Actions are essential for this admin panel. | App Router exclusively |
| CrewAI / AutoGen | Python-based agent frameworks. You are building in TypeScript. Cross-language adds deployment complexity for no benefit. | AI SDK 6 Agent abstraction + custom TypeScript services |
| Kubernetes | Massively over-engineered for single-VPS MVP. K8s makes sense at 50+ tenants with dynamic scaling needs. | Docker Compose on VPS |
| tRPC | Adds complexity when Next.js Server Actions handle mutations and route handlers cover API needs. tRPC shines for separate frontend/backend -- but apps/web IS the backend. | Server Actions + Route Handlers |
| NextAuth.js | Supabase Auth is already integrated and handles JWT, sessions, and RLS claims. Adding NextAuth creates two auth systems. | Supabase Auth |
| Styled Components / CSS Modules | Tailwind v4 + shadcn/ui covers all styling needs. Adding another CSS approach creates inconsistency. | Tailwind CSS v4 |
| Socket.io / WebSockets | Explicitly out of scope per PROJECT.md. Polling or Server Actions are sufficient for MVP. | Server Actions with revalidation, or polling |

## Stack Patterns by Variant

**If deploying to Vercel (future):**
- Replace Supabase Queues with Inngest for background jobs (serverless-compatible)
- Use Vercel Cron for scheduled tasks instead of pg_cron
- Use Vercel AI integration for edge-optimized streaming
- Keep Docker Compose for tenant agent stacks on separate VPS

**If scaling beyond single VPS:**
- Add Redis for high-throughput job queues (BullMQ)
- Consider Kubernetes for container orchestration
- Add pgBouncer for Postgres connection pooling
- Consider separate read replicas for analytics/audit queries

**If adding more LLM providers:**
- AI SDK 6 abstracts this entirely -- just add @ai-sdk/openai, @ai-sdk/google, etc.
- Per-agent model config already supported in agent_templates table
- No architecture changes needed

**If team grows beyond 3 developers:**
- Consider migrating Turborepo to Nx for enforced module boundaries
- Add Changesets for versioned package publishing
- Add Storybook for UI component documentation

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| next@15.5.x | react@19.2.x, react-dom@19.2.x | Next.js 15 requires React 19. Pin both. |
| ai@6.0.x | @ai-sdk/anthropic@3.0.x | AI SDK 6 uses v3 Language Model Specification. Provider versions must match major. |
| @ai-sdk/anthropic@3.0.x | @anthropic-ai/sdk@0.80.x | The AI SDK provider wraps the official Anthropic SDK. Both can coexist. |
| tailwindcss@4.2.x | shadcn/ui CLI v4 | shadcn CLI v4 generates Tailwind v4-compatible output with @theme directives. |
| zod@4.3.x | ai@6.0.x | AI SDK uses Zod for tool parameter schemas and structured output. Zod v4 is compatible. |
| @supabase/supabase-js@2.99.x | @supabase/ssr@latest | Use @supabase/ssr for Next.js App Router server-side auth. Required for cookie-based sessions. |
| turbo@2.8.x | pnpm@9.x | Turborepo's workspace support works best with pnpm. npm workspaces also supported but less ergonomic. |
| typescript@5.5+ | zod@4.3.x | Zod v4 requires TS 5.5+ and strict mode enabled. |
| supabase CLI | Postgres 15.6+ | Required for pgmq extension (queues). Check your Supabase project's Postgres version. |

## Architecture Decision: Two SDK Strategy for Claude

Use BOTH `@anthropic-ai/sdk` and `ai` (AI SDK) -- they serve different purposes:

**@anthropic-ai/sdk (direct):** Use for the Builder service where you need fine-grained control over Claude API calls -- structured output with `output_config.format`, prompt caching, long-running generation, batch API calls. Direct SDK gives maximum control for background processing.

**ai + @ai-sdk/anthropic (AI SDK):** Use for the Admin Panel streaming UI (command center chat), the Orchestrator's agent loops (ToolLoopAgent pattern), and anywhere you need streaming to the frontend. AI SDK 6's Agent abstraction maps directly to Paperclip's orchestrator-worker pattern.

This is not redundancy -- it is using each tool where it is strongest.

## Sources

- [Next.js releases](https://github.com/vercel/next.js/releases) -- Version 16.2.1 latest, 15.5.9 latest stable 15.x (MEDIUM confidence)
- [Next.js 15 vs 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16) -- Breaking changes documented (HIGH confidence)
- [AI SDK 6 announcement](https://vercel.com/blog/ai-sdk-6) -- Agent abstraction, v3 Language Model Spec (HIGH confidence)
- [AI SDK npm](https://www.npmjs.com/package/ai) -- Version 6.0.134 latest (HIGH confidence)
- [@ai-sdk/anthropic](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic) -- Claude provider docs, version 3.0.64 (HIGH confidence)
- [@anthropic-ai/sdk npm](https://www.npmjs.com/package/@anthropic-ai/sdk) -- Version 0.80.0 latest (HIGH confidence)
- [Anthropic structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) -- zodOutputFormat(), strict tool use (HIGH confidence)
- [Supabase Queues docs](https://supabase.com/docs/guides/queues) -- pgmq-based durable queues (HIGH confidence)
- [Supabase pgvector docs](https://supabase.com/docs/guides/database/extensions/pgvector) -- Vector embeddings in Postgres (HIGH confidence)
- [Supabase RLS best practices](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) -- Multi-tenant patterns (MEDIUM confidence)
- [Drizzle + Supabase RLS](https://makerkit.dev/docs/next-supabase-turbo/recipes/drizzle-supabase) -- Transaction-based RLS with Drizzle (MEDIUM confidence)
- [shadcn/ui CLI v4 changelog](https://ui.shadcn.com/docs/changelog/2026-03-cli-v4) -- March 2026 release (HIGH confidence)
- [Tailwind CSS v4](https://tailwindcss.com/blog/tailwindcss-v4) -- Performance improvements, CSS-only config (HIGH confidence)
- [Turborepo npm](https://www.npmjs.com/package/turbo) -- Version 2.8.20 (HIGH confidence)
- [Zod v4](https://zod.dev/v4) -- 14x performance improvement, @zod/mini (HIGH confidence)
- [Docker Compose for AI agents](https://www.docker.com/blog/build-ai-agents-with-docker-compose/) -- Agent deployment patterns (MEDIUM confidence)
- [Inngest vs BullMQ](https://www.inngest.com/blog/simplifying-queues-modern-kafka-alternative) -- Background job alternatives (MEDIUM confidence)
- [Turborepo vs Nx 2026](https://www.pkgpulse.com/blog/turborepo-vs-nx-monorepo-2026) -- Monorepo comparison (MEDIUM confidence)
- [React 19.2](https://react.dev/blog/2025/10/01/react-19-2) -- Latest React stable (HIGH confidence)

---
*Stack research for: Multi-tenant AI agent deployment platform*
*Researched: 2026-03-25*
