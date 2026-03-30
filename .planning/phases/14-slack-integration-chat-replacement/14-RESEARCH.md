# Phase 14: Slack Integration & Chat Replacement - Research

**Researched:** 2026-03-29
**Domain:** Slack API integration, message routing, multi-tenant Slack app architecture
**Confidence:** HIGH

## Summary

This phase replaces the existing custom chat infrastructure (built in Phases 5-6) with a Slack-powered messaging system. The core pattern is: one Slack app installed to multiple customer workspaces (one per business tenant), with department-mapped channels, and a bidirectional message sync between Slack and the admin panel's Supabase database.

The existing codebase already has significant infrastructure to build on: the `conversations` and `messages` tables in Supabase, the `routeAndRespond` function in `chat-service.ts` that routes to VPS agents, the integration catalog with Slack listed as a provider, and Phase 13's secrets infrastructure with `bot_token` and `signing_secret` credential fields already seeded for Slack. The architecture should layer Slack on top of the existing message routing pipeline rather than replacing the VPS agent routing -- Slack becomes the transport layer while VPS agents still process and respond.

The recommended approach uses `@slack/web-api` (v7.15.0) directly with Next.js App Router API route handlers rather than the Bolt framework. Bolt has known compatibility issues with Next.js App Router (it expects Node.js `req`/`res` objects) and adds unnecessary framework overhead for this use case. The Events API via HTTP Request URLs is the correct choice over Socket Mode for production reliability. The admin panel displays Slack messages by reading from the local Supabase `messages` table (synced from Slack events) rather than embedding Slack widgets or making live API calls to Slack.

**Primary recommendation:** Use `@slack/web-api` directly with Next.js API route handlers for Slack communication, Events API via HTTP for receiving messages, and Supabase as the message store that the admin panel reads from.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SLACK-01 | Slack API integration routes messages to/from department agents | Slack Events API receives messages via webhook, `@slack/web-api` WebClient posts agent responses back. Existing `routeAndRespond` pipeline extended with Slack transport. |
| SLACK-02 | Embedded Slack feed view in admin panel per department/agent | Admin panel reads from Supabase `messages` table (already synced from Slack events). Custom UI mirrors Slack data -- no Slack embed widget needed. |
| SLACK-03 | Messages viewable both in admin panel and directly in Slack | Bidirectional sync: Slack events write to Supabase (admin panel reads), agent responses written to Supabase AND posted to Slack via `chat.postMessage`. |
| SLACK-04 | Custom chat page replaced with Slack-powered interface | Existing `ChatLayout` component refactored to show Slack-synced messages. Channel sidebar maps to Slack channels per department. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@slack/web-api` | 7.15.0 | Slack API client (WebClient) for posting messages, creating channels, fetching history | Official Slack SDK, full TypeScript types, handles pagination and rate limits |
| `@slack/oauth` | 3.0.5 | OAuth2 installation flow for multi-workspace app | Official Slack SDK for token exchange and installation management |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `crypto` (Node.js built-in) | N/A | HMAC-SHA256 signing secret verification | Verifying Slack webhook requests in API route handlers |

### Why NOT Bolt

| Instead of | Reason to Avoid |
|------------|----------------|
| `@slack/bolt` (v4.6.0) | Requires Node.js `req`/`res` objects incompatible with Next.js App Router's `Request`/`Response`. Serverless not officially supported. Adds framework overhead we don't need since we only need WebClient + event handling. |
| `@vercel/slack-bolt` | Vercel-specific adapter; this project deploys to VPS with Docker, not Vercel. |
| Socket Mode | Requires persistent WebSocket connection, incompatible with serverless/request-based Next.js. Slack recommends HTTP for production. |

**Installation:**
```bash
pnpm add @slack/web-api @slack/oauth
```

## Architecture Patterns

### Recommended Project Structure
```
packages/core/
  slack/
    slack-client.ts          # WebClient factory (token from secrets)
    slack-events.ts          # Event payload parsing + verification
    slack-channels.ts        # Channel creation/mapping service
    slack-messages.ts        # Message sync (Slack <-> Supabase)
    slack-oauth.ts           # OAuth installation flow helpers
    slack-types.ts           # TypeScript types for Slack payloads
