# Architecture Research

**Domain:** Multi-tenant AI agent deployment and management platform (SaaS)
**Researched:** 2026-03-25
**Confidence:** MEDIUM-HIGH

## System Overview

```
                          Agency Factory — 5-Layer Architecture
 ============================================================================

 LAYER 1: PRESENTATION (Next.js App Router)
 ┌────────────────────────────────────────────────────────────────────────────┐
 │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
 │  │  Auth Pages   │  │  Biz Wizard  │  │  Dashboard   │  │ Command Ctr  │  │
 │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  │
 │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
 │  │  Departments  │  │   Agents     │  │  Deploy Ctr  │  │  Audit Logs  │  │
 │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  │
 │                    Server Actions + API Route Handlers                    │
 └───────────────────────────────┬────────────────────────────────────────────┘
                                 │
 LAYER 2: SERVICE LAYER (packages/core)
 ┌───────────────────────────────┴────────────────────────────────────────────┐
 │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐           │
 │  │ Tenant Service   │  │  Agent Service   │  │ Deploy Service  │           │
 │  │ - provision()    │  │ - fromTemplate() │  │ - generate()    │           │
 │  │ - seedDepts()    │  │ - configure()    │  │ - execute()     │           │
 │  │ - membership()   │  │ - status()       │  │ - rollback()    │           │
 │  └─────────────────┘  └─────────────────┘  └─────────────────┘           │
 │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐           │
 │  │  Task Service    │  │ Approval Service │  │  Audit Service  │           │
 │  │ - create()       │  │ - request()      │  │ - log()         │           │
 │  │ - assign()       │  │ - approve()      │  │ - query()       │           │
 │  │ - complete()     │  │ - reject()       │  │ - export()      │           │
 │  └─────────────────┘  └─────────────────┘  └─────────────────┘           │
 └───────────────────────────────┬────────────────────────────────────────────┘
                                 │
 LAYER 3: AGENT RUNTIME SERVICES
 ┌───────────────────────────────┴────────────────────────────────────────────┐
 │  ┌───────────────────────┐  ┌────────────────────┐  ┌──────────────────┐  │
 │  │  Orchestrator          │  │  Worker Runtime     │  │  Builder Agent   │  │
 │  │  (Paperclip)           │  │  (OpenClaw)         │  │  (Claude API)    │  │
 │  │                        │  │                     │  │                  │  │
 │  │  - Task decomposition  │  │  - Tool execution   │  │  - Config gen    │  │
 │  │  - Role assignment     │  │  - Plugin system     │  │  - Prompt gen    │  │
 │  │  - Routing             │  │  - Sandbox exec     │  │  - Template ops  │  │
 │  │  - Approval gates      │  │  - Result reporting │  │  - Artifact gen  │  │
 │  └───────────────────────┘  └────────────────────┘  └──────────────────┘  │
 └───────────────────────────────┬────────────────────────────────────────────┘
                                 │
 LAYER 4: DATA LAYER (Supabase + packages/db)
 ┌───────────────────────────────┴────────────────────────────────────────────┐
 │  ┌───────────────┐  ┌───────────────┐  ┌────────────────┐                 │
 │  │  Supabase Auth │  │  Postgres DB   │  │  Storage/Files │                 │
 │  │  - JWT + RLS   │  │  - RLS on all  │  │  - Agent configs│                │
 │  │  - User mgmt   │  │  - Tenant iso. │  │  - Deploy arts. │                │
 │  └───────────────┘  └───────────────┘  └────────────────┘                 │
 └───────────────────────────────┬────────────────────────────────────────────┘
                                 │
 LAYER 5: INFRASTRUCTURE
 ┌───────────────────────────────┴────────────────────────────────────────────┐
 │  ┌───────────────────────────┐  ┌──────────────────────────────────────┐  │
 │  │  VPS Host (Docker)         │  │  Generated Tenant Artifacts          │  │
 │  │  - docker-compose          │  │  - tenant-config.json                │  │
 │  │  - Traefik/Nginx routing   │  │  - docker-compose.generated.yml     │  │
 │  │  - Container orchestration │  │  - .env.generated                   │  │
 │  └───────────────────────────┘  │  - per-agent runtime configs         │  │
 │                                  └──────────────────────────────────────┘  │
 └────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| **Presentation (apps/web)** | UI rendering, form handling, route protection, server actions as thin entry points | Service Layer via direct function calls |
| **Tenant Service** | Business CRUD, provisioning orchestration, membership management, department seeding | Data Layer, Agent Service, Deploy Service |
| **Agent Service** | Agent lifecycle from template, configuration, status management | Data Layer, Worker Runtime |
| **Deploy Service** | Config generation, Docker artifact creation, deployment execution and status tracking | Data Layer, Infrastructure Layer |
| **Task Service** | Work queue management, assignment routing, status transitions | Data Layer, Orchestrator |
| **Approval Service** | Approval request lifecycle, approve/reject handling, timeout escalation | Data Layer, Task Service, Audit Service |
| **Audit Service** | Event logging for all state changes, query interface for audit trail | Data Layer |
| **Orchestrator (Paperclip)** | Task decomposition, department-based routing, approval gate decisions, company structure | Task Service, Approval Service, Worker Runtime |
| **Worker Runtime (OpenClaw)** | Tool execution, sandboxed agent runs, result collection | Orchestrator, external tool APIs |
| **Builder Agent** | Prompt/config generation from templates, artifact creation via Claude API | Agent Service, Deploy Service |
| **Data Layer (Supabase)** | Auth, Postgres with RLS, file storage for configs | All services |
| **Infrastructure** | Container hosting, routing, secret management | Deploy Service |

## Recommended Project Structure

```
agency-factory/
├── apps/
│   └── web/                        # Next.js admin panel
│       ├── app/                    # App Router pages
│       │   ├── (auth)/             # Auth route group
│       │   │   ├── sign-in/
│       │   │   └── sign-up/
│       │   ├── (dashboard)/        # Protected route group
│       │   │   ├── businesses/
│       │   │   │   ├── [id]/
│       │   │   │   │   ├── overview/
│       │   │   │   │   ├── departments/
│       │   │   │   │   ├── agents/
│       │   │   │   │   │   └── [agentId]/
│       │   │   │   │   ├── deploy/
│       │   │   │   │   ├── tasks/
│       │   │   │   │   ├── approvals/
│       │   │   │   │   ├── chat/
│       │   │   │   │   └── audit/
│       │   │   │   └── new/        # Create wizard
│       │   │   └── layout.tsx      # Dashboard shell
│       │   ├── api/                # API route handlers
│       │   │   ├── businesses/
│       │   │   ├── agents/
│       │   │   ├── deployments/
│       │   │   ├── approvals/
│       │   │   └── builder/
│       │   └── layout.tsx          # Root layout
│       ├── _actions/               # Server actions (thin wrappers)
│       │   ├── business-actions.ts
│       │   ├── agent-actions.ts
│       │   ├── deploy-actions.ts
│       │   └── approval-actions.ts
│       └── _components/            # App-specific UI components
├── packages/
│   ├── db/                         # Database schema + access
│   │   ├── schema/                 # SQL migrations
│   │   ├── types/                  # Generated TypeScript types
│   │   ├── queries/                # Typed query functions
│   │   └── helpers/                # RLS helpers, tenant scoping
│   ├── core/                       # Domain logic (service layer)
│   │   ├── tenant/                 # Tenant provisioning + management
│   │   ├── agent/                  # Agent lifecycle
│   │   ├── task/                   # Task queue management
│   │   ├── approval/               # Approval workflow
│   │   ├── deployment/             # Config generation + execution
│   │   ├── audit/                  # Audit logging
│   │   └── types/                  # Shared domain types
│   ├── ui/                         # Shared UI components (shadcn)
│   ├── runtime/                    # Runtime config generation
│   │   ├── builders/               # Config file generators
│   │   ├── templates/              # Base config templates
│   │   └── validators/             # Config validation
│   └── orchestrator/               # Paperclip orchestrator
│       ├── router/                 # Task routing logic
│       ├── planner/                # Task decomposition
│       └── gates/                  # Approval gate policies
├── services/
│   ├── worker/                     # OpenClaw worker runtime
│   │   ├── executor/               # Tool execution engine
│   │   ├── plugins/                # Tool plugins (CRM, email, etc.)
│   │   └── sandbox/                # Execution sandbox
│   └── builder/                    # Claude-powered builder agent
│       ├── generators/             # Prompt/config generators
│       └── templates/              # Agent template definitions
├── infra/
│   ├── docker/                     # Docker configs
│   ├── scripts/                    # Deployment scripts
│   └── templates/                  # Generated artifact templates
└── templates/                      # Department agent templates
    ├── owner/
    ├── sales/
    ├── support/
    └── operations/
