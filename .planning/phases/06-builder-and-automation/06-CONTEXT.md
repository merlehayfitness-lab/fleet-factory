# Phase 6: Builder and Automation - Context

**Gathered:** 2026-03-26 (revised)
**Status:** Ready for planning

<domain>
## Phase Boundary

Rewrite the deployment pipeline to generate OpenClaw-native workspace artifacts, push them to a Hostinger VPS via OpenClaw's REST API, and have Claude Code on the VPS review/optimize and deploy the agent stack. Wire up live task execution and chat routing so admin actions flow through to real agents on the VPS. The admin web app (Vercel) becomes the control plane; Claude Code + OpenClaw on the VPS is the runtime. This phase does NOT add RAG/knowledge base infrastructure (Phase 7) or role definition/prompt generation UX (Phase 8) — it makes the existing deployment pipeline actually deploy to real infrastructure and connects the admin app to live agents.

</domain>

<decisions>
## Implementation Decisions

### VPS communication
- Lightweight API on VPS: admin app talks to OpenClaw's REST gateway API on the VPS over HTTPS
- Claude Code IS the gateway — deployment commands are routed through OpenClaw's messaging/API layer so Claude Code receives and executes them
- Auth: API key + HTTPS (shared secret in headers) — sufficient for single-admin MVP
- Real-time streaming via WebSocket — admin sees live deployment progress as Claude Code works, can send cancel commands
- VPS health check endpoint — admin dashboard pings VPS on page load and shows VPS status indicator (online/offline/degraded)
- Deployments processed serially (queued) — one deployment at a time, others wait in queue to avoid resource contention on VPS

### OpenClaw workspace shape
- Each agent is a fully isolated OpenClaw agent with its own workspace and Docker container — even multiple agents within the same department (e.g. Sales → Paid Ads agent, Cold Traffic agent)
- Always-on Docker containers per agent — containers run 24/7 for instant task execution
- Pre-built common sandbox image with all tools pre-installed (Node.js, Python, curl, etc.) — using OpenClaw's sandbox-common-setup pattern
- Single shared OpenClaw gateway for all tenants — agent bindings/routing separate tenants, scale to dedicated VPS per tenant later
- Admin controls model per agent — maps to our existing model_profile (e.g., Opus for Owner, Sonnet for Support)
- Inter-agent messaging enabled within the same business — enables workflows like Sales handing off to Support
- Shared read-only business directory — all agents in a business can read shared docs (brand guidelines, product info, FAQs) via Docker bind mount
- Unique SOUL.md per agent — tailored to department and specific role (Paid Ads agent has different persona than Cold Traffic agent)
- AGENTS.md generation is hybrid — admin app generates base from system_prompt + tool_profile, Claude Code on VPS reviews and optimizes using its OpenClaw expertise
- Claude Code decides skill assignments per agent — admin app sends department/role info, Claude Code assigns appropriate OpenClaw skills
- Agent memory persists across redeployments — session transcripts and accumulated knowledge survive deploys, agents learn and improve over time
- Agents have full network access from Docker containers — needed for real integrations (CRM, email, etc.)

### Deployment push flow
- Hybrid artifact generation: admin app generates base OpenClaw workspace package (AGENTS.md, SOUL.md, openclaw.json scaffolds from our agent configs), sends to VPS, Claude Code reviews/refines/optimizes before deploying
- Claude Code sends back full diff report after optimization — structured report of what it changed, why, and final workspace state stored in deployment record
- Rollback restores previous workspace snapshot — exact files from last successful deploy, not re-running through Claude Code
- Both full-tenant and per-agent deployment supported — full tenant deploy by default, option to deploy individual agents when needed
- Partial failure keeps successes — if 3 of 5 agents deploy successfully and 2 fail, the 3 stay live, failed ones get retried
- Two-layer validation: admin app does basic validation (schema, required fields) before sending; Claude Code on VPS does deeper validation (OpenClaw compatibility, security, optimization)
- Deployment progress: phase summaries by default ("Generating workspace... Starting agents..."), expandable to see detailed log per step
- Automated post-deploy health check — admin app pings each agent through OpenClaw gateway after deploy, marks deployment as verified/degraded
- Artifacts stored in both Supabase + VPS — Supabase for history/rollback/audit, VPS for runtime

