# Pitfalls Research

**Domain:** Multi-tenant AI agent deployment platform (Fleet Factory)
**Researched:** 2026-03-25
**Confidence:** HIGH (corroborated across OWASP, AWS, Microsoft, multiple post-mortems, and Supabase official docs)

## Critical Pitfalls

### Pitfall 1: Cross-Tenant Data Leakage Through Incomplete RLS

**What goes wrong:**
Tenant A's agents, tasks, conversations, or credentials become visible to Tenant B. This is the single most catastrophic failure mode for a multi-tenant platform. In January 2025, 170+ apps built on Supabase were found with exposed databases (CVE-2025-48757) because RLS was not enabled. Industry data shows 83% of exposed Supabase databases involve RLS misconfigurations.

**Why it happens:**
- RLS is disabled by default on new Supabase tables. Every new table is 100% public until you explicitly enable RLS and create policies.
- The supabase-js client uses PostgREST, and developers assume the ORM handles scoping -- it does not.
- Developers create `SELECT` policies with `true` to "make the frontend work" during development and forget to tighten them.
- New tables added mid-project (feature flags, notifications, analytics) miss the RLS pattern established at the start.
- `auth.uid()` returns the user UUID, not the tenant. If your tenant scoping depends on a join through `business_users`, a naive `auth.uid() = user_id` policy on a tenant-scoped table leaks data to users who belong to multiple businesses.

**How to avoid:**
1. Create a reusable `is_business_member(business_id)` SQL function (already planned in PROJECT.md -- good). Use it on every single operational table without exception.
2. Write a migration-time check: a CI/test that queries `pg_tables` and verifies every non-system table has RLS enabled with at least one policy.
3. Never use `true` as a policy expression, even in development. Use the real membership check from day one.
4. Test RLS from the client SDK, not the SQL Editor. The SQL Editor bypasses RLS entirely, giving false confidence.
5. Add integration tests that authenticate as User-in-Tenant-A and assert zero rows returned from Tenant-B scoped queries.

**Warning signs:**
- Any table creation migration that does not include `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` in the same file.
- SELECT policies containing `USING (true)`.
- No RLS test suite in CI.
- Developers testing only via Supabase Dashboard SQL editor.

**Phase to address:**
Phase 1 (Auth, business creation, tenant scoping). RLS must be the very first thing built and tested. Every subsequent phase must include RLS verification for any new tables.

---

### Pitfall 2: Agent Prompt Injection Leading to Cross-Tenant Data Exfiltration

**What goes wrong:**
A malicious or compromised input to one tenant's agent causes the LLM to execute instructions that access another tenant's data, exfiltrate credentials, or bypass approval gates. OWASP ranks prompt injection as the #1 critical vulnerability in AI systems, appearing in over 73% of production AI deployments. Real-world incidents in 2025 demonstrated agents leaking sensitive information and acting outside intended boundaries.

**Why it happens:**
- LLMs process instructions and data as undifferentiated tokens -- they cannot inherently distinguish "system prompt" from "user input."
- Agents with tool access (CRM, email, helpdesk) become powerful attack vectors when compromised. A compromised agent with delegated access to customer resources can query directories and exfiltrate data to external addresses.
- Indirect injection through processed documents, emails, or helpdesk tickets (the agent reads malicious instructions embedded in data it processes).
- In multi-tenant systems, if agents share any runtime context, memory, or vector store, injection in Tenant A can poison Tenant B's responses.

**How to avoid:**
1. Enforce strict tenant isolation at the tool/runtime layer: each tenant's agents must only have database credentials and API keys scoped to their own business_id. Never share a service-role key across tenants.
2. Input sanitization before LLM context: scan for known injection patterns in user inputs and external data before they enter the prompt.
3. Output validation: validate agent tool calls against an allowlist of permitted operations. The agent should never be able to call a tool with a different tenant's business_id.
4. Separate system prompt from user content with clear delimiters and use the model's system message role correctly.
5. Log every tool invocation with full input/output for forensic analysis.
6. Treat the agent's tool permissions as least-privilege: only the specific tools needed for that department role, never wildcard access.

**Warning signs:**
- Agents running with service_role credentials that bypass RLS.
- No input sanitization layer between external data sources and agent context.
- Shared memory/vector stores across tenants.
- Tool invocations not logged or audited.