```

### Structure Rationale

- **apps/web/_actions/:** Server actions are thin wrappers that validate input, call service layer functions in `packages/core`, and return results. They never contain business logic. This keeps the Next.js layer replaceable.
- **packages/core/:** All business logic lives here. Services are pure functions that accept a Supabase client (for RLS context) and domain inputs. No framework imports. Testable in isolation.
- **packages/db/:** Single source of truth for schema, migrations, types, and query helpers. Every service accesses the database through this package, never directly.
- **packages/runtime/:** Config generation is a pure data transformation concern. Given a tenant + agents + settings, produce deployment artifacts. Separated so it can be tested without Supabase or Next.js.
- **services/worker/ and services/builder/:** These are long-running processes, not request-response. They live outside `packages/` because they are independently deployable services, not shared libraries.

## Architectural Patterns

### Pattern 1: Tenant-Scoped Service Functions

**What:** Every service function receives a tenant-scoped Supabase client. RLS automatically enforces data boundaries. The service layer never manually filters by `business_id` -- RLS does it.
**When to use:** Every data operation touching tenant data.
**Trade-offs:** Slightly more setup per function, but eliminates an entire class of data leakage bugs. Performance requires composite indexes on `(business_id, ...)` columns.

**Example:**
```typescript
// packages/core/tenant/provision-tenant.ts
import { createClient } from '@/packages/db/client';
import type { Database } from '@/packages/db/types';

