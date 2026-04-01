# Phase 19: Rate Limiting & API Cost Tracking - Context

**Gathered:** 2026-03-31
**Status:** Ready for research and planning

<domain>
## Phase Boundary

Rate limiting for all outbound Claude/Anthropic API calls to prevent bans, with concurrency control, priority queue, per-model cost calculation, and usage analytics. Covers the rate limiter integration into live request paths, plan-tier-based limits, token budget enforcement at agent and business level, usage tracking with real token counts from VPS proxy, and a dedicated usage analytics page. Does NOT cover spend alerts (deferred), billing/Stripe (Phase 28), or client portal usage view (deferred).

</domain>

<decisions>
## Implementation Decisions

### Rate Limiting Core
- **Purpose:** Prevent Anthropic API bans by throttling outbound Claude calls
- **Scope:** All Claude API calls (VPS chat via OpenClaw, prompt generation, R&D council, any direct Anthropic SDK calls)
- **Enforcement point:** Next.js server (before calls reach VPS) -- all logic in packages/core/rate-limit/
- **Slot storage:** Database-backed via api_call_queue table (works across multiple Next.js instances on Vercel)
- **Queue processing:** Self-draining on releaseSlot() -- when a slot frees up, immediately dequeue and process next item
- **Own API key vs platform key:** Same rate limits apply regardless of which key is used (limits are about platform stability)

### Plan Tiers & Concurrency
- **4 tiers:** Trial / Starter / Pro / Enterprise
- **Limits:**
  - Trial: 1 concurrent, 100k tokens/month
  - Starter: 3 concurrent, 1M tokens/month
  - Pro: 5 concurrent, 3M tokens/month
  - Enterprise: 10 concurrent, unlimited tokens/month
- **Storage:** `plan_tier` enum column on `businesses` table, default all existing businesses to 'pro'
- **Billing integration:** Tiers are placeholder; real billing comes in Phase 28 (Stripe)

### Token Budgets
- **Per-agent override:** Add `token_budget` column to `agents` table (nullable, COALESCE with template's token_budget)
- **Reset cycle:** Monthly (1st of month)
- **Soft limit at 80%:** Dashboard amber banner on agent detail + RevOps page, audit_log event (budget_warning), Slack DM to department lead
- **Hard stop at 100%:** Agent blocked from making API calls, agent detail shows red banner
- **Business-level enforcement:** Plan tier monthly token cap is also a hard stop -- block ALL agents + red dashboard banner: "Monthly token limit reached. Upgrade plan or add credits via Anthropic console."
- **Future vision:** Agents redistribute unused token budgets within department, decided by department lead

### Usage Tracking
- **Single table:** `api_usage` replaces old `usage_records` -- delete `metering.ts` and drop `usage_records` table
- **Token source:** VPS proxy enhanced to return real usage block (prompt_tokens, completion_tokens) from OpenClaw/Claude response
- **Key attribution:** Track which API key was used -- show "Platform Key" vs "Business Key (****abc)" in usage page
- **Latency:** Round-trip measured in Next.js (wall-clock from sendChatToVps call to response)
- **System calls:** Attributed to the business (prompt generation, SKILL.md generation, R&D council all count against business budget)
- **Pricing config:** TypeScript constants file (model-pricing.ts), not database table

### Queued Request UX
- **Chat UI:** Inline queue message bubble: "Your message is queued (position #X). It will be processed shortly." Auto-replaces with real response when it arrives
- **No spend alerts yet** -- dashboard shows usage but no proactive notifications (defer to later phase)

### Dashboard & Usage Analytics
- **Command Center:** Full cost breakdown -- today/week/month, by provider, by model (replaces hardcoded totalCostToday: 0)
- **New usage page:** `/businesses/[id]/usage` under RevOps nav section
- **Chart library:** Recharts
- **Time filters:** Rolling 24h / 7d / 30d / MTD / YTD
- **No export yet** -- just the UI for now
- **Admin-only** -- client portal gets usage view later

### VPS Proxy Changes (In Scope)
- Modify VPS proxy to pass through the `usage` block from OpenClaw/Claude response
- Small change to proxy response handling; essential for real token tracking

### Cleanup
- Delete `packages/core/worker/metering.ts`
- Update `packages/core/worker/tool-runner.ts` to use `logApiUsage()` instead of `recordUsage()`
- Migration to DROP `usage_records` table

### Claude's Discretion
- Exact Recharts chart types and layout for usage analytics page
- Usage page card/table layout
- Queue position message wording and animation
- Budget warning banner exact styling
- Cost breakdown section layout on Command Center

</decisions>

<specifics>
## Specific Ideas

- Rate limiter wraps sendChatToVps() as the primary integration point (single chokepoint for all Claude calls today)
- VPS proxy at 23.166.40.44:3100 is the only path to Claude -- wrapping this covers the majority of API spend
- Database-backed slot tracking via api_call_queue COUNT WHERE status='processing' ensures consistency across serverless instances
- 80% Slack notification uses existing Phase 14 Slack infrastructure (already has business-to-Slack channel mapping)
- Token budget on agents table enables the future "agents trading tokens" feature without schema changes

</specifics>

<deferred>
## Deferred Ideas

- Spend alerts / proactive notifications -- later phase
- CSV/JSON export from usage page -- later phase
- Client portal usage view -- after billing (Phase 28)
- Agent token reallocation UI (department lead redistributing budgets) -- future phase
- Redis-based rate limiting -- only if scaling requires it (Phase 31)
- Per-provider rate limits (different limits for OpenAI vs Anthropic) -- not needed yet

</deferred>

---

*Phase: 19-rate-limiting-api-cost-tracking*
*Context gathered: 2026-03-31*
