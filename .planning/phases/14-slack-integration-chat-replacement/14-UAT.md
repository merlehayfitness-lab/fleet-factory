---
status: testing
phase: 14-slack-integration-chat-replacement
source: [14-01-SUMMARY.md, 14-02-SUMMARY.md, 14-03-SUMMARY.md]
started: 2026-03-30T17:30:00Z
updated: 2026-03-30T17:30:00Z
---

## Current Test

number: 1
name: Integrations page shows Slack Connect card
expected: |
  Navigate to /businesses/{id}/integrations. Above the existing integrations overview, there should be a "Workspace Integrations" section with a Slack card showing: Slack icon/logo, "Slack" heading, description about connecting workspace, a "Connect Slack" button, and a "Not connected" badge.
awaiting: user response

## Tests

### 1. Integrations page shows Slack Connect card
expected: Navigate to /businesses/{id}/integrations. Above the existing integrations overview, there should be a "Workspace Integrations" section with a Slack card showing: Slack icon/logo, "Slack" heading, description about connecting workspace, a "Connect Slack" button, and a "Not connected" badge.
result: [pending]

### 2. Chat page shows Connect Slack prompt when not connected
expected: Navigate to /businesses/{id}/chat. Instead of the previous chat interface, you should see a centered prompt with a Slack icon, heading "Connect Slack to get started", explanatory text about linking from the Integrations page, and a "Go to Integrations" button that navigates to the integrations page.
result: [pending]

### 3. Go to Integrations button navigates correctly
expected: On the chat page Connect Slack prompt, clicking "Go to Integrations" should navigate you to /businesses/{id}/integrations where the Slack Connect card is visible.
result: [pending]

### 4. OAuth popup opens on Connect Slack click
expected: On the integrations page, clicking "Connect Slack" should open a centered popup window (~600x700). If SLACK_CLIENT_ID is not configured, the popup may show an error — that's expected for dev without env vars. If configured, it should redirect to Slack's authorize page. (Skip if no Slack app configured yet.)
result: [pending]

### 5. Slack credential fields in provider setup
expected: Navigate to /businesses/{id}/integrations and find the Slack integration in the catalog. Its credential fields should include client_id, client_secret, bot_token, and signing_secret entries.
result: [pending]

### 6. Database migration applied
expected: In Supabase dashboard, check the tables list. You should see `slack_installations` and `slack_channel_mappings` tables. The `messages` table should have `slack_ts` and `slack_channel_id` columns. The `conversations` table should have a `slack_channel_id` column. (Skip if you haven't run the migration yet.)
result: [pending]

### 7. Typecheck passes cleanly
expected: Running `pnpm turbo typecheck` completes successfully with no errors. All Slack modules, API routes, server actions, and UI components compile without issues.
result: [pending]

### 8. Slack API routes exist
expected: The following API route files should exist and be accessible: /api/slack/events (POST), /api/slack/oauth/install (GET), /api/slack/oauth/callback (GET). You can verify by checking the files exist or hitting them in a browser (they should return appropriate error responses, not 404).
result: [pending]

### 9. Chat layout conditional rendering
expected: When Slack is NOT connected (default state), the chat page should show the Connect Slack prompt — NOT the old department-based chat with stub messages. The old WebSocket streaming and fake typing indicators should be gone.
result: [pending]

### 10. Slack integration marked as real in catalog
expected: On the integrations page, the Slack integration entry should appear as a "real" (live) integration — not a stub/mock. It should show connection affordances rather than a "coming soon" or demo indicator.
result: [pending]

## Summary

total: 10
passed: 0
issues: 0
pending: 10
skipped: 0

## Gaps

[none yet]