export async function provisionBusinessTenant(
  supabase: SupabaseClient<Database>,
  input: { name: string; slug: string; industry: string; ownerUserId: string }
) {
  // All 5 steps run in a transaction-like flow
  // RLS ensures only the creating user can see the result

  const { data: business } = await supabase
    .from('businesses')
    .insert({ name: input.name, slug: input.slug, industry: input.industry, owner_user_id: input.ownerUserId, status: 'provisioning' })
    .select()
    .single();

  // 2. Create owner membership
  await supabase.from('business_users')
    .insert({ business_id: business.id, user_id: input.ownerUserId, role: 'owner' });

  // 3. Seed departments
  const departments = await seedDefaultDepartments(supabase, business.id);

  // 4. Create agents from templates
  const agents = await createAgentsFromTemplates(supabase, business.id, departments);

  // 5. Queue deployment
  await supabase.from('deployments')
    .insert({ business_id: business.id, version: '1.0.0', environment: 'production', status: 'queued' });

  return business;
}
```

### Pattern 2: Human-in-the-Loop Approval Gate

**What:** A policy layer classifies agent actions as "allow", "require_approval", or "deny" based on risk level. Actions requiring approval enter an async queue. The agent does not block -- it parks the action and continues with other work. Approved actions resume execution; rejected actions record the reason and notify.
**When to use:** Any agent action that modifies external systems, spends budget, or sends communications.
**Trade-offs:** Adds latency to risky actions (by design). Requires durable state for pending approvals and a reviewer UI. Must handle timeouts (fail-closed: if no human responds within the SLA, default to deny).

**Example:**
```typescript
// packages/core/approval/gate.ts
type GateDecision = 'allow' | 'require_approval' | 'deny';

