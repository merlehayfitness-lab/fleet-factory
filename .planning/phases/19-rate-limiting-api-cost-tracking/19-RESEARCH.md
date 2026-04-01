# Phase 19: Rate Limiting & API Cost Tracking - Research

**Researched:** 2026-03-31
**Status:** Ready for planning

## 1. Phase Requirements

### Requirement Definitions

| ID | Requirement | Source |
|----|-------------|--------|
| RATE-01 | Rate limiter enforces plan-tier concurrency limits with 2-second stagger | ROADMAP Phase 19 SC#1 + 19-CONTEXT |
| RATE-02 | Overflow requests queued in Supabase-backed `api_call_queue` with priority + FIFO and optimistic locking | ROADMAP Phase 19 SC#2 |
| RATE-03 | Queue self-drains on slot release (no separate worker) | 19-CONTEXT decisions |
| USAGE-01 | All API calls logged in `api_usage` with model, provider, prompt/completion tokens, cost, latency, status, key_source | ROADMAP Phase 19 SC#3 + 19-CONTEXT |
| USAGE-02 | Cost calculation uses per-model pricing from TypeScript constants file | ROADMAP Phase 19 SC#4 + 19-CONTEXT |
| TIER-01 | 4 plan tiers (Trial/Starter/Pro/Enterprise) with concurrency + monthly token limits stored on businesses | 19-CONTEXT decisions |
| BUDGET-01 | Per-agent token_budget column on agents table (COALESCE with template), monthly reset | 19-CONTEXT decisions |
| BUDGET-02 | Soft limit at 80% (dashboard banner + audit log + Slack DM), hard stop at 100% (block agent) | 19-CONTEXT decisions |
| BUDGET-03 | Business-level plan token cap is also a hard stop (block all agents + red banner) | 19-CONTEXT decisions |
| DASH-01 | Command Center shows full cost breakdown: today/week/month, by provider, by model | 19-CONTEXT decisions |
| DASH-02 | New `/businesses/[id]/usage` page with Recharts, time filters (24h/7d/30d/MTD/YTD), under RevOps nav | 19-CONTEXT decisions |
| VPS-01 | VPS proxy returns real usage block (prompt_tokens, completion_tokens) from OpenClaw response | 19-CONTEXT decisions |
| CLEAN-01 | Delete metering.ts, update tool-runner.ts, drop usage_records table | 19-CONTEXT decisions |
| QUEUE-UX-01 | Chat shows inline queue message: "Your message is queued (position #X)" auto-replacing with response | 19-CONTEXT decisions |

## 2. Current State of Implementation

### What Exists (Phase 19 was marked "complete" in ROADMAP)

Phase 19 code was written as standalone modules but **never integrated into any live request path**.

| File | Lines | Status | Gap |
|------|-------|--------|-----|
| `packages/core/rate-limit/rate-limiter.ts` | 463 | Real working code | Zero callers anywhere in codebase |
| `packages/core/rate-limit/index.ts` | 19 | Barrel export | Exports unused functions |
| `packages/db/schema/045_api_usage_and_queue.sql` | 81 | Real migration | Schema exists but tables empty |
| `packages/core/server.ts` (lines 269-287) | — | Barrel re-export | Exported but unused |
| `packages/core/dashboard/dashboard-service.ts` | 348 | Real code | `totalCostToday: 0` hardcoded (line ~207), `tokenBudget = 100000` hardcoded (line ~282) |
| `apps/web/_components/usage-summary.tsx` | 116 | Real component | Uses old UsageSummaryData type |
| `apps/web/app/(dashboard)/command-center/page.tsx` | ~170 | Real page | Shows token count but not cost |
| `apps/web/app/(dashboard)/businesses/[id]/revops/page.tsx` | 171 | Real page | Hardcoded budgets, no real cost data |

### Code Analysis: Key Integration Points

#### 1. Chat Flow (Primary Integration Point)

The chat flow is the main path where Claude API calls happen:

```
sendMessageAction (chat-actions.ts:30)
  → routeAndRespond (chat-service.ts:565)
    → sendChatToVps (vps-chat.ts:90)
      → vpsPost (vps-client.ts) → VPS proxy → OpenClaw → Claude
```