**Phase to address:**
Phase 2 (Deployment jobs, worker registration, approvals). When OpenClaw workers go live with real tool access, injection defense must be baked in from the start. Do not defer this to "hardening later."

---

### Pitfall 3: Supabase Client-Side Transactions and Partial Provisioning Failures

**What goes wrong:**
The `provisionBusinessTenant()` flow creates 5 dependent records (business, membership, departments, agents, deployment job). If step 3 fails, you have a business with an owner but no departments -- an orphaned, broken tenant that corrupts the UI and requires manual database cleanup. The supabase-js client does NOT support transactions because it is built on PostgREST.

**Why it happens:**
- Developers assume `supabase.from('table').insert()` calls can be wrapped in a transaction. They cannot. Each call is an independent HTTP request.
- Server Actions in Next.js make it easy to write sequential insert calls that look atomic but are not.
- Error handling on partial failure is rarely designed upfront -- the "happy path" works, so the team moves on.

**How to avoid:**
1. Implement the entire provisioning flow as a single PostgreSQL function called via `supabase.rpc('provision_business_tenant', {...})`. Postgres functions called via RPC are automatically wrapped in a transaction. If any step fails, the entire operation rolls back.
2. Alternatively, use a direct database connection from an Edge Function or server-side code (not the supabase-js client) to run a proper `BEGIN/COMMIT/ROLLBACK` block.
3. Design the provisioning function to be idempotent: if called twice with the same input, it should detect the existing tenant and skip rather than create duplicates.
4. Add a `provisioning_status` field to the `businesses` table with states: `pending`, `provisioning`, `active`, `failed`. Only mark `active` when all 5 steps succeed.

**Warning signs:**
- Multiple sequential `.insert()` calls in a Server Action without a wrapping RPC.
- No `provisioning_status` field on the businesses table.
- No cleanup/retry logic for failed provisioning.
- Orphaned records in departments or agents tables (departments without a valid business, agents without departments).

**Phase to address:**
Phase 1 (Business creation, tenant provisioning). This must be a Postgres function from day one. Retrofitting atomicity after launch is painful because you already have orphaned data.

---

### Pitfall 4: Runaway LLM Costs from Unbounded Agent Loops (Denial of Wallet)

**What goes wrong:**
An agent enters a reasoning loop, repeatedly calling tools and consuming tokens until the API bill spikes to thousands of dollars. OWASP identifies this as "Denial of Wallet" (DoW). A single customer support agent handling 10,000 daily conversations can generate over $7,500/month in API costs. Without budget controls, a misconfigured agent or adversarial input can 10x that in hours.

**Why it happens:**
- Agent orchestration loops (think/act/observe) have no hard iteration limit.
- Context windows exceeding 1M tokens mean a single runaway call can be extremely expensive.
- Cost spikes go undetected until monthly invoices arrive because there is no real-time monitoring.
- In multi-tenant systems, one tenant's runaway agent consumes the shared API budget, degrading service for all tenants.

**How to avoid:**
1. Set hard iteration limits on agent loops (e.g., max 10 tool calls per task, max 5 reasoning cycles).
2. Implement per-tenant token budgets tracked in the database. Before every LLM call, check remaining budget. Block requests when budget is exhausted.
3. Use an LLM gateway/proxy (like LiteLLM, Portkey, or a custom middleware) that enforces rate limits and budget caps per virtual key.
4. Set up real-time cost alerting: webhook or email when a tenant exceeds 80% of their daily/weekly budget.
5. Log token usage per agent per task. This is essential for future billing and for detecting anomalies.

**Warning signs:**
- No `max_iterations` parameter on agent execution loops.
- No per-tenant usage tracking table.
- LLM API key shared across all tenants without a proxy layer.
- No cost monitoring dashboard or alerts.

**Phase to address:**
Phase 2 (Worker service, agent execution). Must be implemented before any agent runs in production. Budget controls are not a Phase 3 nice-to-have -- they are a Phase 2 requirement.

---

### Pitfall 5: Noisy Neighbor Degradation on Single VPS

**What goes wrong:**
One tenant's agents monopolize CPU, memory, or I/O on the shared VPS, causing all other tenants' agents to slow down or time out. On a single VPS (the MVP target), there is no cloud auto-scaling to absorb spikes. The system becomes unresponsive for everyone when one tenant runs a heavy workload.

