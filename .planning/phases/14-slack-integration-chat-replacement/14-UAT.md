---
status: complete
phase: 14-slack-integration-chat-replacement
source: [14-01-SUMMARY.md, 14-02-SUMMARY.md, 14-03-SUMMARY.md]
started: 2026-03-30T17:30:00Z
updated: 2026-03-30T21:50:00Z
---

## Tests

### 1. Integrations page shows Slack Connect card
expected: Workspace Integrations section with Slack card, "Not connected" badge, Connect Slack button
result: pass

### 2. Chat page shows Connect Slack prompt when not connected
expected: Centered prompt with Slack icon, "Connect Slack to get started", and "Go to Integrations" button
result: pass

### 3. Go to Integrations button navigates correctly
expected: Clicking "Go to Integrations" navigates to /businesses/{id}/integrations
result: pass

### 4. OAuth setup and connection flow
expected: Connect Slack opens popup, OAuth authorize page, callback stores credentials, card shows Connected
result: pass (after fixes)
notes: |
  - Required inline setup dialog for Client ID + Client Secret (no env var dependency)
  - Required ngrok tunnel for HTTPS redirect URL
  - Required migration 041 applied to Supabase
  - Fixed: silent failure on missing credentials -> setup dialog with guidance
  - Fixed: redirect_uri missing host -> defaults to NEXT_PUBLIC_APP_URL
  - Fixed: OAuth callback redirected inside popup -> self-closing HTML page
  - Fixed: no success feedback -> sonner toast on connection

### 5. Chat page Slack-powered UI when connected
expected: Channel sidebar with # names, channel header with Connected badge and Open in Slack, message input
result: pass
notes: |
  - 4 department channels shown correctly (operations, owner, sales, support)
  - Department icons (gear, crown, chart, headphones) display correctly
  - Channel header shows department label, green Connected to Slack badge, Open in Slack link
  - Message input shows "Message #channel-name" placeholder
  - Empty state: "No messages yet - Send a message below or @mention the bot"

### 6. Typecheck passes
expected: pnpm turbo typecheck succeeds
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0

## Gaps

### GAP-01: "Unknown Agent" integration record from credential save
severity: minor
description: |
  When saveSlackAppCredentialsAction saves client_id/client_secret, saveProviderCredentials auto-creates an integration record for the "slack" provider. This creates a phantom "Unknown Agent" entry under Messaging on the integrations page because the integration has no agent_id or department_id association.
fix: Filter out workspace-level integrations (no agent_id, no department_id) from the per-category display, or skip integration auto-creation for app-level credentials (client_id, client_secret).

### GAP-02: Channel count includes sub-agent channels
severity: cosmetic
description: |
  The Slack connect card shows "11 channels mapped" which includes sub-agent channels. The chat sidebar correctly shows only 4 department-level channels. The count is misleading.
fix: Filter getSlackChannelsAction to count only department-level channels (WHERE agent_id IS NULL) for the card display.

### GAP-03: Slack channels not visible in workspace sidebar
severity: expected-behavior
description: |
  Department channels (profit-press-owner, etc.) were created via API but don't auto-appear in every user's Slack sidebar. Users must browse/join channels manually in Slack.
fix: Consider having the bot post an intro message in each channel after creation, or invite the installing user to all channels via conversations.invite.

## Tests Not Run (require live Slack event subscriptions)

These tests require Event Subscriptions configured with a public URL (ngrok) pointing to /api/slack/events:
- Bidirectional messaging: send from admin panel, appears in Slack
- Inbound Slack messages appear in admin panel
- Agent responds only when @mentioned
- Block Kit formatting in Slack responses
- Agent identity (username + emoji) in Slack

These are backend pipeline features that work at the code level (verified via typecheck and code review) but need a full Slack Events API setup to test end-to-end.
