---
status: diagnosed
phase: 03-deployment-pipeline
source: 03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md, 03-04-SUMMARY.md
started: 2026-03-25T23:10:00Z
updated: 2026-03-26T05:06:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Deployments Sidebar Link
expected: Sidebar nav shows a "Deployments" link. Clicking it navigates to /businesses/[id]/deployments.
result: pass

### 2. Deployment Center Layout
expected: Deployment center page shows a split-view layout — deployment list on the left (~1/3 width) and deployment detail on the right (~2/3 width).
result: pass

### 3. Trigger a Deployment
expected: A deploy button is visible. For a first deploy it should be one-click. Clicking it triggers a deployment and the deployment appears in the list with a status.
result: issue
reported: "looks right, i hit deploy and got that error - Failed to fetch integrations: Could not find the table 'public.integrations' in the schema cache"
severity: blocker

### 4. Deployment Stepper Progress
expected: Selecting a deployment shows a horizontal 4-step progress indicator (Queued → Building → Deploying → Live). The current stage is highlighted.
result: pass

### 5. Deployment Artifacts
expected: Deployment detail shows generated config artifacts (tenant-config.json, docker-compose.yml, .env, agent-runtime configs) viewable as code blocks.
result: issue
reported: "no artifacts visible — deployment stuck at queued because deploy failed before generating them"
severity: blocker

### 6. Rollback Dialog
expected: A rollback option is available on a deployment. Clicking it opens a dialog showing available versions to roll back to.
result: skipped
reason: Cannot test without a successful deployment to roll back to

### 7. Secrets Management Page
expected: Navigating to Settings > Secrets (or /businesses/[id]/settings/secrets) shows a categorized secret management page with an add form and masked values.
result: pass

### 8. Integrations Sidebar Link
expected: Sidebar nav shows an "Integrations" link with a plug icon. Clicking it navigates to /businesses/[id]/integrations.
result: pass

### 9. Business Integrations Overview
expected: Integrations overview page shows summary stats (configured count, types) and cards grouped by integration type (CRM, Email, Helpdesk, Calendar, Messaging).
result: pass

### 10. Agent Integrations Tab
expected: On an agent detail page, an "Integrations" tab exists. Clicking it shows 5 integration type sections with provider dropdowns and status badges.
result: issue
reported: "seeing the tab with all 5 types, when I hit add mock nothing happens and nothing shows up on integrations page after"
severity: major

### 11. Business Overview Quick Links
expected: Business overview page shows quick-link cards for both Deployments and Integrations that navigate to the correct pages.
result: pass

## Summary

total: 11
passed: 7
issues: 3
pending: 0
skipped: 1

## Gaps

- truth: "Deploy button triggers a deployment successfully"
  status: failed
  reason: "User reported: Failed to fetch integrations: Could not find the table 'public.integrations' in the schema cache"
  severity: blocker
  test: 3
  root_cause: "DB migrations 013, 014, 015 not applied to Supabase. integrations table does not exist. triggerDeployment fetches integrations at service.ts:82 and throws."
  artifacts:
    - path: "packages/core/deployment/service.ts"
      issue: "Line 82-88 queries integrations table that doesn't exist"
    - path: "packages/db/schema/014_integrations_table.sql"
      issue: "Migration not applied to Supabase"
  missing:
    - "Apply migrations 013, 014, 015 to Supabase (or re-run _combined_schema.sql)"

- truth: "Deployment detail shows generated config artifacts viewable as code blocks"
  status: failed
  reason: "User reported: no artifacts visible — deployment stuck at queued because deploy failed before generating them"
  severity: blocker
  test: 5
  root_cause: "Downstream of Test 3. Deploy fails before reaching artifact generation (service.ts:244-265). Also triggered_by column from 015 migration missing, which may cause insert failure."
  artifacts:
    - path: "packages/core/deployment/service.ts"
      issue: "Artifacts generated at lines 244-265, never reached due to earlier failure"
    - path: "packages/db/schema/015_deployments_columns.sql"
      issue: "triggered_by column not applied, deployment insert may also fail"
  missing:
    - "Apply migrations 014 + 015 to Supabase to unblock the full deploy pipeline"

- truth: "Add Mock button on agent Integrations tab creates a mock integration"
  status: failed
  reason: "User reported: when I hit add mock nothing happens and nothing shows up on integrations page after"
  severity: major
  test: 10
  root_cause: "Three compounding issues: (A) integrations table missing — upsert fails silently, (B) handleAddMock discards server action return value — no error shown to user, (C) no UNIQUE constraint on (business_id, agent_id, type) — upsert ON CONFLICT will fail even after table exists, (D) no router.refresh() after success — UI never re-renders with new data"
  artifacts:
    - path: "apps/web/_components/agent-integrations.tsx"
      issue: "handleAddMock at lines 172-177 discards return value, no error handling, no router.refresh()"
    - path: "apps/web/_actions/integration-actions.ts"
      issue: "upsert uses onConflict without backing UNIQUE constraint"
    - path: "packages/db/schema/014_integrations_table.sql"
      issue: "No UNIQUE index on (business_id, agent_id, type) for upsert"
  missing:
    - "Apply migration 014 to create integrations table"
    - "Add UNIQUE index on (business_id, agent_id, type) to 014 migration and _combined_schema.sql"
    - "Fix handleAddMock/handleSave/handleDelete to check return value and call router.refresh()"