interface GatePolicy {
  actionType: string;
  riskLevel: 'low' | 'medium' | 'high';
  decision: GateDecision;
  timeoutSeconds: number;
}

const GATE_POLICIES: GatePolicy[] = [
  { actionType: 'read_dashboard',    riskLevel: 'low',    decision: 'allow',            timeoutSeconds: 0 },
  { actionType: 'send_email',        riskLevel: 'medium', decision: 'require_approval', timeoutSeconds: 300 },
  { actionType: 'process_payment',   riskLevel: 'high',   decision: 'require_approval', timeoutSeconds: 600 },
  { actionType: 'delete_data',       riskLevel: 'high',   decision: 'deny',             timeoutSeconds: 0 },
];

export function evaluateGate(actionType: string): GatePolicy {
  return GATE_POLICIES.find(p => p.actionType === actionType)
    ?? { actionType, riskLevel: 'high', decision: 'require_approval', timeoutSeconds: 300 };
}
```

### Pattern 3: Config Generation as Pure Data Transformation

**What:** Deployment artifact generation is a pure function: given tenant data + agent configs + templates, produce files. No side effects. No database calls. No network requests. Input goes in, files come out.
**When to use:** Generating `tenant-config.json`, `docker-compose.generated.yml`, `.env.generated`, and per-agent runtime configs.
**Trade-offs:** Requires assembling all needed data before calling the generator. But makes the generator trivially testable and cacheable.

**Example:**
```typescript
// packages/runtime/builders/compose-builder.ts
interface TenantDeployInput {
  business: { id: string; slug: string; name: string };
  agents: Array<{ name: string; runtimeType: string; toolProfile: object; modelProfile: string }>;
  integrations: Array<{ provider: string; configRef: string }>;
  environment: 'staging' | 'production';
}

interface DeployArtifacts {
  tenantConfig: object;
  dockerCompose: string;
  envFile: string;
  agentConfigs: Array<{ agentName: string; config: object }>;
}

export function generateDeployArtifacts(input: TenantDeployInput): DeployArtifacts {
  // Pure function: no side effects, no DB calls
  return {
    tenantConfig: buildTenantConfig(input),
    dockerCompose: buildDockerCompose(input),
    envFile: buildEnvFile(input),
    agentConfigs: input.agents.map(a => ({
      agentName: a.name,
      config: buildAgentConfig(a, input.business),
    })),
  };
}
```

### Pattern 4: Thin Server Actions Delegating to Core Services

**What:** Server actions in the Next.js app are 5-15 lines: validate input with Zod, get the Supabase client (which carries auth context and RLS), call a service function from `packages/core`, return the result. No business logic in the action.
**When to use:** Every mutation from the UI.
**Trade-offs:** Slight indirection. But it means the entire business logic layer is framework-independent, testable without Next.js, and reusable if you ever add a CLI or different frontend.

**Example:**
```typescript
// apps/web/_actions/business-actions.ts
'use server';

import { createServerClient } from '@/packages/db/server-client';
import { provisionBusinessTenant } from '@/packages/core/tenant/provision-tenant';
import { businessInputSchema } from '@/packages/core/tenant/schema';

export async function createBusiness(formData: FormData) {
  const supabase = await createServerClient();
  const input = businessInputSchema.parse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    industry: formData.get('industry'),
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  return provisionBusinessTenant(supabase, { ...input, ownerUserId: user.id });
}
```

## Data Flow

### Flow 1: Tenant Provisioning

```
Admin User
    │
    ├─[1]─→ Create Business Wizard (UI)
    │         │
    │         ├─[2]─→ Server Action: createBusiness()
    │         │         │
    │         │         ├─[3]─→ Tenant Service: provisionBusinessTenant()
    │         │         │         │
    │         │         │         ├─[3a]─→ INSERT businesses          ──→ Postgres (RLS)
    │         │         │         ├─[3b]─→ INSERT business_users      ──→ Postgres (RLS)
    │         │         │         ├─[3c]─→ INSERT departments (x4)    ──→ Postgres (RLS)
    │         │         │         ├─[3d]─→ INSERT agents (from tmpl)  ──→ Postgres (RLS)
    │         │         │         └─[3e]─→ INSERT deployments (queued)──→ Postgres (RLS)
    │         │         │
    │         │         └─[4]─→ Return business record to UI
    │
    ├─[5]─→ Background: Deploy Service picks up queued deployment
    │         │
    │         ├─[5a]─→ Fetch tenant + agent data from DB
    │         ├─[5b]─→ generateDeployArtifacts() (pure function)
    │         ├─[5c]─→ Write artifacts to file system / storage
    │         ├─[5d]─→ Execute docker-compose on VPS
    │         └─[5e]─→ UPDATE deployments SET status = 'complete'
    │
    └─[6]─→ Dashboard shows business status: active