apps/web/
  app/api/slack/
    events/route.ts          # POST handler for Slack Events API webhooks
    oauth/callback/route.ts  # GET handler for OAuth redirect
    oauth/install/route.ts   # GET handler to initiate OAuth flow
```

### Pattern 1: Direct WebClient with Next.js API Routes
**What:** Use `@slack/web-api` WebClient directly in Next.js App Router route handlers instead of Bolt framework.
**When to use:** Always -- this is the primary pattern for all Slack API calls.
**Example:**
```typescript
// packages/core/slack/slack-client.ts
import { WebClient } from "@slack/web-api";

export function createSlackClient(botToken: string): WebClient {
  return new WebClient(botToken);
}

// Usage in service layer:
const client = createSlackClient(decryptedBotToken);
await client.chat.postMessage({
  channel: slackChannelId,
  text: agentResponse,
});
```

### Pattern 2: Slack Events API Webhook Handler
**What:** Next.js API route that receives Slack event callbacks, verifies the signing secret, and processes message events.
**When to use:** For all inbound Slack events (messages, app mentions, etc.).
**Example:**
```typescript
// apps/web/app/api/slack/events/route.ts
import { createHmac, timingSafeEqual } from "crypto";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const timestamp = request.headers.get("x-slack-request-timestamp") ?? "";
  const slackSignature = request.headers.get("x-slack-signature") ?? "";

  // Verify signing secret
  const sigBaseString = `v0:${timestamp}:${rawBody}`;
  const hmac = createHmac("sha256", SIGNING_SECRET);
  hmac.update(sigBaseString);
  const computedSignature = `v0=${hmac.digest("hex")}`;

  if (!timingSafeEqual(
    Buffer.from(computedSignature),
    Buffer.from(slackSignature)
  )) {
    return new Response("Invalid signature", { status: 401 });
  }

  const payload = JSON.parse(rawBody);

  // Handle url_verification challenge
  if (payload.type === "url_verification") {
    return Response.json({ challenge: payload.challenge });
  }

  // Handle event_callback
  if (payload.type === "event_callback") {
    // Process asynchronously, respond immediately
    // (must respond within 3 seconds)
    void processSlackEvent(payload);
    return new Response("ok", { status: 200 });
  }

  return new Response("ok", { status: 200 });
}
```

### Pattern 3: Bidirectional Message Sync
**What:** Messages from Slack are stored in Supabase `messages` table. Agent responses are stored in Supabase AND posted to Slack.
**When to use:** For all message routing between Slack and agents.
**Flow:**
```
Slack user sends message in #sales channel
  -> Slack Events API POST to /api/slack/events
  -> Verify signing secret
  -> Map channel ID to department
  -> Store message in Supabase messages table
  -> Route to VPS agent via existing routeAndRespond pipeline
  -> Agent responds
  -> Store response in Supabase messages table
  -> Post response to Slack channel via chat.postMessage
  -> Admin panel sees both messages via Supabase polling
```

### Pattern 4: Multi-Tenant Slack Installation
**What:** Each business tenant installs the Slack app to their own workspace. Bot tokens stored encrypted per-business in secrets table.
**When to use:** During initial Slack setup per business.
**Flow:**
```
Admin clicks "Connect Slack" on business settings
  -> Redirect to Slack OAuth authorize URL with state=businessId
  -> User authorizes in their Slack workspace
  -> Slack redirects to /api/slack/oauth/callback?code=xxx&state=businessId
  -> Exchange code for bot token via oauth.v2.access
  -> Store bot_token + team_id in secrets (encrypted, per-business)
  -> Auto-create department channels in workspace
  -> Mark Slack integration as "active" in integrations table
```

### Pattern 5: Channel-Department Mapping
**What:** Store the mapping between Slack channel IDs and department IDs in a new `slack_channel_mappings` table.
**When to use:** During Slack setup and message routing.
**Schema:**
```sql
CREATE TABLE IF NOT EXISTS public.slack_channel_mappings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments ON DELETE CASCADE,
  slack_channel_id text NOT NULL,
  slack_channel_name text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