**`routeAndRespond()` (chat-service.ts:650-718)** is where the VPS call happens:
- Line 660: `sendChatToVps(businessId, agent.id, vpsAgentId, conversationId, userMessage, knowledgeContext, agentModel)`
- Returns `VpsChatResponse` with `content`, `agentId`, `toolCalls`
- **Missing:** No token usage in response, no rate limiting, no cost logging

**`sendChatToVps()` (vps-chat.ts:90-215)** uses async submit + poll:
- POST to `/api/agents/{vpsAgentId}/chat` → gets `requestId`
- Poll GET `/api/chat-results/{requestId}` every 3s (max 5 min)
- Returns `VpsChatResponse` — currently no token usage fields

#### 2. VPS Proxy (Token Source)

**`openclaw-client.ts`** on VPS already parses `usage` from OpenClaw:
- `sendMessageToAgent()` (line 20): Returns `{ response, model, tokens }` — has `data.usage?.total_tokens` but NOT split prompt/completion
- `submitTaskToAgent()` (line 73): Returns `tokenUsage: { prompt_tokens, completion_tokens }` — already split!
- **Gap:** `sendMessageToAgent` only returns `total_tokens`, needs `prompt_tokens`/`completion_tokens` split

**`api-routes.ts`** (VPS proxy route handlers, 690 lines):
- POST `/api/agents/:vpsAgentId/chat` handler calls `sendMessageToAgent()` and stores result
- GET `/api/chat-results/:requestId` returns stored result
- **Gap:** Result doesn't include token usage in the response payload sent back to Next.js

#### 3. Slack Integration (Budget DM)