```

### Flow 2: Live Agent Operation (Task with Approval)

```
Task Input (UI or integration)
    │
    ├─[1]─→ Task Service: create task
    │         │
    │         └─[2]─→ Orchestrator (Paperclip): route task
    │                   │
    │                   ├─[2a]─→ Decompose into sub-tasks if needed
    │                   ├─[2b]─→ Identify target department + agent
    │                   └─[2c]─→ Dispatch to Worker Runtime (OpenClaw)
    │
    ├─[3]─→ Worker (OpenClaw): begin execution
    │         │
    │         ├─[3a]─→ Load agent config + tool profile
    │         ├─[3b]─→ Execute tool (e.g., send_email)
    │         │
    │         └─[3c]─→ Approval Gate evaluates action
    │                   │
    │                   ├── LOW RISK → Execute immediately
    │                   │
    │                   └── HIGH RISK → Create approval request
    │                         │
    │                         ├─[4]─→ INSERT approvals (status: pending)
    │                         ├─[5]─→ UI shows approval in queue
    │                         │
    │                         ├─[6]─→ Human approves / rejects
    │                         │         │
    │                         │         ├── APPROVED → Resume execution
    │                         │         └── REJECTED → Log reason, notify
    │                         │
    │                         └─[7]─→ Audit Service logs decision
    │
    └─[8]─→ Task marked complete, result stored in conversations
```

### Flow 3: Builder Agent Iteration

```
Admin triggers template update
    │
    ├─[1]─→ Builder Service receives update request
    │         │
    │         ├─[2]─→ Claude API: generate updated prompt/config
    │         │
    │         ├─[3]─→ Validate generated artifacts
    │         │
    │         ├─[4]─→ UPDATE agent_templates with new config
    │         │
    │         └─[5]─→ For each business using this template:
    │                   │
    │                   ├─[5a]─→ UPDATE agents with new config
    │                   └─[5b]─→ Queue redeployment if needed
    │
    └─[6]─→ Audit log: template change + affected tenants
```

### State Management

The platform is server-centric. No complex client-side state management needed.

```
Supabase Auth (JWT)
    │
    ├─── Session in httpOnly cookie (managed by Supabase Auth helpers)
    │
    ├─── RLS policies use auth.uid() and is_business_member()
    │     to scope every query automatically
    │
    ├─── Server Components fetch data directly (no client state)
    │
    ├─── Server Actions handle all mutations (no client-side API calls)
    │
    └─── React state limited to UI concerns:
         - Form inputs and validation
         - Modal open/close
         - Optimistic updates for approve/reject
         - Polling intervals for deployment status
