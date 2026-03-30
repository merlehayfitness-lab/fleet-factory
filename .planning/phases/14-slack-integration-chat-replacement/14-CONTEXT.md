# Phase 14: Slack Integration & Chat Replacement - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace custom chat page with Slack API integration so messages route between admin panel agents and Slack, viewable in both places. The existing custom chat becomes Slack-powered — no duplicate chat infrastructure.

</domain>

<decisions>
## Implementation Decisions

### Slack Connection Flow
- "Connect Slack" lives on the integrations page (Phase 12 catalog) — not a separate settings section
- OAuth flow opens in a popup window (not full redirect) so admin stays on the page
- On connect, auto-create one Slack channel per department (including sub-agent channels)
- Admin can also add agents to ANY existing Slack workspace channel beyond the auto-created ones
- When Slack is NOT connected, the chat page shows a "Connect Slack" CTA — no fallback to old custom chat

### Channel-to-Department Mapping
- Auto-created channels use `{business-slug}-{department-type}` naming (e.g. #acme-sales, #acme-support)
- Sub-agents get their own sub-channels (e.g. #acme-sales-paid-ads)
- Agents can be assigned to any channel in the workspace, not just auto-created department channels
- Channel-department mapping stored in `slack_channel_mappings` table

### Chat Page Replacement UX
- Slack-style redesign — not just the old layout backed by Slack data, but a UI that feels more like Slack (thread support, richer formatting, reactions-style display)
- Bidirectional messaging — admin can send messages from the panel that appear in Slack, and Slack messages appear in the panel
- Existing conversation history is archived and hidden — chat page starts fresh with Slack messages only
- "Connected to Slack" status badge with "Open in Slack" deep link button that links directly to the relevant channel

### Agent Identity in Slack
- Single bot app with per-agent username AND icon/emoji override for visual distinction between agents
- Agents respond only when @mentioned — not to every message in the channel
- Agent responses use Slack Block Kit for structured rich formatting — tool calls shown as attachments, actions as buttons
- When lead agent delegates to sub-agent, the sub-agent responds in the same channel (not in its own sub-channel) — conversation stays in one place

### Message Routing
- Lead agent receives @mentions in department channel
- Lead can delegate to sub-agents internally — sub-agent response posts in the same channel
- Existing VPS agent routing pipeline stays — Slack becomes the transport layer on top
- Messages synced bidirectionally: Slack events write to Supabase, agent responses write to Supabase AND post to Slack

### Claude's Discretion
- Exact Slack Block Kit layout for agent responses
- Loading/syncing states in the redesigned chat page
- Error state handling for Slack API failures
- Exact OAuth state management approach (cookie vs DB nonce)
- Polling interval for message sync in admin panel

</decisions>

<specifics>
## Specific Ideas

- Chat page should feel like Slack — thread support, rich formatting, channel-based navigation
- Agents should be visually distinct in Slack with their own avatars/icons so users know which agent is responding
- "Open in Slack" deep link should go directly to the specific channel, not just the workspace
- The admin panel is a full participant in Slack conversations — bidirectional, not just a viewer

</specifics>

<deferred>
## Deferred Ideas

- Slack Marketplace submission — start as internal/non-distributed app, Marketplace submission is a future concern
- Thread support in admin panel — start with channel-level messages, thread rendering can be enhanced later
- Reactions/emoji support — visual display only, not interactive from the panel initially

</deferred>

---

*Phase: 14-slack-integration-chat-replacement*
*Context gathered: 2026-03-30*