```

### Anti-Patterns to Avoid
- **Embedding Slack widgets in the admin panel:** Slack does not provide embeddable message widgets for external apps. Build a custom UI that reads from Supabase.
- **Polling Slack API for messages:** Use Events API webhooks to receive messages in real-time, not conversations.history polling. The rate limits (especially post-May 2025 for non-Marketplace apps) make polling impractical.
- **Using Bolt framework with App Router:** Known incompatibility with Next.js 13+ App Router request/response objects. Closed as unresolved on GitHub.
- **Using Socket Mode:** Requires persistent WebSocket connection, incompatible with serverless/stateless Next.js. Slack recommends HTTP for production.
- **Storing Slack tokens in environment variables:** Multi-tenant requires per-business tokens. Use the existing encrypted secrets infrastructure.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slack API client | Custom HTTP wrapper | `@slack/web-api` WebClient | Handles pagination, rate limiting, retries, full TypeScript types for all 200+ methods |
| OAuth2 token exchange | Manual HTTP calls to oauth.v2.access | `@slack/oauth` or direct `oauth.v2.access` call via WebClient | Token storage patterns, scope management, enterprise grid support |
| Signing secret verification | Custom HMAC implementation | Extract into reusable utility based on Slack's documented algorithm | Must use raw body text, timing-safe comparison, timestamp replay protection |
| Channel naming | Custom slug generation | Slack's naming rules: lowercase, numbers, hyphens, underscores, max 80 chars | `name_taken` error handling with suffix retry |
| Rate limit handling | Custom retry logic | WebClient's built-in `rejectRateLimitedCalls: false` option + `Retry-After` header | WebClient handles 429 responses automatically when configured |

**Key insight:** The `@slack/web-api` WebClient handles the complexity of pagination (cursor-based), rate limiting (429 + Retry-After), and TypeScript types for all API methods. Rolling a custom HTTP client would miss edge cases around these.

## Common Pitfalls

### Pitfall 1: Bot Message Echo Loop
**What goes wrong:** Bot posts a message to Slack, Slack sends that message back as an event, bot processes it as a new user message and responds again, creating an infinite loop.
**Why it happens:** The Events API sends ALL messages in subscribed channels, including bot messages.
**How to avoid:** Filter events where `event.bot_id` is present OR where `event.user` matches the bot's own user ID. Check `event.subtype === "bot_message"` to skip.
**Warning signs:** Rapidly accumulating messages in a channel, exponential message growth.

### Pitfall 2: 3-Second Event Response Timeout
**What goes wrong:** Slack expects HTTP 200 within 3 seconds of sending an event. If the handler takes longer (e.g., waiting for VPS agent response), Slack retries the event up to 3 times with exponential backoff.
**Why it happens:** Event processing (DB writes, agent routing) takes longer than 3 seconds.
**How to avoid:** Respond with 200 immediately, then process the event asynchronously. Use `void processSlackEvent(payload)` pattern. Deduplicate retries using `event_id`.
**Warning signs:** Duplicate messages appearing in the admin panel, Slack showing retry warnings.

### Pitfall 3: Raw Body Required for Signature Verification
**What goes wrong:** Signature verification fails because the request body was parsed (JSON.parse) before computing the HMAC.
**Why it happens:** The HMAC must be computed on the exact raw body string Slack sent, byte-for-byte.
**How to avoid:** Use `await request.text()` first, compute HMAC, THEN parse as JSON. Never use `await request.json()` before verification.
**Warning signs:** All webhook requests failing with 401, signature mismatch errors in logs.

### Pitfall 4: Slack Rate Limits for Non-Marketplace Apps (2025 Changes)
**What goes wrong:** `conversations.history` and `conversations.replies` limited to 1 request per minute with max 15 results for non-Marketplace apps created after May 29, 2025.
**Why it happens:** Slack tightened rate limits for commercially distributed apps not in the Marketplace.
**How to avoid:** Do NOT rely on conversations.history for message display. Use Events API to capture messages as they arrive and store in Supabase. Only use conversations.history for initial backfill during setup.
**Warning signs:** 429 errors when fetching message history, missing messages in admin panel.

### Pitfall 5: Multi-Tenant Token Confusion
**What goes wrong:** Using the wrong workspace's bot token to post a message, causing a `channel_not_found` error.
**Why it happens:** Token lookup must be scoped to the specific business/workspace, not a global singleton.
**How to avoid:** Always look up the bot token from secrets using the `business_id` from the event context. The `team_id` in event payloads maps to a business via the `slack_installations` table.
**Warning signs:** `channel_not_found` errors, messages appearing in wrong workspaces.

### Pitfall 6: Slack OAuth State Parameter Validation
**What goes wrong:** CSRF attacks on the OAuth callback, or inability to map the installation back to the correct business.
**Why it happens:** Missing or unvalidated state parameter in the OAuth flow.
**How to avoid:** Generate a random state token, store it in a short-lived session/cookie with the business_id, validate it in the callback before exchanging the code.
**Warning signs:** Installation succeeding but tokens saved to wrong business, or security audit failures.

## Code Examples

### Creating a Slack WebClient from Encrypted Secrets
```typescript
// packages/core/slack/slack-client.ts
import { WebClient } from "@slack/web-api";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "../crypto/encryption";

