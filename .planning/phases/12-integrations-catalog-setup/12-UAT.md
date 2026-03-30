---
status: complete
phase: 12-integrations-catalog-setup
source: 12-01-SUMMARY.md, 12-02-SUMMARY.md
started: 2026-03-29T21:50:00Z
updated: 2026-03-30T05:40:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Add Integration button opens catalog dialog
expected: Navigate to a business's Integrations page. An "Add Integration" button should be visible near the page header. Clicking it opens a dialog showing a search bar and integrations grouped by category.
result: pass

### 2. Catalog entries display with logos and descriptions
expected: In the catalog dialog, each integration entry shows a colored circle logo (brand letter), the integration name in bold, and a short description. There should be 15 entries total: 3 per category (e.g., HubSpot, Salesforce, Pipedrive under CRM).
result: pass

### 3. Catalog search filters by name
expected: Type "slack" in the search bar. Only Slack should remain visible. Clear the search — all 15 entries reappear grouped by category.
result: pass

### 4. Target picker shows departments and agents
expected: Click on any integration (e.g., Slack). Step 2 shows a target picker with departments listed (each with a checkbox for "Entire {name} Department") and agents listed under their departments with individual checkboxes. A count of selected targets appears at the bottom.
result: pass

### 5. Add integration to a department
expected: In the target picker, check a department checkbox (e.g., "Entire Sales Department"). Click "Add Integration". Step 3 shows a success message confirming the integration was added. Back on the integrations page, the new integration appears showing "Department: Sales" (not an agent name).
result: pass

### 6. Add integration to an agent
expected: Open the catalog again, pick a different integration, select an individual agent checkbox (not the department). Click "Add Integration". The integration appears on the integrations page associated with that specific agent.
result: pass

### 7. Category auto-populates from catalog selection
expected: When adding an integration from the catalog, you never see a category dropdown or picker. The category (CRM, email, etc.) is automatically set based on which integration you selected from the catalog.
result: pass

### 8. Agent detail "Add from Catalog" button
expected: Navigate to an agent's detail page and look at the Integrations tab. Instead of per-type "Add Mock" buttons, there should be a single "Add from Catalog" button. Clicking it opens the catalog dialog pre-scoped to that agent.
result: pass

### 9. Integration config card shows department name
expected: On the integrations page, a department-level integration card shows the department name (e.g., "Sales") instead of an agent name. Agent-level cards still show the agent name as before.
result: pass

### 10. AI streaming setup instructions after adding
expected: After adding an integration from the catalog, Step 3 should show AI-generated setup instructions streaming in with a typewriter effect — text appears progressively token by token, not all at once. A blinking cursor indicator shows while streaming.
result: pass

### 11. View Setup button on integration cards
expected: On the integrations page, each integration card has a "View Setup" button (book icon). Clicking it opens a dialog. If instructions were already generated, they display immediately. If not, streaming starts automatically.
result: pass

### 12. Regenerate instructions
expected: In the setup instructions view (either from Step 3 or the View Setup dialog), there's a "Regenerate" button. Clicking it clears the current instructions and streams fresh ones from the AI.
result: pass

## Summary

total: 12
passed: 12
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