**Why it happens:**
- Docker containers share the host kernel's resources by default. Without cgroup limits, one container can consume 100% of CPU or RAM.
- Agent workloads are inherently bursty and unpredictable -- a sales agent processing a batch import can spike resource usage 50x.
- Task queues without per-tenant concurrency limits let one tenant's 100-task burst starve other tenants.

**How to avoid:**
1. Set Docker resource constraints in docker-compose: `deploy.resources.limits.cpus` and `deploy.resources.limits.memory` on every container.
2. Implement per-tenant concurrency limits in the task queue: max N concurrent tasks per tenant, regardless of queue depth.
3. Use fair-queuing: process tasks round-robin across tenants, not FIFO from a single queue.
4. Monitor per-tenant resource consumption and expose it in the admin dashboard.
5. Design the architecture so the VPS is a deployment target, not an architectural assumption. Use container orchestration patterns that can migrate to multi-node later.

**Warning signs:**
- Docker Compose with no resource limits defined.
- Single shared task queue with FIFO processing.
- No per-tenant concurrency controls.
- Performance complaints from tenants that correlate with other tenants' activity spikes.

**Phase to address:**
Phase 2 (Deployment runner, Docker deployment). Resource limits must be in the generated docker-compose files from the start. Fair queuing must be in the task routing design.

---

### Pitfall 6: Credential and Secret Sprawl Across Tenants

**What goes wrong:**
Integration credentials (CRM API keys, email SMTP passwords, Slack tokens) for different tenants end up stored in plaintext, logged in agent transcripts, shared across environments, or accessible to the wrong tenant's agents. A single leaked credential can compromise an entire client business's systems.

**Why it happens:**
- The `integrations` table stores `credentials_ref` but developers store actual credentials in `config_json` during development "temporarily."
- Agent transcripts and audit logs inadvertently capture API keys passed as tool inputs or returned in tool outputs.
- The `service_role` key in Supabase bypasses all RLS -- if it is used by agents (or leaked to agents via prompt injection), every tenant's credentials are exposed.
- `.env` files with tenant-specific secrets get committed to repos or shared across deployment environments.

**How to avoid:**
1. Never store raw credentials in the database. Use `credentials_ref` as a pointer to an encrypted vault (even a simple encrypted column with a separate encryption key, or a secrets manager like Vault/Doppler).
2. Redact sensitive values from agent transcripts before persisting to the `conversations` table. Implement a scrubbing layer that removes patterns matching API keys, tokens, and passwords.
3. Never give agents the `service_role` key. Agents must authenticate with user-scoped or tenant-scoped credentials that go through RLS.
4. Generate per-tenant `.env.generated` files (already planned) but ensure the deployment runner does not log their contents. Mark secret values in logs with `[REDACTED]`.
5. Rotate integration credentials on a schedule and when team members leave a tenant.

**Warning signs:**
- Raw API keys visible in the `integrations` table without encryption.
- Agent conversation logs containing strings that look like API keys or tokens.
- The same LLM API key used across all tenants without a proxy layer.
- `.env` files in version control (even in `.gitignore`, verify with `git log`).

**Phase to address:**
Phase 1 (Integration table design) and Phase 3 (Integration connectors). The schema must enforce `credentials_ref` as a vault reference from day one. Actual vault integration can be Phase 3 but the pattern must be established in Phase 1.

---

### Pitfall 7: Approval Gates That Become Rubber Stamps

**What goes wrong:**
The human-in-the-loop approval system for risky agent actions becomes ineffective. Approvers get fatigued, rubber-stamp everything, or the approval UI does not provide enough context for informed decisions. The safety net becomes performative rather than functional. Research shows that when humans review hundreds of AI outputs per day, decision fatigue leads to symbolic rather than substantive oversight.

**Why it happens:**
- Treating approval as binary (approve/reject) without context. Approvers see "Agent wants to send email" but not the email content, recipient, or why the agent chose this action.
- Too many actions gated for approval. When everything requires approval, nothing gets meaningful review.
- No urgency or SLA on approvals. Pending approvals pile up, blocking agent work, creating pressure to approve quickly.
- Poor review interface: dense action traces that humans cannot realistically interpret.