export async function getSlackClient(
  supabase: SupabaseClient,
  businessId: string,
): Promise<WebClient | null> {
  const { data: secret } = await supabase
    .from("secrets")
    .select("encrypted_value")
    .eq("business_id", businessId)
    .eq("provider", "slack")
    .eq("key", "bot_token")
    .single();

  if (!secret) return null;

  const botToken = decrypt(secret.encrypted_value);
  return new WebClient(botToken);
}
```

### Verifying Slack Request Signature
```typescript
// packages/core/slack/slack-events.ts
import { createHmac, timingSafeEqual } from "crypto";

export function verifySlackSignature(
  signingSecret: string,
  rawBody: string,
  timestamp: string,
  signature: string,
): boolean {
  // Replay attack protection: reject requests older than 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
    return false;
  }

  const sigBaseString = `v0:${timestamp}:${rawBody}`;
  const hmac = createHmac("sha256", signingSecret);
  hmac.update(sigBaseString);
  const computedSignature = `v0=${hmac.digest("hex")}`;

  return timingSafeEqual(
    Buffer.from(computedSignature),
    Buffer.from(signature),
  );
}
```

### Auto-Creating Department Channels
```typescript
// packages/core/slack/slack-channels.ts
import type { WebClient } from "@slack/web-api";

export async function createDepartmentChannel(
  client: WebClient,
  businessSlug: string,
  departmentType: string,
): Promise<{ channelId: string; channelName: string }> {
  const channelName = `${businessSlug}-${departmentType}`.toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .slice(0, 80);

  try {
    const result = await client.conversations.create({
      name: channelName,
      is_private: false,
    });
    return {
      channelId: result.channel?.id ?? "",
      channelName: result.channel?.name ?? channelName,
    };
  } catch (error: unknown) {
    // Handle name_taken by appending suffix
    if ((error as { data?: { error?: string } })?.data?.error === "name_taken") {
      const suffixed = `${channelName}-${Date.now().toString(36)}`.slice(0, 80);
      const result = await client.conversations.create({
        name: suffixed,
        is_private: false,
      });
      return {
        channelId: result.channel?.id ?? "",
        channelName: result.channel?.name ?? suffixed,
      };
    }
    throw error;
  }
}
```

### Posting Agent Response to Slack
```typescript
// packages/core/slack/slack-messages.ts
import type { WebClient } from "@slack/web-api";