```

## Scaling Considerations

| Concern | MVP (single VPS) | 10-50 tenants | 100+ tenants |
|---------|-------------------|---------------|--------------|
| **Database** | Single Supabase instance, RLS isolation | Add read replicas, optimize indexes on (business_id, ...) | Consider Supabase Pro/Team plan, connection pooling |
| **Agent execution** | All agents share VPS resources | Resource limits per container (CPU/memory caps) | Move to multi-VPS or Kubernetes |
| **Task throughput** | Polling-based queue from DB | Add pg_notify for near-real-time pickup | Move to dedicated queue (Redis/BullMQ) |
| **Deployment pipeline** | Sequential deploy on single VPS | Parallel deploys with job locking | Dedicated deployment workers |
| **File storage** | Local filesystem on VPS | Supabase Storage / S3 | CDN + S3 with per-tenant buckets |
| **Audit logs** | Same Postgres table | Partitioned table by month | Move to append-only store (TimescaleDB) |

### Scaling Priorities

1. **First bottleneck: Database connections.** Each server action opens a Supabase client. With multiple concurrent users across tenants, connection pooling (Supabase uses PgBouncer by default) becomes critical. Monitor active connections early.
2. **Second bottleneck: Agent container density.** Running 4 agents per tenant in containers on a single VPS hits memory limits around 10-20 tenants. Mitigation: agents share a worker process pool rather than getting individual containers for MVP. Individual containers are a post-MVP luxury.
3. **Third bottleneck: Deployment queue.** Sequential provisioning blocks at scale. Add a proper job queue (BullMQ or pg-based) when provisioning takes more than a few seconds.

## Anti-Patterns

### Anti-Pattern 1: Business Logic in Server Actions

**What people do:** Put validation, authorization checks, multi-step workflows, and error handling directly in Next.js server actions.
**Why it's wrong:** Couples all business logic to the framework. Impossible to test without Next.js test harness. Cannot reuse logic from API routes, CLI tools, or worker processes.
**Do this instead:** Server actions are 5-15 line wrappers. All logic lives in `packages/core/` as plain TypeScript functions.

### Anti-Pattern 2: Manual Tenant Filtering Instead of RLS

**What people do:** Add `.where('business_id', tenantId)` to every query manually across the codebase.
**Why it's wrong:** One missed filter = cross-tenant data leak. Impossible to audit comprehensively. New developers will forget.
**Do this instead:** Use Supabase RLS policies with `is_business_member(business_id)`. The database enforces isolation. Application code never filters by tenant -- RLS does it automatically via the JWT.

### Anti-Pattern 3: Monolithic Agent Runtime

**What people do:** Build one big "agent process" that handles orchestration, tool execution, approval checking, and result reporting in a single function.
**Why it's wrong:** Cannot test components independently. Cannot scale orchestration separately from execution. One bug in tool execution crashes the orchestrator.
**Do this instead:** Separate Orchestrator (what to do) from Worker (how to do it) from Gate (should we do it). Each has clear inputs and outputs.

### Anti-Pattern 4: Shared Mutable Config Files

**What people do:** Generate deployment configs and then mutate them in place during operations.
**Why it's wrong:** Race conditions between provisioning and redeployment. Cannot roll back. Cannot diff changes.
**Do this instead:** Config generation is immutable. Each deployment creates new versioned artifacts. Old versions are retained for rollback. Deployments reference a specific artifact version.

### Anti-Pattern 5: Synchronous Provisioning

**What people do:** Make the user wait while all 5 provisioning steps complete, including container deployment, in a single HTTP request.
**Why it's wrong:** Timeouts. Partial failures leave half-provisioned tenants. Bad UX.
**Do this instead:** Provisioning step 1-5 (DB records) is synchronous and fast (<1s). Deployment (containers, configs) is async via a queued job. UI polls for deployment status.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **Supabase Auth** | JWT-based, httpOnly cookies, server-side validation | Auth helpers for Next.js handle token refresh |
| **Supabase Postgres** | Direct via `@supabase/supabase-js`, typed queries | RLS enforces tenant isolation automatically |
| **Claude API** | REST API calls from Builder Service | Rate limit: queue builder requests, retry with backoff |
| **External tools (CRM, email, calendar)** | Adapter pattern with interface + mock | Use stubs in MVP. Real integrations are plug-and-play via adapter interface |
| **Docker Engine** | Docker CLI or Docker SDK from Deploy Service | Runs on VPS. Deploy Service generates compose files and executes |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **UI <-> Service Layer** | Server Actions (mutations), Server Components (reads) | No REST API needed for internal UI operations |
| **Service Layer <-> DB** | `packages/db` query functions with typed Supabase client | All queries go through `packages/db`, never raw SQL in services |
| **Orchestrator <-> Worker** | Function calls in MVP (same process), message queue later | Start co-located, split when scaling requires it |
| **Deploy Service <-> VPS** | Shell exec / Docker SDK | Deploy service runs on VPS alongside the app in MVP |
| **Builder <-> Claude API** | HTTP REST with retry/backoff | Async job, not blocking user requests |
| **API Routes <-> External clients** | REST JSON endpoints at `/api/v1/*` | For programmatic access, webhooks, and future integrations |

## Build Order (Dependencies)

The architecture has clear dependency chains that dictate build order.

```
Phase 1: Foundation (nothing depends on this yet, everything depends on it later)
  ├── packages/db (schema, types, RLS policies, query helpers)
  ├── Supabase Auth setup
  └── packages/core/tenant (provisioning, membership)

Phase 2: Admin Shell (depends on Phase 1)
  ├── apps/web auth pages
  ├── apps/web business CRUD + wizard
  ├── apps/web dashboard
  └── packages/core/audit (logging foundation)

Phase 3: Agent Management (depends on Phase 1 DB + Phase 2 UI)
  ├── packages/core/agent (template-based creation)
  ├── apps/web agent list + detail
  ├── apps/web department setup
  └── templates/ (department agent templates)

Phase 4: Deployment Pipeline (depends on Phase 1 + Phase 3 agents)
  ├── packages/runtime (config generation, pure functions)
  ├── packages/core/deployment (job queue, status tracking)
  ├── apps/web deployment center
  └── infra/ (Docker configs, scripts)

Phase 5: Live Operations (depends on Phase 3 agents + Phase 4 deployment)
  ├── packages/orchestrator (Paperclip: routing, decomposition)
  ├── services/worker (OpenClaw: tool execution)
  ├── packages/core/task (work queue)
  ├── packages/core/approval (HITL gates)
  ├── apps/web tasks page
  └── apps/web approvals page

Phase 6: Intelligence Layer (depends on Phase 3 + Phase 4)
  ├── services/builder (Claude-powered config generation)
  ├── apps/web command center chat
  └── Template rollout across tenants
```

**Critical path:** Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5. Phase 6 can start in parallel with Phase 5 once Phase 3 and 4 are complete.

## Sources

- [Microsoft: Architectural Approaches for AI/ML in Multitenant Solutions](https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/approaches/ai-machine-learning) - HIGH confidence (official documentation, updated 2026-03-06)
- [Redis: AI Agent Architecture — Build Systems That Work in 2026](https://redis.io/blog/ai-agent-architecture/) - MEDIUM confidence (vendor blog, but comprehensive technical content)
- [Agent Patterns: Human-in-the-Loop Architecture](https://www.agentpatterns.tech/en/architecture/human-in-the-loop-architecture) - MEDIUM confidence (pattern reference, verified by multiple sources)
- [Supabase: Row Level Security Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security) - HIGH confidence (official documentation)
- [MakerKit: Next.js 16 App Router Project Structure](https://makerkit.dev/blog/tutorials/nextjs-app-router-project-structure) - MEDIUM confidence (well-known SaaS template, patterns align with Next.js docs)
- [Microsoft: AI Agent Orchestration Patterns](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns) - HIGH confidence (official documentation)
- [AWS: Building Multi-tenant Architectures for Agentic AI](https://docs.aws.amazon.com/pdfs/prescriptive-guidance/latest/agentic-ai-multitenant/agentic-ai-multitenant.pdf) - HIGH confidence (official prescriptive guidance)
- [DEV Community: Enforcing RLS in Supabase Multi-Tenant Architecture](https://dev.to/blackie360/-enforcing-row-level-security-in-supabase-a-deep-dive-into-lockins-multi-tenant-architecture-4hd2) - LOW confidence (community post, but patterns align with Supabase docs)

---
*Architecture research for: Multi-tenant AI Agent Deployment and Management Platform*
*Researched: 2026-03-25*