**How to avoid:**
1. Risk-based routing: classify agent actions into risk tiers. Low-risk actions (read operations, internal notes) execute automatically. Medium-risk (sending emails) require approval. High-risk (deleting data, financial transactions) require approval with mandatory comment.
2. Rich approval context: show the approver the full action payload (email content, recipient, agent reasoning chain) -- not just the action type.
3. Set SLAs on approvals: auto-escalate to business owner if not reviewed within N hours. Never auto-approve.
4. Track approval metrics: approval rate, average review time, rejection rate. If approval rate is >98%, the gate is likely rubber-stamping.
5. Limit the number of pending approvals per reviewer to prevent fatigue.

**Warning signs:**
- Approval rate consistently above 98% across all tenants.
- Average review time under 5 seconds (indicates not reading context).
- Approval queue depth growing over time (indicates approvals are blocking, not helping).
- All agent actions requiring approval (no risk-tier differentiation).

**Phase to address:**
Phase 2 (Approvals system). The approval UI and risk-tier classification must be designed together. Do not build the UI first and "add context later."

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Using `service_role` key in server actions for convenience | Bypasses RLS, simplifies queries | Any bug exposes all tenant data; prompt injection becomes catastrophic | Never in production. Use user-scoped auth only. |
| Storing credentials in database columns instead of a vault | Faster to implement, no external dependency | Credential leaks from DB backups, logs, or RLS bugs expose all client secrets | MVP only with encrypted columns, migrate to vault in Phase 3 |
| Single shared LLM API key for all tenants | Simpler billing, one config | No per-tenant cost tracking, one runaway tenant burns everyone's budget, no tenant-specific rate limiting | Never. Use per-tenant virtual keys from day one, even if billing is deferred. |
| Sequential `.insert()` calls instead of RPC transaction | Familiar JS/TS patterns, faster to write | Partial provisioning failures, orphaned records, data corruption | Never for multi-step provisioning flows |
| Polling instead of WebSockets for task/approval updates | Simpler implementation (aligned with MVP scope) | Delayed feedback, higher server load at scale | Acceptable for MVP, plan migration path for Phase 3+ |
| Hardcoded 4-department template | Faster provisioning, simpler UI | Cannot serve businesses with different structures | Acceptable for MVP if schema supports N departments |
| `console.log` for agent activity logging | Quick debugging | No structured logs, no audit trail, no tenant scoping in log output | Never for agent operations. Use structured logging from Phase 2 onward. |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase Auth | Using `service_role` key in client-accessible code or agent runtimes | Keep `service_role` server-side only; agents use user-scoped tokens. Treat the anon key as public (it is). |
| LLM APIs (Claude, etc.) | Passing tenant credentials or PII directly in prompts without scrubbing | Sanitize inputs before LLM context; never include raw credentials in prompts; redact PII from logged transcripts. |
| CRM/Email/Slack integrations | Storing OAuth tokens in the main database alongside business data | Store tokens via `credentials_ref` pointing to encrypted storage. Never store tokens where an RLS bug could expose them to other tenants. |
| Docker deployment | Generating docker-compose files with secrets in environment variables visible in `docker inspect` | Use Docker secrets or mount encrypted config files. Never embed secrets in compose file labels or build args. |
| Next.js Middleware | Relying solely on middleware for tenant auth (CVE-2025-29927 bypass) | Use middleware for tenant detection/routing but enforce authorization in Server Actions and database RLS. Defense in depth. |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading all tenant agents/tasks in a single query | Slow dashboard rendering | Paginate all list queries; add database indexes on `business_id` + `status` | 50+ agents or 500+ tasks per tenant |
| Storing full conversation transcripts in a single JSON column | Memory spikes on transcript reads, slow audit log queries | Store messages as individual rows with foreign key to conversation; index by timestamp | Conversations exceeding 100 messages |
| Synchronous agent execution in Server Actions | Request timeouts, blocked UI | Use background job queue for agent execution; return task ID immediately, poll for status | Any agent task taking >10 seconds |
| No database connection pooling | Connection exhaustion under concurrent tenant activity | Use Supabase connection pooler (Supavisor) or PgBouncer; configure pool size per environment | 10+ concurrent users across tenants |
| Unindexed `business_id` foreign keys | Full table scans on every tenant-scoped query | Add composite indexes `(business_id, status)`, `(business_id, created_at)` on all operational tables | 10+ tenants with active data |
| Agent polling for new tasks without backoff | CPU waste, unnecessary database load | Exponential backoff on empty polls; event-driven notification when tasks are queued | 20+ idle agents polling simultaneously |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Agents running with `service_role` database credentials | Complete bypass of tenant isolation; prompt injection becomes a full data breach | Agents authenticate with tenant-scoped credentials; RLS enforced on every query |
| Agent memory/context shared across tenants | Tenant A's conversation history leaks into Tenant B's agent responses | Strict per-tenant memory isolation; separate conversation contexts; never share vector stores |
| Logging full LLM prompts including user data | PII exposure in log files; credential leakage via logged tool calls | Structured logging with automatic PII/credential scrubbing before persistence |
| No rate limiting on agent-facing API endpoints | Denial of service via agent loop exploitation; cost amplification attacks | Per-tenant rate limits at API gateway and within agent orchestration loop |
| Builder service with unrestricted template generation | Malicious prompt injection via template creates compromised agents across tenants | Validate and sandbox all builder-generated configs; human review before deployment to production tenants |
| Deployment runner executing arbitrary generated configs | Injected config could mount host filesystem, access host network, or escalate privileges | Validate generated Docker configs against a strict allowlist of permitted options; never allow `privileged: true` or host volume mounts in generated configs |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Provisioning looks instant but takes 30+ seconds | User sees empty dashboard, thinks it is broken, refreshes repeatedly | Show explicit provisioning progress with step-by-step status; optimistic UI for the business record, loading states for departments/agents |
| Approval notifications buried in a page tab | Risky actions blocked for hours/days because approver did not notice | Email/push notifications for new approvals; badge count on nav; escalation after SLA timeout |
| Agent errors shown as raw technical messages | Business users cannot understand "LLM context window exceeded" or "tool invocation timeout" | Map technical errors to business-friendly messages: "The sales agent could not complete this task because the email was too long. Try shortening it." |
| Audit log as a raw event stream | Users cannot find what they need in thousands of log entries | Filterable, searchable audit log with pre-built views: "my approvals today", "failed tasks this week", "agent config changes" |
| No indication of agent cost/resource usage | Tenant unaware they are consuming resources; surprise when limits hit | Show token usage and task counts on dashboard; proactive warnings when approaching limits |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **RLS policies:** Often missing on newly added tables -- verify every table has RLS enabled with a CI check that queries `pg_class` for `relrowsecurity = true`
- [ ] **Tenant provisioning:** Often missing rollback on partial failure -- verify by killing the process mid-provisioning and checking for orphaned records
- [ ] **Agent execution:** Often missing iteration limits -- verify by sending an agent a task that would naturally loop (e.g., "keep retrying until success") and confirming it stops
- [ ] **Approval gates:** Often missing context in the approval UI -- verify by asking a non-technical user to make an approval decision and observing if they have enough information
- [ ] **Audit logging:** Often missing tenant scoping -- verify audit logs from Tenant A never appear in Tenant B's log viewer
- [ ] **Deployment artifacts:** Often missing secret redaction in generated files -- verify `.env.generated` and `docker-compose.generated.yml` do not appear in any log output
- [ ] **Error handling:** Often missing user-facing error messages for agent failures -- verify every agent error path produces a business-friendly message, not a stack trace
- [ ] **Integration credentials:** Often stored as plaintext "temporarily" -- verify the `integrations` table never contains raw API keys or tokens in `config_json`

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Cross-tenant data leak via RLS | HIGH | Immediately rotate all affected credentials; audit access logs to determine exposure scope; notify affected tenants; add missing RLS policies; run full RLS audit across all tables; consider legal notification obligations |
| Partial provisioning failure | LOW | Query for businesses with `provisioning_status != 'active'`; delete orphaned records in reverse dependency order (agents, departments, membership, business); re-run provisioning |
| Runaway LLM costs | MEDIUM | Kill active agent sessions; audit token usage per tenant; implement budget caps retroactively; negotiate with LLM provider for cost adjustment if caused by bug |
| Credential leak in logs | HIGH | Rotate all credentials that may have been logged; purge affected log entries; audit who had log access; update logging pipeline to scrub credentials |
| Approval rubber-stamping | MEDIUM | Audit approved actions for anomalies; implement mandatory review time (minimum 10 seconds before approve button activates); reduce number of actions requiring approval; improve approval context UI |
| Noisy neighbor on VPS | LOW | Apply Docker resource limits immediately; restart affected containers; implement per-tenant concurrency limits in task queue; consider tenant-specific resource caps |
| Agent prompt injection | HIGH | Revoke agent's tool access immediately; audit all actions taken by compromised agent; reset agent context/memory; patch injection vector; review and tighten tool permissions |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Cross-tenant data leak (RLS) | Phase 1 | CI check verifying all tables have RLS enabled; integration tests querying cross-tenant |
| Partial provisioning failure | Phase 1 | Provisioning implemented as Postgres RPC function; test by simulating mid-flow failures |
| Credential storage insecurity | Phase 1 (schema), Phase 3 (vault) | Verify `integrations` table uses `credentials_ref`, not plaintext; audit for raw secrets in DB |
| Prompt injection / cross-tenant exfiltration | Phase 2 | Input sanitization tests; tool call validation tests; verify agents cannot access other tenant data |
| Runaway LLM costs | Phase 2 | Budget cap enforcement tests; verify agent loops terminate at max iterations |
| Noisy neighbor on VPS | Phase 2 | Docker resource limits in generated compose files; per-tenant concurrency limits in task queue |
| Approval rubber-stamping | Phase 2 | Approval UI includes full action context; metrics tracking approval rate and review time |
| Agent audit logging gaps | Phase 2 | Structured logs with tenant scoping; verify log completeness for every agent action type |
| Builder service generating unsafe configs | Phase 3 | Config validation against allowlist; sandbox testing before deployment; human review gate |
| Next.js middleware bypass (CVE-2025-29927) | Phase 1 | Authorization enforced in Server Actions and RLS, not just middleware; penetration test middleware bypass |

