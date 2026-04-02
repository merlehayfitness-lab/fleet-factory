---
phase: 14-slack-integration-chat-replacement
verified: 2026-03-30T18:00:00Z
status: passed
score: 24/24 must-haves verified
re_verification: false
---

# Phase 14: Slack Integration & Chat Replacement Verification Report

**Phase Goal:** Replace custom chat page with Slack API integration so messages route between admin panel agents and Slack, viewable in both places
**Verified:** 2026-03-30
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `slack_installations` table stores per-business Slack workspace tokens with team_id mapping | VERIFIED | `packages/db/schema/041_slack_tables.sql` — full table with UNIQUE(business_id), UNIQUE(slack_team_id), RLS policies |
| 2 | `slack_channel_mappings` table maps Slack channel IDs to department IDs per business | VERIFIED | Same migration — table with partial unique index for dept-level channels (WHERE agent_id IS NULL) |
| 3 | `messages` table has `slack_ts` and `slack_channel_id` columns for bidirectional sync | VERIFIED | `041_slack_tables.sql` lines 109–113 — ALTER TABLE adds both columns with index on slack_ts |
| 4 | Slack Events API webhook verifies signing secret and handles url_verification challenge | VERIFIED | `apps/web/app/api/slack/events/route.ts` — reads raw body, verifies HMAC-SHA256 signature, handles url_verification at line 36 |
| 5 | Inbound Slack messages are stored in Supabase messages table with slack_ts for deduplication | VERIFIED | `packages/core/slack/slack-messages.ts` handleInboundSlackMessage — dedup check at line 46, insert at line 81 with slack_ts |
| 6 | Agent responses are posted back to Slack via chat.postMessage after being stored in Supabase | VERIFIED | `slack-messages.ts` lines 139–160 — calls postAgentResponseToSlack with Block Kit formatting, updates message record with returned slack_ts |
| 7 | Bot message echo loop is prevented by filtering events with bot_id or bot_message subtype | VERIFIED | `packages/core/slack/slack-events.ts` isBotMessage function; events route calls isBotMessage at line 76 and returns 200 early |
| 8 | OAuth flow exchanges code for bot token and stores encrypted credentials per business | VERIFIED | `packages/core/slack/slack-oauth.ts` handleSlackOAuthCallback — calls oauth.v2.access, stores via saveProviderCredentials, upserts slack_installations record |
| 9 | Integrations page has a Connect Slack card as the primary entry point for Slack OAuth | VERIFIED | `apps/web/app/(dashboard)/businesses/[id]/integrations/page.tsx` renders SlackConnectCard in "Workspace Integrations" section, imports getSlackStatusAction |
| 10 | When Slack is NOT connected, chat page shows a secondary Connect Slack CTA directing to integrations page | VERIFIED | `apps/web/_components/chat-layout.tsx` line 62–68 — returns SlackConnectPrompt when !isSlackConnected; prompt has "Go to Integrations" button |
| 11 | When Slack IS connected, chat page displays Slack-synced messages from the Supabase messages table | VERIFIED | ChatLayout renders SlackChatUI which calls getSlackFeedMessagesAction (filters WHERE slack_ts IS NOT NULL) |
| 12 | Channel sidebar shows Slack channels mapped to departments instead of generic department list | VERIFIED | `apps/web/_components/chat-channel-list.tsx` — builds slackNameMap, shows "#channelname" prefix, header shows "Slack Channels" when hasSlack |
| 13 | Channel header displays Connected to Slack status badge with Open in Slack deep link button | VERIFIED | `apps/web/_components/slack-channel-header.tsx` — green dot + "Connected to Slack" badge, "Open in Slack" button with channel+team deep link |
| 14 | Admin can send messages from the chat page that are posted to the mapped Slack channel | VERIFIED | chat-layout.tsx calls sendSlackMessageAction; chat-actions.ts sendSlackMessageAction posts via client.chat.postMessage and stores in Supabase |
| 15 | Custom chat infrastructure is replaced — no fallback to old stub-based chat when Slack is connected | VERIFIED | ChatLayout conditional: when connected renders SlackChatUI with getSlackFeedMessagesAction; stub-based polling and WebSocket logic removed |
| 16 | Agents post to Slack with per-agent username and icon/emoji override for visual distinction | VERIFIED | postAgentResponseToSlack sets username=agentName and icon_emoji=getAgentEmoji(departmentType) |
| 17 | Agent responses use Slack Block Kit for structured formatting with tool calls shown as context blocks | VERIFIED | `packages/core/slack/slack-blocks.ts` formatAgentResponseBlocks — section + divider + context blocks for tool calls |
| 18 | Agents respond only when @mentioned in the channel (not to every message) | VERIFIED | handleInboundSlackMessage line 117 — returns early if !isMentioned; strips @mention from text before routing |
| 19 | Lead agent delegates to sub-agents internally and sub-agent responds in the same channel | VERIFIED | routeAndRespond handles delegation internally; postResponseToSlackIfConnected posts to the department's mapped channel (not a sub-channel) |
| 20 | Slack catalog entry marked as isReal:true with real connection test | VERIFIED | `packages/core/integrations/catalog.ts` line 138 — `isReal: true` for Slack entry |
| 21 | Provider credential fields for Slack include client_id and client_secret for OAuth flow | VERIFIED | `packages/db/schema/039_provider_credential_fields.sql` lines 90–91 — client_id (text, order 2) and client_secret (password, order 3) added |
| 22 | Existing routeAndRespond pipeline extended to post agent responses to Slack when connected | VERIFIED | `packages/core/chat/chat-service.ts` — postResponseToSlackIfConnected called at lines 634 and 701; dynamic import pattern used |
| 23 | Admin panel shows Slack messages per department/agent as an embedded feed view | VERIFIED | getSlackFeedMessages in slack-messages.ts filters slack_ts IS NOT NULL; getSlackFeedMessagesAction in slack-actions.ts exposes it; ChatLayout uses it for polling |
| 24 | Messages viewable both in admin panel and directly in Slack | VERIFIED | Inbound Slack messages stored with slack_ts; outbound admin messages posted via chat.postMessage; "Open in Slack" deep link present |