**`slack-messages.ts`** has `postAgentResponseToSlack()` which posts formatted messages.
- Uses `getSlackClient(supabase, businessId)` to get a `WebClient`
- Sends via `client.chat.postMessage({ channel, text, blocks, ... })`
- **For budget DM:** Need to find the department lead's Slack DM channel and send a budget warning message
- Can use `client.conversations.open({ users: leadSlackUserId })` to open a DM, then `chat.postMessage` to it
- **Prerequisite:** Need to map department lead agent → Slack user (may need to be the business owner's Slack user for now)

#### 4. Rate Limiter Analysis

**Current rate-limiter.ts structure:**

| Function | Lines | Purpose | Change Needed |
|----------|-------|---------|---------------|
| `acquireSlot()` | 70-88 | In-memory slot check + stagger | Replace with DB-backed slot count |
| `releaseSlot()` | 93-95 | Decrement in-memory counter | Add queue drain logic |
| `enqueueCall()` | 105-131 | Insert to api_call_queue | Needs payload to include enough info to replay |
| `dequeueCall()` | 136-180 | Fetch next pending with optimistic lock | Good as-is |
| `logApiUsage()` | 251-289 | Insert to api_usage | Add key_source field |
| `getApiUsageSummary()` | 294-338 | Aggregate usage by business + period | Expand for by-model, by-provider breakdowns |
| `executeWithRateLimit()` | 352-433 | High-level wrapper | Add budget check, tier-based config, queue drain |
| `calculateCostFromUsage()` | 457-462 | Per-model pricing | Extract to model-pricing.ts constants file |
| `MODEL_PRICING` | 444-455 | Hardcoded pricing map | Move to constants file, add Mistral/DeepSeek |

**Key Issue — In-Memory Slots:**
Lines 52-53: `let activeSlots = 0; let lastCallTimestamp = 0;`
These are module-level variables that reset on process restart and aren't shared across Vercel serverless instances.

**Decision (from 19-CONTEXT):** Replace with `COUNT(*) FROM api_call_queue WHERE status = 'processing'` — the table already has a helper function `get_active_api_calls()` (in migration 045).

#### 5. Dashboard Service TODOs

**`dashboard-service.ts` line ~207:**
```typescript
totalCostToday: 0, // TODO: calculate from api_usage.cost_cents
```

**`dashboard-service.ts` line ~282:**
```typescript
const tokenBudget = 100000; // TODO: pull from template
```

Both need real data from `api_usage` and `agent_templates.token_budget` / `agents.token_budget`.

#### 6. Old Metering System (To Delete)

**`packages/core/worker/metering.ts` (224 lines):**
- `estimateTokens()` — heuristic, not real counts
- `calculateCost()` — simpler pricing model
- `recordUsage()` — inserts to `usage_records` table
- `getUsageSummary()` — aggregates from `usage_records`

**`packages/core/worker/tool-runner.ts` (322 lines):**
- Calls `estimateTokens()`, `calculateCost()`, `recordUsage()` after task execution
- Needs to switch to `logApiUsage()` from rate-limiter

**`packages/db/schema/019_usage_records.sql`:**
- `usage_records` table: id, business_id, task_id, agent_id, model, prompt_tokens, completion_tokens, cost_cents, created_at
- Will be replaced by `api_usage` (Phase 19 schema) — need DROP TABLE migration

#### 7. Sidebar Nav (Usage Page Link)

**`sidebar-nav.tsx`** (277 lines) has `getBusinessSubNav()` (line 65) returning nav items.
Currently has: Overview, Departments, Agents, Templates, Skills, Deployments, Integrations, Approvals, Tasks, Chat, Knowledge Base, Settings, Logs.
**No RevOps link currently.** Need to add RevOps section with Usage sub-link, or add both RevOps and Usage as siblings.

#### 8. Businesses & Agents Table Schema

**`businesses` table (migration 001):**
- id, name, slug, industry, status, created_at, updated_at
- Added later: `subdomain` (migration 043)
- **Missing:** `plan_tier`, `monthly_token_limit`

**`agents` table (migration 004):**
- id, business_id, department_id, template_id, name, system_prompt, tool_profile, model_profile, status, created_at, updated_at
- Added later: `parent_agent_id`, `role`, `vps_agent_id` (various migrations)
- **Missing:** `token_budget`

**`agent_templates` table** already has `token_budget integer DEFAULT 100000` (migration 042)

## 3. Dependencies and Infrastructure

### Required Migrations

| Migration | Purpose |
|-----------|---------|
| 051_plan_tier_and_agent_budget.sql | Add `plan_tier` to businesses, `token_budget` to agents, DROP `usage_records` |

### VPS Proxy Changes

The VPS proxy at `infra/vps/` runs on the VPS itself (23.166.40.44:3100). Changes to these files need to be deployed to the VPS:
- `openclaw-client.ts` → return split tokens
- `api-routes.ts` → include usage in chat result response
- `api-types.ts` → add TokenUsage type

### Package Dependencies

- **recharts** — new dependency for usage analytics page charts
- No other new deps needed

## 4. Technical Considerations

### Rate Limiter Integration Architecture

The cleanest integration point is `routeAndRespond()` in `chat-service.ts` (line 650-718). This is where the VPS call happens and where we have access to `supabase`, `businessId`, `agent.id`, and the response.

**Option A: Wrap at chat-service level**
- Pro: Single integration point, has all context
- Con: Tighter coupling between chat and rate limiting

**Option B: Wrap at vps-chat level**
- Pro: Catches ALL VPS chat calls regardless of caller
- Con: `sendChatToVps` doesn't have supabase client for logging

**Recommendation: Option A** — wrap in `routeAndRespond()`, which already has supabase client and business/agent context.

### Budget Check Before Call

Before acquiring a slot, check:
1. Agent's monthly token usage vs `agents.token_budget` (COALESCE with template)
2. Business's monthly token usage vs plan tier limit
3. If either exceeds 100%, reject immediately (don't even try to acquire slot)
4. If agent at 80%, fire Slack DM + audit log (once per day, not every call)

### VPS Response Enhancement

Current `AsyncChatPollResponse` from VPS proxy:
```typescript
{ status: "complete", result: { content, agentId, toolCalls } }
```

Enhanced:
```typescript
{ status: "complete", result: { content, agentId, toolCalls, tokenUsage: { prompt_tokens, completion_tokens, model } } }
```

The OpenClaw gateway already returns `usage` in the chat completions response — `openclaw-client.ts` just needs to capture and pass it through.

### Queue Drain on Slot Release

When `releaseSlot()` fires:
1. Check queue depth via `dequeueCall()`
2. If a pending call exists, execute it immediately
3. Problem: `releaseSlot()` needs supabase client + the ability to re-execute the queued call
4. Solution: Store enough payload in the queue to reconstruct the call, or store a callback reference

**Simpler approach:** Don't auto-drain in `releaseSlot()`. Instead, at the start of `executeWithRateLimit()`, check if there are stale `processing` entries older than 5 minutes and reset them to `pending`. The next call attempt will naturally pick up queued work if slots are available.

**Even simpler (recommended):** When a call is queued, return the queue ID to the chat UI. The chat UI polls for the result. On the server side, a lightweight interval (or the next incoming request) checks the queue and processes pending items when slots are free.

### Model Pricing Constants

Extract from rate-limiter.ts to `packages/core/rate-limit/model-pricing.ts`:
```typescript
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-6": { input: 5, output: 25 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
  "mistral-large": { input: 2, output: 6 },
  "deepseek-chat": { input: 0.14, output: 0.28 },
  default: { input: 3, output: 15 },
};
```

## 5. Key Files to Touch

### Must Modify

| File | Changes |
|------|---------|
| `packages/core/rate-limit/rate-limiter.ts` | DB-backed slots, tier config, budget check, queue drain, key_source tracking |
| `packages/core/chat/chat-service.ts` | Wrap `sendChatToVps` in `executeWithRateLimit()` in `routeAndRespond()` |
| `packages/core/vps/vps-chat.ts` | Parse tokenUsage from VPS response, return in VpsChatResponse |
| `packages/core/vps/vps-types.ts` | Add `tokenUsage` to VpsChatResponse, AsyncChatPollResponse |
| `packages/core/dashboard/dashboard-service.ts` | Real cost queries, real token budgets, by-model/provider breakdowns |
| `packages/core/worker/tool-runner.ts` | Switch from metering.ts to logApiUsage() |
| `packages/core/server.ts` | Export new functions (budget check, tier config) |
| `apps/web/_components/sidebar-nav.tsx` | Add RevOps + Usage nav links |
| `apps/web/_components/chat-layout.tsx` | Show queue status message |
| `apps/web/app/(dashboard)/command-center/page.tsx` | Cost breakdown section |
| `apps/web/app/(dashboard)/businesses/[id]/revops/page.tsx` | Real cost data, real budgets |
| `infra/vps/openclaw-client.ts` | Return prompt_tokens/completion_tokens split |
| `infra/vps/api-routes.ts` | Include tokenUsage in chat result response |
| `infra/vps/api-types.ts` | Add TokenUsage type |

### Must Create

| File | Purpose |
|------|---------|
| `packages/core/rate-limit/model-pricing.ts` | Extracted pricing constants |
| `packages/core/rate-limit/budget-service.ts` | Budget check, 80% warning, hard stop logic |
| `packages/db/schema/051_plan_tier_and_agent_budget.sql` | plan_tier on businesses, token_budget on agents, DROP usage_records |
| `apps/web/app/(dashboard)/businesses/[id]/usage/page.tsx` | Usage analytics page with Recharts |

### Must Delete

| File | Reason |
|------|--------|
| `packages/core/worker/metering.ts` | Replaced by api_usage + logApiUsage() |

## 6. Gaps Between Implementation and User Decisions

| Gap | Decision | Current State | Effort |
|-----|----------|---------------|--------|
| Rate limiter has no callers | Wrap all Claude calls | Standalone module, zero integration | Large — primary work |
| In-memory slot tracking | DB-backed via api_call_queue | Module-level `let activeSlots = 0` | Medium — replace acquireSlot/releaseSlot |
| No plan tiers | 4 tiers on businesses.plan_tier | No column exists | Small — migration + enum |
| No per-agent token_budget | Column on agents table | Only on agent_templates | Small — migration |
| Dashboard cost hardcoded | Real aggregation from api_usage | `totalCostToday: 0` | Medium — add queries |
| Dashboard budgets hardcoded | COALESCE agent.token_budget / template | `const tokenBudget = 100000` | Small — join query |
| VPS proxy no usage | Pass through OpenClaw usage block | Proxy drops token counts | Small — proxy code change |
| No usage analytics page | New /businesses/[id]/usage with Recharts | Page doesn't exist | Large — new page |
| No budget enforcement | Soft at 80%, hard at 100% | No budget checking anywhere | Medium — budget service |
| No queue UX in chat | Inline queue message | Chat has no queue awareness | Medium — chat component change |
| No Slack budget DM | DM department lead at 80% | No budget notification | Medium — new message type |
| Sidebar missing RevOps/Usage | Add under business sub-nav | No RevOps or Usage links | Small — add nav items |
| Old metering.ts | Delete, switch to logApiUsage | Still used by tool-runner.ts | Small — refactor |
| No key_source tracking | Show platform vs business key | api_usage has no key_source column | Small — add column |

## 7. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| OpenClaw not returning token split | Cost calculation inaccurate | Proxy already has usage.total_tokens; can derive split or estimate |
| DB slot tracking adds latency | Slower chat responses (extra query per message) | Single COUNT query is fast with existing index |
| Queue drain complexity | Queued messages never processed | Use polling from chat UI + periodic check, not event-driven |
| Recharts bundle size | Increased web app size | Tree-shake, only import needed chart types |
| VPS proxy deploy required | Can't test usage passthrough locally | Deploy proxy changes first, verify with curl |
| Slack DM rate limiting | Spam department lead with budget warnings | Throttle to max 1 DM per agent per day |
| Budget check race condition | Agent slightly exceeds budget | Acceptable — budget is advisory, DB enforces via post-check |

## 8. Suggested Plan Structure

### Plan 1: Schema, Pricing Constants, Rate Limiter Refactor
- Migration: plan_tier, token_budget on agents, key_source on api_usage, DROP usage_records
- Extract model-pricing.ts constants
- Refactor rate-limiter.ts: DB-backed slots, tier-aware config, budget check before call
- Budget service: check agent + business limits, 80% warning, 100% hard stop
- Delete metering.ts, update tool-runner.ts

### Plan 2: VPS Proxy Enhancement + Chat Integration
- VPS proxy: openclaw-client.ts returns split tokens, api-routes.ts includes usage in response, api-types.ts updated
- vps-types.ts: add tokenUsage to response types
- vps-chat.ts: parse tokenUsage from poll response
- chat-service.ts: wrap sendChatToVps in executeWithRateLimit(), pass usage data
- Queue UX: chat-layout shows inline queue message when rate-limited

### Plan 3: Dashboard Wiring + Usage Analytics Page
- dashboard-service.ts: real cost queries, real budgets, by-model/provider breakdowns
- command-center/page.tsx: cost breakdown section (today/week/month, by provider, by model)
- revops/page.tsx: real cost data, real agent budgets
- New: /businesses/[id]/usage page with Recharts (time series, model breakdown, agent breakdown)
- sidebar-nav.tsx: add RevOps + Usage links
- Install recharts dependency

### Plan 4: Budget Enforcement UX + Slack Notifications
- Agent detail page: budget warning banner (amber at 80%, red at 100%)
- RevOps page: budget utilization bars with real data
- Business dashboard: red banner when plan limit hit
- Slack DM: send budget warning to department lead at 80%
- Audit log: budget_warning event
- Chat: block message sending when budget exceeded (friendly error)

## 9. Patterns to Follow

- **Server Actions pattern:** Thin actions, delegate to core services
- **Supabase pattern:** Authenticated client from `createServerClient()`, check user before operations
- **redirect() safety:** Never inside try/catch (NEXT_REDIRECT throws internally)
- **Best-effort pattern:** Non-critical operations (audit logs, Slack DMs, usage logging) wrapped in try/catch with fallback
- **Import pattern:** Dynamic import for heavy modules (`await import(...)`) to avoid webpack bundling
- **Slack pattern:** Use `getSlackClient(supabase, businessId)` for authenticated WebClient
- **Dashboard pattern:** Server Components with data fetching in page.tsx, client components for interactive parts

---

*Phase: 19-rate-limiting-api-cost-tracking*
*Research completed: 2026-03-31*