## Sources

- [OWASP AI Agent Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html) -- HIGH confidence
- [AWS Prescriptive Guidance: Enforcing Tenant Isolation in Multi-Tenant AI Agent Systems](https://docs.aws.amazon.com/prescriptive-guidance/latest/agentic-ai-multitenant/enforcing-tenant-isolation.html) -- HIGH confidence
- [Supabase Row Level Security Official Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) -- HIGH confidence
- [CVE-2025-48757: 170+ Lovable apps exposed by missing RLS](https://byteiota.com/supabase-security-flaw-170-apps-exposed-by-missing-rls/) -- HIGH confidence
- [CVE-2025-29927: Next.js Middleware Bypass](https://vercel.com/blog/postmortem-on-next-js-middleware-bypass) -- HIGH confidence
- [Inngest: Fixing Multi-Tenant Queueing Concurrency Problems](https://www.inngest.com/blog/fixing-multi-tenant-queueing-concurrency-problems) -- MEDIUM confidence
- [Composio: Why AI Pilots Fail in Production (2025)](https://composio.dev/blog/why-ai-agent-pilots-fail-2026-integration-roadmap) -- MEDIUM confidence
- [LangChain: State of Agent Engineering](https://www.langchain.com/state-of-agent-engineering) -- MEDIUM confidence
- [Microsoft: Secure Agentic AI End-to-End (March 2026)](https://www.microsoft.com/en-us/security/blog/2026/03/20/secure-agentic-ai-end-to-end/) -- HIGH confidence
- [Supabase Database Transactions Discussion](https://github.com/orgs/supabase/discussions/526) -- HIGH confidence
- [Permit.io: Human-in-the-Loop for AI Agents](https://www.permit.io/blog/human-in-the-loop-for-ai-agents-best-practices-frameworks-use-cases-and-demo) -- MEDIUM confidence
- [Cloud Native Now: Securing AI Agents in Cloud-Native Infrastructure](https://cloudnativenow.com/contributed-content/the-new-multi-tenant-challenge-securing-ai-agents-in-cloud-native-infrastructure/) -- MEDIUM confidence
- [Supabase RLS Guide: Policies That Actually Work](https://designrevision.com/blog/supabase-row-level-security) -- MEDIUM confidence
- [FusionAuth: Multi-Tenant Auth Pitfalls](https://fusionauth.io/blog/multi-tenant-hijack-2) -- MEDIUM confidence

---
*Pitfalls research for: Multi-tenant AI agent deployment platform (Fleet Factory)*
*Researched: 2026-03-25*