**Score:** 24/24 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/db/schema/041_slack_tables.sql` | Slack tables, RLS, column alterations | VERIFIED | 117 lines — full schema with slack_installations, slack_channel_mappings, ALTER messages/conversations |
| `packages/core/slack/slack-types.ts` | SlackInstallation, SlackChannelMapping, SlackConnectionStatus, event types | VERIFIED | All 5 types/interfaces exported |
| `packages/core/slack/slack-client.ts` | WebClient factory from encrypted secrets | VERIFIED | createSlackClient + getSlackClient; decrypts via decrypt() |
| `packages/core/slack/slack-events.ts` | Signature verification + event parsing | VERIFIED | verifySlackSignature with timing-safe comparison and replay protection; isBotMessage echo prevention |
| `packages/core/slack/slack-channels.ts` | Channel CRUD and department-to-channel lookup | VERIFIED | createDepartmentChannels, getChannelMappings, getChannelMapping, getDepartmentForChannel, saveChannelMapping |
| `packages/core/slack/slack-messages.ts` | Bidirectional Slack-Supabase message sync | VERIFIED | handleInboundSlackMessage, postAgentResponseToSlack (Block Kit), syncMessageToSupabase, getSlackFeedMessages |
| `packages/core/slack/slack-oauth.ts` | OAuth install flow helpers | VERIFIED | getSlackInstallUrl, handleSlackOAuthCallback, getSlackInstallation, disconnectSlack |
| `packages/core/slack/slack-blocks.ts` | Block Kit formatters | VERIFIED | formatAgentResponseBlocks, formatToolCallAttachment, getAgentEmoji with department emoji mapping |
| `apps/web/app/api/slack/events/route.ts` | POST handler for Events API webhooks | VERIFIED | Reads raw body, verifies signature, handles url_verification, fire-and-forget handleInboundSlackMessage |
| `apps/web/app/api/slack/oauth/callback/route.ts` | GET handler for OAuth redirect | VERIFIED | Exchanges code, calls handleSlackOAuthCallback, auto-creates department channels, redirects to integrations |
| `apps/web/app/api/slack/oauth/install/route.ts` | GET handler to initiate OAuth install | VERIFIED | Validates auth+membership, calls getSlackInstallUrl, redirects |
| `apps/web/_actions/slack-actions.ts` | Server Actions for Slack management | VERIFIED | getSlackStatusAction, connectSlackAction, disconnectSlackAction, getSlackChannelsAction, getSlackFeedMessagesAction |
| `apps/web/_components/slack-connect-card.tsx` | OAuth entry point card on integrations page | VERIFIED | Contains "Connect Slack", OAuth popup with 2s polling, Disconnect button, workspace info when connected |
| `apps/web/_components/slack-connect-prompt.tsx` | Secondary CTA on chat page | VERIFIED | Contains "integrations" navigation, "Go to Integrations" button |
| `apps/web/_components/slack-channel-header.tsx` | Channel header with Slack status + deep link | VERIFIED | Contains "Open in Slack" button with channel+team deep link URL |
| `apps/web/_components/chat-layout.tsx` | Conditional Slack/non-Slack rendering | VERIFIED | Contains slackStatus prop usage; conditional SlackConnectPrompt vs SlackChatUI rendering |
| `apps/web/_components/chat-channel-list.tsx` | Slack channel names with # prefix | VERIFIED | Contains slack_channel_name usage via slackNameMap; "Slack Channels" header when hasSlack |
| `apps/web/_actions/chat-actions.ts` | sendSlackMessageAction for bidirectional messaging | VERIFIED | Exports sendSlackMessageAction — posts to Slack and stores in Supabase with slack_ts |
| `apps/web/app/(dashboard)/businesses/[id]/integrations/page.tsx` | Updated integrations page with SlackConnectCard | VERIFIED | Renders SlackConnectCard above IntegrationsOverview in "Workspace Integrations" section |
| `apps/web/app/(dashboard)/businesses/[id]/chat/page.tsx` | Chat page fetching Slack status + channels | VERIFIED | Fetches slackStatus and slackChannels in Promise.all, passes all to ChatLayout |
| `packages/core/chat/chat-service.ts` | routeAndRespond extended with Slack posting | VERIFIED | postResponseToSlackIfConnected helper with dynamic import; called in both VPS and stub response paths |
| `packages/core/integrations/catalog.ts` | Slack catalog entry isReal: true | VERIFIED | Line 138: isReal: true |
| `packages/core/server.ts` | All Slack exports present | VERIFIED | Lines 198–230 — all Slack module functions re-exported |
| `packages/core/index.ts` | Slack type exports | VERIFIED | SlackInstallation, SlackChannelMapping, SlackConnectionStatus exported at lines 238–240 |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/web/app/api/slack/events/route.ts` | `packages/core/slack/slack-events.ts` | import verifySlackSignature from @fleet-factory/core | WIRED | Imports verifySlackSignature, parseSlackEvent, isMessageEvent, isBotMessage, getSigningSecret |
| `packages/core/slack/slack-messages.ts` | `packages/core/chat/chat-service.ts` | import routeAndRespond for agent routing | WIRED | Line 10: import { getOrCreateConversation, routeAndRespond } from "../chat/chat-service" |
| `packages/core/slack/slack-client.ts` | `packages/core/crypto/encryption.ts` | import decrypt for bot token retrieval | WIRED | Line 6: import { decrypt } from "../crypto/encryption" |
| `packages/core/slack/slack-oauth.ts` | `packages/core/secrets/service.ts` | import saveProviderCredentials for storing bot token | WIRED | Line 7: import { saveProviderCredentials, deleteProviderSecrets } from "../secrets/service" |
| `apps/web/app/(dashboard)/businesses/[id]/integrations/page.tsx` | `apps/web/_components/slack-connect-card.tsx` | renders SlackConnectCard as primary OAuth entry | WIRED | Line 5: import { SlackConnectCard }; rendered at line 112 |
| `apps/web/_components/slack-connect-card.tsx` | `apps/web/_actions/slack-actions.ts` | calls connectSlackAction, getSlackStatusAction | WIRED | Lines 9–12: imports connectSlackAction, getSlackStatusAction, disconnectSlackAction |
| `apps/web/app/(dashboard)/businesses/[id]/chat/page.tsx` | `apps/web/_actions/slack-actions.ts` | import getSlackStatusAction | WIRED | Line 6: import { getSlackStatusAction, getSlackChannelsAction } |
| `apps/web/_components/chat-layout.tsx` | `apps/web/_components/slack-connect-prompt.tsx` | render when Slack is not connected | WIRED | Line 9: import { SlackConnectPrompt }; rendered at line 65 |
| `apps/web/_actions/chat-actions.ts` | `packages/core/slack/slack-messages.ts` (via core) | import postAgentResponseToSlack / getSlackClient | WIRED | sendSlackMessageAction calls getSlackClient and client.chat.postMessage |
| `packages/core/chat/chat-service.ts` | `packages/core/slack/slack-messages.ts` | dynamic import postAgentResponseToSlack | WIRED | Lines 748–749: dynamic import in postResponseToSlackIfConnected |
| `packages/core/slack/slack-messages.ts` | `packages/core/slack/slack-blocks.ts` | import formatAgentResponseBlocks | WIRED | Lines 12–15: imports formatAgentResponseBlocks, formatToolCallAttachment, getAgentEmoji |
| `packages/core/slack/slack-messages.ts` | `packages/core/slack/slack-client.ts` | import getSlackClient | WIRED | Line 9: import { getSlackClient } from "./slack-client" |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SLACK-01 | 14-01, 14-03 | Slack API integration routes messages to/from department agents | SATISFIED | Events route + handleInboundSlackMessage + postResponseToSlackIfConnected in routeAndRespond |
| SLACK-02 | 14-02, 14-03 | Embedded Slack feed view in admin panel per department/agent | SATISFIED | getSlackFeedMessages (slack_ts IS NOT NULL filter) + getSlackFeedMessagesAction + ChatLayout polling |
| SLACK-03 | 14-01, 14-03 | Messages viewable both in admin panel and directly in Slack | SATISFIED | Inbound messages stored with slack_ts; outbound posted via chat.postMessage; "Open in Slack" deep links |
| SLACK-04 | 14-02 | Custom chat page replaced with Slack-powered interface | SATISFIED | ChatLayout conditionally renders SlackConnectPrompt or SlackChatUI; old stub chat logic removed when Slack connected |