### Live task/chat routing to VPS
- Tasks created in admin app → sent to VPS via OpenClaw REST API → real agent executes → result flows back to admin app and updates task status
- Chat messages from admin app → routed to correct agent on VPS → real agent responds → message flows back to conversation in admin app
- Replace Phase 4's mock tool execution and Phase 5's stub chat responses with real VPS agent calls
- The orchestrator (Paperclip) on the admin app side decides WHICH agent handles a task/message; the VPS side handles HOW the agent executes
- Agent responses from VPS are stored in Supabase (existing messages/tasks tables) for history and audit
- If VPS is unreachable, tasks queue and chat shows "Agent offline" — graceful degradation, not crash

### Claude Code bootstrap
- Shared VPS for MVP — all tenants on one Hostinger VPS, option to move high-value tenants to dedicated VPS later
- One-time manual VPS setup — you SSH in, install Claude Code + OpenClaw, run bootstrap prompt to teach Claude Code the system
- After bootstrap, admin app fully manages tenant lifecycle via Claude Code collaboration — admin app sends "create tenant" command, Claude Code handles actual workspace creation using OpenClaw knowledge
- Both admin app and Claude Code maintain tenant state — admin app (Supabase) is source of truth, Claude Code maintains local awareness that syncs back to admin app
- Admin-triggered re-learning — admin can send a "re-bootstrap" command when OpenClaw has been updated or they want Claude Code to refresh its understanding
- Per-deployment instructions are structured commands (not freeform prompts) — admin app sends agent configs + deployment metadata, Claude Code interprets using its bootstrapped OpenClaw expertise

### Claude's Discretion
- Exact OpenClaw workspace file structure and naming conventions
- How Claude Code optimizes AGENTS.md beyond what the admin app generates
- Which OpenClaw skills to assign per agent type
- How to handle inter-agent communication routing within a business
- Sandbox image customization per department type
- How to structure the shared business directory
- WebSocket message format and progress event granularity
- Health check methodology and degradation thresholds

</decisions>

<specifics>
## Specific Ideas

- The deployment flow should feel like giving instructions to a smart operations manager — admin describes what they want, Claude Code on VPS makes it happen and reports back
- The admin app generates the "what" (agent configs, business context), Claude Code on VPS handles the "how" (OpenClaw workspace setup, optimization, container management)
- Real-time deployment streaming should feel like watching a CI/CD pipeline — phase summaries with expandable detail
- VPS status indicator in the admin dashboard gives immediate confidence that infrastructure is healthy
- Agent memory persistence is critical — agents should get better over time as they accumulate domain knowledge
- The diff report from Claude Code after optimization should be visible in the deployment detail view so admin can see exactly what Claude Code changed and why

</specifics>

<deferred>
## Deferred Ideas

- Dedicated VPS per tenant (scale-out) — future capability when tenant count or revenue justifies it
- Automated VPS provisioning (spin up new Hostinger VPS programmatically) — future phase
- Client-facing app for business owners — separate project, out of scope entirely
- RAG knowledge base (pgvector, document upload, chunking, embeddings, retrieval) — Phase 7
- Role Definition card + Claude-powered system prompt generator — Phase 8
- Agent setup wizard Step 4 (knowledge upload) — Phase 7
- Knowledge Base section on agent config tab (global + per-agent two-zone) — Phase 7
- Runtime knowledge injection (prepend retrieved context to system prompt) — Phase 7

</deferred>

---

*Phase: 06-builder-and-automation*
*Context gathered: 2026-03-26 (revised with OpenClaw alignment)*