export async function postAgentResponseToSlack(
  client: WebClient,
  channelId: string,
  agentName: string,
  content: string,
  threadTs?: string,
): Promise<string | undefined> {
  const result = await client.chat.postMessage({
    channel: channelId,
    text: content,
    username: agentName,
    thread_ts: threadTs,
  });
  return result.ts;
}
```

### Event Handler API Route
```typescript
// apps/web/app/api/slack/events/route.ts
export async function POST(request: Request) {
  const rawBody = await request.text();
  const timestamp = request.headers.get("x-slack-request-timestamp") ?? "";
  const signature = request.headers.get("x-slack-signature") ?? "";

  // Verify + parse
  // ... (see verification code above)

  const payload = JSON.parse(rawBody);

  // url_verification challenge
  if (payload.type === "url_verification") {
    return Response.json({ challenge: payload.challenge });
  }

  if (payload.type === "event_callback") {
    const event = payload.event;

    // Skip bot messages to prevent echo loop
    if (event.bot_id || event.subtype === "bot_message") {
      return new Response("ok", { status: 200 });
    }

    // Process message event asynchronously
    if (event.type === "message" && event.text) {
      void handleSlackMessage(payload.team_id, event);
    }

    return new Response("ok", { status: 200 });
  }

  return new Response("ok", { status: 200 });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| RTM API (WebSocket) | Events API (HTTP) + Web API | 2020 | RTM deprecated for new apps. Events API is the standard. |
| `@slack/events-api` package | Events API via direct HTTP handlers | 2023 | Standalone events package deprecated in favor of Bolt or direct handling. |
| Single bot token global | Per-workspace bot token via OAuth | Always for distributed apps | Multi-tenant requires per-workspace token storage. |
| `conversations.history` polling | Events API push notifications | Always recommended | May 2025 rate limit changes make polling even less viable for non-Marketplace apps. |
| Bolt framework for all platforms | Direct `@slack/web-api` for serverless/Next.js | 2023+ | Bolt's Node.js `req`/`res` requirement doesn't work with App Router. |

**Deprecated/outdated:**
- `@slack/events-api`: Deprecated standalone package. Use Bolt or direct HTTP handlers.
- `@slack/rtm-api`: RTM API deprecated for new Slack apps. Use Events API instead.
- Legacy bot tokens: Legacy bots stopped working March 2025. Use new app framework with granular scopes.

## Existing Infrastructure to Leverage

The codebase already has significant relevant infrastructure:

| Existing Component | Location | How to Leverage |
|-------------------|----------|-----------------|
| Conversations table | `packages/db/schema/024_conversations_table.sql` | Add `slack_channel_id` column or use mapping table |
| Messages table | `packages/db/schema/025_messages_table.sql` | Add `slack_ts` column for message deduplication |
| Chat service | `packages/core/chat/chat-service.ts` | Extend `routeAndRespond` with Slack posting step |
| Chat types | `packages/core/chat/chat-types.ts` | Add Slack-specific metadata fields |
| Chat layout UI | `apps/web/_components/chat-layout.tsx` | Refactor to show Slack-synced messages |
| Integration catalog | `packages/core/integrations/catalog.ts` | Slack already listed (id: "slack", isReal: false -> true) |
| Mock messaging adapter | `packages/core/integrations/mock-messaging.ts` | Replace with real Slack adapter |
| Secrets infrastructure | `packages/core/secrets/service.ts` | `saveProviderCredentials` already handles Slack provider |
| Credential fields | `packages/db/schema/039_provider_credential_fields.sql` | Slack fields already seeded: `bot_token`, `signing_secret` |
| Secrets provider column | `packages/db/schema/040_secrets_provider_column.sql` | Provider-scoped lookups ready |
| VPS chat routing | `packages/core/vps/vps-chat.ts` | Agent routing stays; Slack becomes transport layer |

## Required Bot Scopes

For the Slack app configuration:

| Scope | Purpose |
|-------|---------|
| `channels:manage` | Create public channels per department |
| `channels:read` | List and read channel info |
| `channels:history` | Read message history (for initial backfill only) |
| `chat:write` | Post agent responses to channels |
| `users:read` | Get user display names for message attribution |
| `app_mentions:read` | Receive events when bot is @mentioned |

**Event subscriptions needed:**
- `message.channels` -- messages in public channels
- `app_mention` -- when bot is @mentioned

## Database Schema Changes

### New Table: slack_channel_mappings
```sql
CREATE TABLE IF NOT EXISTS public.slack_channel_mappings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments ON DELETE CASCADE,
  slack_channel_id text NOT NULL,
  slack_channel_name text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX ON public.slack_channel_mappings (business_id, slack_channel_id);
CREATE UNIQUE INDEX ON public.slack_channel_mappings (business_id, department_id);
```

### New Table: slack_installations
```sql
CREATE TABLE IF NOT EXISTS public.slack_installations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  slack_team_id text NOT NULL,
  slack_team_name text,
  bot_user_id text NOT NULL,
  installed_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(business_id),
  UNIQUE(slack_team_id)
);
```

### Alter Messages Table
```sql
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS slack_ts text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS slack_channel_id text;
CREATE INDEX IF NOT EXISTS idx_messages_slack_ts ON public.messages (slack_ts) WHERE slack_ts IS NOT NULL;
```

### Alter Conversations Table
```sql
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS slack_channel_id text;
```

## Migration Strategy

The existing custom chat infrastructure should be preserved during transition:

1. **Keep existing chat service and UI working** during Slack integration development
2. **Add Slack as an additional transport** alongside the existing stub/VPS routing
3. **When Slack is connected for a business**, route through Slack; when not, fall back to existing chat
4. **Existing conversation history** remains in Supabase and continues to be viewable
5. **Chat page UI** is refactored to show a Slack connection prompt when Slack is not connected, and Slack-synced messages when it is
6. **No data loss** -- existing messages stay in the messages table

## Open Questions

1. **OAuth State Management**
   - What we know: Need to pass business_id through OAuth flow via state parameter
   - What's unclear: Best approach for state validation in stateless Next.js (cookie vs DB-stored nonce)
   - Recommendation: Use encrypted cookie with business_id + random nonce, validate on callback

2. **Slack App Distribution**
   - What we know: App needs to be installable to multiple workspaces
   - What's unclear: Whether to submit to Slack Marketplace (affects rate limits significantly)
   - Recommendation: Start as internal/non-distributed app. Marketplace submission is a future concern.

3. **Thread vs Channel Messages**
   - What we know: Slack supports threaded conversations within channels
   - What's unclear: Whether agent responses should be in-channel or threaded
   - Recommendation: Start with in-channel replies (simpler). Thread support can be added later using `thread_ts`.

4. **Additional Credential Fields for OAuth**
   - What we know: Current seed has `bot_token` and `signing_secret` for Slack
   - What's unclear: OAuth flow returns bot_token automatically; admin still needs to enter signing_secret from app config manually, plus we need `client_id` and `client_secret` for OAuth
   - Recommendation: Add `client_id` and `client_secret` to provider_credential_fields seed for Slack. These are entered once during app setup. Bot token is obtained via OAuth flow and stored automatically.

## Sources

### Primary (HIGH confidence)
- Slack Events API docs (https://docs.slack.dev/apis/events-api/) - HTTP vs Socket Mode comparison, event delivery, retry behavior
- Slack OAuth docs (https://docs.slack.dev/authentication/installing-with-oauth/) - Full OAuth2 installation flow
- Slack conversations.create docs (https://docs.slack.dev/reference/methods/conversations.create/) - Channel creation API, naming rules, scopes
- Slack rate limits docs (https://docs.slack.dev/apis/web-api/rate-limits/) - Tier system, chat.postMessage special tier
- Slack signing secret verification docs (https://docs.slack.dev/authentication/verifying-requests-from-slack/) - HMAC-SHA256 verification process
- Slack scopes reference (https://docs.slack.dev/reference/scopes/) - Bot scope permissions
- @slack/web-api npm (https://www.npmjs.com/package/@slack/web-api) - v7.15.0, WebClient API
- Slack InstallationStore interface (https://docs.slack.dev/tools/node-slack-sdk/reference/oauth/interfaces/InstallationStore/) - storeInstallation/fetchInstallation

### Secondary (MEDIUM confidence)
- Slack rate limit changes May 2025 (https://docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps/) - Non-Marketplace app restrictions
- GitHub issue #1659 node-slack-sdk (https://github.com/slackapi/node-slack-sdk/issues/1659) - @slack/oauth incompatibility with Next.js 13+ App Router
- Vercel Slack Bolt template (https://vercel.com/templates/next.js/slack-bolt-with-next-js) - Bolt compatibility challenges
- Serverless SlackBot Gist (https://gist.github.com/Christopher-Hayes/684ab3a73e0e8945384d4742e6547693) - Bolt serverless gotchas

### Tertiary (LOW confidence)
- Multi-Tenant Slack Messaging API Guide (https://www.pingram.io/blog/ultimate-multi-tenant-slack-messaging-api-guide-nodejs) - Multi-tenant patterns (unverified third-party)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Slack SDK packages verified via npm, versions confirmed
- Architecture: HIGH - Patterns verified against official Slack docs, Next.js compatibility confirmed via GitHub issues
- Pitfalls: HIGH - Rate limit changes verified via official Slack changelog, event handling verified via official docs
- Existing infrastructure: HIGH - Verified by reading actual codebase files

**Research date:** 2026-03-29
**Valid until:** 2026-04-28 (30 days -- Slack API is stable, no major changes expected)
