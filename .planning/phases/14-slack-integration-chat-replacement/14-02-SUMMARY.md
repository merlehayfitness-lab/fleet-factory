---
phase: 14-slack-integration-chat-replacement
plan: 02
subsystem: ui
tags: [slack, chat, oauth, bidirectional-messaging, deep-links, next.js]

# Dependency graph
requires:
  - phase: 14-01
    provides: Slack DB schema, OAuth flow, channel creation, message sync services, API routes
provides:
  - SlackConnectCard on integrations page as primary OAuth entry point
  - SlackConnectPrompt on chat page as secondary CTA directing to integrations page
  - SlackChannelHeader with connection badge and Open in Slack deep link
  - Refactored ChatLayout with Slack/non-Slack conditional rendering
  - Updated channel list with Slack channel names (# prefix)
  - sendSlackMessageAction for bidirectional Slack messaging
  - Flat Slack-like message bubble layout with Slack user identity display
affects: [14-03, chat-page, integrations-page]

# Tech tracking
tech-stack:
  added: []
  patterns: [conditional-layout-rendering, slack-deep-links, bidirectional-slack-messaging]

key-files:
  created:
    - apps/web/_components/slack-connect-card.tsx
    - apps/web/_components/slack-connect-prompt.tsx
    - apps/web/_components/slack-channel-header.tsx
  modified:
    - apps/web/app/(dashboard)/businesses/[id]/integrations/page.tsx
    - apps/web/app/(dashboard)/businesses/[id]/chat/page.tsx
    - apps/web/_components/chat-layout.tsx
    - apps/web/_components/chat-channel-list.tsx
    - apps/web/_components/chat-message-bubble.tsx
    - apps/web/_components/chat-message-input.tsx
    - apps/web/_actions/chat-actions.ts

key-decisions:
  - "SlackConnectCard uses OAuth popup with 2s polling (30s timeout) for connection detection"
  - "SlackConnectPrompt directs to integrations page (not OAuth directly) per user decision"
  - "Open in Slack deep links go to specific channel via slack.com/app_redirect with channel+team params"
  - "Flat Slack-like message layout replaces bubble-style for all messages (user and agent)"
  - "sendSlackMessageAction posts to Slack then returns immediately; agent response arrives via Slack events + polling"
  - "WebSocket streaming and stub typing indicator removed when Slack is connected"

patterns-established:
  - "Conditional layout rendering: ChatLayout renders SlackConnectPrompt or SlackChatUI based on slackStatus.connected"
  - "SlackChatUI extracted to separate function to avoid hooks in conditional branches"
  - "Channel display uses slackNameMap for O(1) lookup of Slack channel names by departmentId"

requirements-completed: [SLACK-02, SLACK-04]

# Metrics
duration: 6min
completed: 2026-03-30
---

# Phase 14 Plan 02: Slack Chat Page & Integrations UI Summary

**Slack-powered chat page with bidirectional messaging, channel-based navigation, and OAuth connect card on integrations page**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-30T16:30:18Z
- **Completed:** 2026-03-30T16:36:18Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- SlackConnectCard on integrations page as primary OAuth entry point with popup flow and connection polling
- Chat page conditionally renders Slack-powered UI or Connect Slack prompt directing to integrations page
- Channel sidebar shows Slack channel names with # prefix mapped to departments
- Channel header displays "Connected to Slack" badge with "Open in Slack" deep link to specific channel
- sendSlackMessageAction posts to Slack AND stores in Supabase for bidirectional messaging
- Flat Slack-like message layout with user/agent identity and Slack username display

## Task Commits

Each task was committed atomically:

1. **Task 1: Integrations page Slack connect card** - `79c2efc` (feat)
2. **Task 2: Chat page server component, Connect Slack prompt, and channel header** - `83102c8` (feat)
3. **Task 3: Refactored chat layout, channel list, message display, and send actions** - `0631ce5` (feat)

## Files Created/Modified
- `apps/web/_components/slack-connect-card.tsx` - Slack connection card with OAuth popup, connection polling, disconnect
- `apps/web/_components/slack-connect-prompt.tsx` - Secondary CTA directing users to integrations page
- `apps/web/_components/slack-channel-header.tsx` - Channel header with Slack badge and Open in Slack deep link
- `apps/web/app/(dashboard)/businesses/[id]/integrations/page.tsx` - Added SlackConnectCard in Workspace Integrations section
- `apps/web/app/(dashboard)/businesses/[id]/chat/page.tsx` - Fetches Slack status/channels, passes to ChatLayout
- `apps/web/_components/chat-layout.tsx` - Conditional Slack/non-Slack rendering, removed WebSocket/stub logic
- `apps/web/_components/chat-channel-list.tsx` - Slack channel names with # prefix, "Slack Channels" header
- `apps/web/_components/chat-message-bubble.tsx` - Flat Slack-like layout with Slack user identity
- `apps/web/_components/chat-message-input.tsx` - "Message #channel-name" placeholder when Slack connected
- `apps/web/_actions/chat-actions.ts` - sendSlackMessageAction for bidirectional Slack messaging

## Decisions Made
- SlackConnectCard uses inline anchor styling instead of `asChild` Button (base-ui does not support asChild)
- OAuth popup polls getSlackStatusAction every 2 seconds for up to 30 seconds to detect successful connection
- SlackConnectPrompt directs to integrations page per user decision (not OAuth directly from chat page)
- Open in Slack deep links use `slack.com/app_redirect?channel={id}&team={id}` for channel-specific navigation
- Flat Slack-like message layout: all messages left-aligned with avatar + name + timestamp header row
- sendSlackMessageAction returns only `{ userMessage }` -- agent response arrives asynchronously via Slack events + polling
- WebSocket streaming and typing indicator stub logic removed (Slack is the transport layer)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Linter auto-reverted component files when child component interfaces didn't yet include new props; resolved by writing child components first, then parent components that reference them

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Chat page fully Slack-powered when connected, with bidirectional messaging
- Ready for Plan 03 (Slack Block Kit formatting, thread support, and agent identity enhancements)

---
*Phase: 14-slack-integration-chat-replacement*
*Completed: 2026-03-30*
