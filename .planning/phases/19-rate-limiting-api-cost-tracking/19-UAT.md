---
status: testing
phase: 19-rate-limiting-api-cost-tracking
source: 19-01-SUMMARY.md, 19-02-SUMMARY.md, 19-03-SUMMARY.md, 19-04-SUMMARY.md
started: 2026-04-01T17:00:00Z
updated: 2026-04-01T17:00:00Z
---

## Current Test

number: 1
name: Sidebar Navigation — RevOps & Usage Links
expected: |
  Business sidebar shows "RevOps" and "Usage" links with icons (TrendingUp and BarChart3). Clicking each navigates to the correct page.
awaiting: user response

## Tests

### 1. Sidebar Navigation — RevOps & Usage Links
expected: Business sidebar shows "RevOps" and "Usage" links with icons. Clicking each navigates to the correct page.
result: pass

### 2. Command Center Cost Cards
expected: Command Center page shows real cost data — "Cost Today", "Cost This Week", "Cost This Month" cards with dollar amounts. Provider and model breakdown sections visible below.
result: conditional pass — UI renders correctly with $0.00 empty state. Pipeline is real code (not mocked), will populate when chat flows through VPS rate-limited path post-phase-17.

### 3. RevOps Agent Budgets
expected: RevOps page (/businesses/[id]/revops) shows table of agents with token budget column (from agent or template fallback), cost column, and plan tier badge for the business.
result: conditional pass — Pro Plan badge shows, cost cards render, empty state correct. Real data pending chat flow activation.

### 4. Usage Analytics Page
expected: /businesses/[id]/usage loads with Recharts area chart showing token usage over time, bar chart for cost breakdown, and breakdown tables by provider and model.
result: conditional pass — page loads, chart components render without errors. Empty data expected pre-phase-17 chat activation.

### 5. Usage Time Filters
expected: Usage page has time period filter buttons (24h, 7d, 30d, MTD, YTD). Clicking a filter updates the charts and tables. URL searchParams change to reflect selection.
result: pass

### 6. Agent Budget Banner
expected: Agent detail page (/businesses/[id]/agents/[agentId]) shows budget utilization status — amber warning banner when approaching 80% of budget, red blocked banner at 100%.
result: conditional pass — no banner at 0% utilization is correct. checkBudget() wired on line 142, amber/red conditionals on line 175+. Will trigger at 80%+ usage.

### 7. Business Overview Budget Display
expected: Business overview page shows plan tier badge (trial/starter/pro/enterprise), utilization indicator when usage > 50%, and red banner when monthly token limit is reached.
result: pass (plan tier badge) / conditional pass (utilization indicator hidden <50%, red banner needs limit reached)

### 8. Chat Budget-Exceeded Message
expected: When an agent's budget is exceeded, sending a chat message returns a friendly system message about the token budget being reached (instead of an error or crash).
result: [pending]

### 9. Chat Queue Status
expected: When a chat request is rate-limited (all slots busy), chat shows a queue position message with a spinner that auto-polls until the response arrives.
result: [pending]

## Summary

total: 9
passed: 0
issues: 0
pending: 9
skipped: 0

## Gaps

[none yet]
