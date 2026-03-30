---
phase: 14-slack-integration-chat-replacement
plan: 01
subsystem: integrations
tags: [slack, oauth, webhooks, events-api, messaging, websdk]

# Dependency graph
requires:
  - phase: 13-secrets-management-ux
    provides: "Encrypted secrets storage with provider-scoped credentials (saveProviderCredentials, deleteProviderSecrets)"
  - phase: 05-observability-emergency-chat
    provides: "Chat service with routeAndRespond pipeline, conversations/messages tables"
provides:
  - "Slack installations table (one workspace per business) with RLS"
  - "Slack channel mappings table (channel-to-department mapping) with RLS"
  - "Slack WebClient factory from encrypted secrets"
  - "Slack Events API signature verification with replay protection"
  - "Bidirectional message sync between Slack and Supabase"
  - "OAuth install flow with automatic department channel creation"
  - "Server actions for Slack connection management"
  - "API route handlers for Events API webhooks and OAuth flow"
affects: [14-02, 14-03, slack-ui, chat-page]

# Tech tracking
tech-stack:
  added: ["@slack/web-api v7.15.0", "@slack/oauth v3.0.5"]
  patterns: ["WebClient factory from encrypted secrets", "Events API webhook with fire-and-forget processing", "Service role client for external webhooks (SECR-05 exception)"]

key-files:
  created:
    - packages/db/schema/041_slack_tables.sql
    - packages/core/slack/slack-types.ts
    - packages/core/slack/slack-client.ts
    - packages/core/slack/slack-events.ts
    - packages/core/slack/slack-channels.ts
    - packages/core/slack/slack-messages.ts
    - packages/core/slack/slack-oauth.ts
    - apps/web/app/api/slack/events/route.ts
    - apps/web/app/api/slack/oauth/callback/route.ts
    - apps/web/app/api/slack/oauth/install/route.ts
    - apps/web/_actions/slack-actions.ts
  modified:
    - packages/db/schema/_combined_schema.sql
    - packages/core/server.ts
    - packages/core/index.ts
    - packages/core/package.json

key-decisions:
  - "Used @slack/web-api directly with Next.js API routes instead of Bolt framework (Bolt incompatible with App Router)"
  - "Events API webhook uses service_role client (SECR-05 exception for external system auth)"
  - "All Slack event processing is fire-and-forget to meet 3-second response timeout"
  - "Bot echo loop prevented by checking bot_id and bot_message subtype"
  - "OAuth state parameter carries businessId for mapping callback to correct tenant"
  - "Channel naming uses {business-slug}-{dept-type} pattern with name_taken suffix fallback"

patterns-established:
  - "Slack WebClient factory: getSlackClient fetches encrypted bot_token from secrets, decrypts, returns WebClient"
  - "Events API handler: read raw body first for signature verification, then parse JSON"
  - "Channel mapping: slack_channel_mappings table maps Slack channel IDs to department/agent IDs"
  - "Inbound message flow: Slack event -> verify signature -> lookup department -> store message -> route to agent -> post response back"

requirements-completed: [SLACK-01, SLACK-03]

# Metrics
duration: 9min
completed: 2026-03-30
---

# Phase 14 Plan 01: Slack Foundation Summary

**Slack SDK integration with Events API webhooks, OAuth install flow, encrypted credential management, and bidirectional message sync between Slack channels and Supabase via department-mapped routing**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-30T12:18:55Z
- **Completed:** 2026-03-30T12:27:25Z
- **Tasks:** 3
- **Files modified:** 15

## Accomplishments
- Database schema for multi-tenant Slack installations with per-business workspace isolation and channel-department mapping
- Six Slack service modules covering WebClient factory, signature verification, channel management, bidirectional message sync, and OAuth flow
- Three API route handlers for Events API webhooks, OAuth install initiation, and OAuth callback with auto channel creation
- Server actions for frontend Slack connection management (status, connect, disconnect, channel listing)

## Task Commits

Each task was committed atomically:

1. **Task 1: Database migration for Slack tables and column additions** - `abef61d` (feat)
2. **Task 2: Slack service modules and barrel exports** - `d609044` (feat)
3. **Task 3: API route handlers and server actions** - `d86f97d` (feat)

## Files Created/Modified
- `packages/db/schema/041_slack_tables.sql` - Slack installations, channel mappings tables, messages/conversations column additions
- `packages/db/schema/_combined_schema.sql` - Appended migration 041
- `packages/core/slack/slack-types.ts` - SlackInstallation, SlackChannelMapping, SlackConnectionStatus types
- `packages/core/slack/slack-client.ts` - WebClient factory from encrypted bot token
- `packages/core/slack/slack-events.ts` - HMAC-SHA256 signature verification with replay protection
- `packages/core/slack/slack-channels.ts` - Department channel creation and mapping CRUD
- `packages/core/slack/slack-messages.ts` - Bidirectional Slack-Supabase message sync
- `packages/core/slack/slack-oauth.ts` - OAuth install flow and disconnect
- `packages/core/server.ts` - Added Slack server-only exports
- `packages/core/index.ts` - Added Slack client-safe type exports
- `apps/web/app/api/slack/events/route.ts` - Events API webhook POST handler
- `apps/web/app/api/slack/oauth/install/route.ts` - OAuth install GET handler
- `apps/web/app/api/slack/oauth/callback/route.ts` - OAuth callback GET handler
- `apps/web/_actions/slack-actions.ts` - Server actions for Slack management

## Decisions Made
- Used `@slack/web-api` directly instead of Bolt framework due to known App Router incompatibility
- Events API webhook handler uses service_role Supabase client (SECR-05 exception) since Slack webhooks have no user auth session
- Fire-and-forget pattern for message processing ensures Slack's 3-second timeout is always met
- OAuth state parameter uses businessId directly for tenant mapping (simple, effective for MVP)
- Sub-agent channels created alongside department channels with naming pattern `{slug}-{dept-type}-{agent-role}`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing typecheck errors in deployment and approval components (deploy-button.tsx, deployment-detail.tsx, rollback-dialog.tsx, approval-card.tsx) are unrelated to this plan's changes. All Slack modules compile without errors.

## User Setup Required

Slack integration requires the following environment variables to be configured:
- `SLACK_CLIENT_ID` - From Slack app Basic Information page
- `SLACK_CLIENT_SECRET` - From Slack app Basic Information page
- `NEXT_PUBLIC_APP_URL` - Base URL of the app for OAuth redirect URI

Slack app must be configured with:
- Bot scopes: `channels:manage`, `channels:read`, `channels:history`, `chat:write`, `users:read`, `app_mentions:read`
- Event subscriptions: `message.channels`, `app_mention`
- Request URL: `{APP_URL}/api/slack/events`
- Redirect URL: `{APP_URL}/api/slack/oauth/callback`

## Next Phase Readiness
- Slack foundation layer complete, ready for UI integration (14-02: Chat page redesign)
- All service modules are tested via typecheck and ready for use in frontend components
- Channel mappings and message sync infrastructure supports the bidirectional Slack feed view

## Self-Check: PASSED

All 11 created files verified present. All 3 task commits verified in git log.

---
*Phase: 14-slack-integration-chat-replacement*
*Completed: 2026-03-30*