---

## Anti-Patterns Found

No blockers or stub patterns detected.

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `apps/web/app/api/slack/events/route.ts` | Imports getSupabaseServiceRoleKey but uses process.env directly (line 41) | Info | Inconsistency only — not a functional gap; both access the same env var |

---

## Human Verification Required

### 1. OAuth Popup Flow

**Test:** On the integrations page for a business, click "Connect Slack" and complete the OAuth flow in the popup.
**Expected:** Popup opens Slack authorization page; after authorizing, popup closes and the card automatically detects connection (polling) and shows the connected state with workspace name; department channels are auto-created in Slack.
**Why human:** OAuth popup behavior, connection detection timing, and channel creation success require a live Slack app and real credentials.

### 2. Signing Secret Configuration Gap

**Test:** After completing OAuth, verify that the signing_secret credential is manually configured before Slack events are processed.
**Expected:** The signing_secret must be added via the integrations credential drawer (039 migration adds the field). The events route returns 500 "Signing secret not configured" until it is set. This is documented in Plan 01 SUMMARY but not surfaced to the user in the UI.
**Why human:** The signing_secret is an app-level credential (set in Slack's Basic Information page) that is NOT returned by the OAuth flow. Users connecting via the OAuth popup will have a working OAuth connection but events will fail silently (500 response) until they separately configure the signing_secret. A UI warning or setup prompt may be desirable.

### 3. Inbound Message Flow (End-to-End)

**Test:** With a connected Slack workspace and configured signing_secret, send a message @mentioning the bot in a mapped Slack channel.
**Expected:** The Events API webhook fires, verifies the signature, routes to the department agent, receives a response, and posts it back to Slack with the agent's username and department emoji. The same conversation should appear in the admin panel chat page.
**Why human:** Requires live Slack environment, real webhook delivery, and working agent pipeline.

### 4. Block Kit Rendering

**Test:** Trigger an agent response that includes tool calls (e.g., a knowledge lookup).
**Expected:** Slack message shows section block for content, divider, and context blocks with wrench emoji for each tool call.
**Why human:** Slack Block Kit rendering requires a live Slack environment to verify appearance.

---

## Setup Requirements (Documented)

The following environment variables and Slack app configuration are required before the integration is functional:

- `SLACK_CLIENT_ID` — From Slack app Basic Information page
- `SLACK_CLIENT_SECRET` — From Slack app Basic Information page
- `NEXT_PUBLIC_APP_URL` — Base URL of the app for OAuth redirect URI
- Slack app bot scopes: `channels:manage`, `channels:read`, `channels:history`, `chat:write`, `users:read`, `app_mentions:read`
- Slack app event subscriptions: `message.channels`, `app_mention`
- Slack app Request URL: `{APP_URL}/api/slack/events`
- Slack app Redirect URL: `{APP_URL}/api/slack/oauth/callback`
- Per-business signing_secret configured via the integrations credential drawer after OAuth

---

## Gaps Summary

No gaps found. All 24 observable truths verified against the codebase. All 4 SLACK requirements (SLACK-01 through SLACK-04) are satisfied by the implementation.

The only item worth noting is that the `signing_secret` must be configured manually after OAuth (it is not returned by the Slack OAuth flow), and there is no in-product prompt reminding users to do so. This is a UX improvement opportunity but does not block the integration from functioning when properly configured.

All 8 task commits verified in git history:
- Plan 01: abef61d, d609044, d86f97d
- Plan 02: 79c2efc, 83102c8, 0631ce5
- Plan 03: 403c33a, 43b1bb9

---

_Verified: 2026-03-30_
_Verifier: Claude (gsd-verifier)_
