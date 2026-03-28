---
status: resolved
phase: 09-skill-management-deployment
source: 09-01-SUMMARY.md, 09-02-SUMMARY.md, 09-03-SUMMARY.md, 09-04-SUMMARY.md
started: 2026-03-28T17:00:00Z
updated: 2026-03-28T18:30:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Skills Tab on Agent Detail
expected: Navigate to any agent detail page. You should see 7 tabs total. "Skills" tab appears between "Integrations" and "Knowledge". Clicking it shows the Skills tab content with "New Skill", "Add from Templates", and "Import from GitHub" buttons.
result: pass

### 2. Create New Skill via Editor
expected: On the Skills tab, click "New Skill". A large dialog opens with a split-pane layout: structured form on the left (name, description, instructions, trigger phrases fields), and a live SKILL.md preview on the right in monospace text. Fill in fields and the preview updates in real-time. Click Save and the skill is created.
result: pass

### 3. Edit Existing Skill
expected: After creating a skill, click its name in the assignment list. The editor opens in edit mode with fields pre-populated. The dialog shows a version badge (e.g. "v1"). Make a change and save — the version should increment to "v2".
result: pass

### 4. Skill Assignment Checkboxes
expected: On the Skills tab, you see a checkbox list of all business skills. Checked = assigned to this agent. Checking an unassigned skill assigns it. The checkbox state updates after the action completes.
result: pass

### 5. Unassign Skill Confirmation
expected: Uncheck an agent-level skill (not inherited). A confirmation dialog appears: "Remove {skill name} from this agent?" Confirming removes the assignment. Canceling keeps it checked.
result: pass

### 6. Skill Count on Agent Cards
expected: Navigate to the agents list page (/businesses/[id]/agents). Agent cards display a skill count (e.g. "3 skills") for agents that have skills assigned. Agents with no skills show no count.
result: pass

### 7. Browse and Add Skill Templates
expected: On the Skills tab, click "Add from Templates". A dialog opens showing a card grid of starter templates. You can filter by department (Owner, Sales, Support, Operations). Clicking "Preview" shows the full template content. Clicking "Add to Library" creates a copy in your business library and assigns it to the current agent.
result: pass

### 8. GitHub Import Dialog
expected: On the Skills tab, click "Import from GitHub". A dialog opens with a URL input field. Entering a URL and clicking "Check URL" validates the URL format (should accept github.com blob/tree URLs). For invalid URLs, an error is shown. Info text at bottom reads "Public repositories only."
result: issue
reported: "Works for root-level .md files but doesn't recurse into subdirectories. Want it to scan all subfolders and group imported skills under the repo name as a collection in the library."
severity: minor

### 9. Sidebar Nav and Skill Library Page
expected: In the sidebar navigation, you see a "Skills" item (with Sparkles icon) after "Templates". Clicking it navigates to /businesses/[id]/skills. The page shows a "Skill Library" header with "New Skill", "Import from GitHub", and "Browse Templates" buttons. Below is a card grid of business skills with search and source type filter.
result: pass

### 10. Department Skills Panel
expected: Navigate to the departments page (/businesses/[id]/departments). Each department section includes a "Department Skills" panel with a description like "Skills assigned here are inherited by all agents in {department name}." The panel has an "Add Skill" button to assign skills at the department level.
result: pass

## Summary

total: 10
passed: 9
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "GitHub import scans subdirectories recursively and groups imported skills under repo name"
  status: resolved
  reason: "User reported: Works for root-level .md files but doesn't recurse into subdirectories. Want it to scan all subfolders and group imported skills under the repo name as a collection in the library."
  severity: minor
  test: 8
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
