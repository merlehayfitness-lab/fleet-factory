---
status: complete
phase: 13-secrets-management-ux
source: 13-01-SUMMARY.md, 13-02-SUMMARY.md, 13-03-SUMMARY.md
started: 2026-03-30T12:00:00Z
updated: 2026-03-30T12:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Settings Link in Sidebar
expected: Sidebar navigation includes a "Settings" link. Clicking it navigates to /businesses/[id]/settings.
result: issue
reported: "Settings page crashed with: column secrets.provider does not exist"
severity: blocker

### 2. Settings Page Layout
expected: Settings page shows two sections: "Emergency Controls" (with disable/restore tenant buttons) and "Secrets & Credentials" (provider-grouped secrets manager).
result: pass

### 3. Provider-Grouped Credential Cards
expected: Secrets section displays collapsible cards grouped by provider (e.g., HubSpot, Salesforce, Slack). Each card shows the provider name/logo and can be expanded/collapsed by clicking the header.
result: pass

### 4. Dynamic Credential Form
expected: Expanding a provider card reveals a form with input fields specific to that provider (e.g., HubSpot shows API Key field, Slack shows Bot Token and Signing Secret). Fields are driven by DB definitions.
result: pass

### 5. Save Provider Credentials
expected: Fill in credential fields for a provider and click Save. Credentials persist — collapsing and re-expanding the card (or refreshing the page) shows masked values for saved fields.
result: pass

### 6. Eye Toggle Reveal
expected: For a saved credential, clicking the eye icon reveals the actual decrypted value. After ~5 seconds, the value automatically re-masks itself.
result: pass

### 7. Test Connection
expected: After saving credentials for a provider, clicking "Test Connection" shows a success/result message (mock for now).
result: pass

### 8. Delete Provider Credentials
expected: Clicking delete on a provider card removes all stored credentials for that provider. The card returns to empty/unconfigured state.
result: pass

### 9. Configure Button on Integration Cards
expected: On the Integrations page (/businesses/[id]/integrations), each integration card shows a "Configure" button. Clicking it opens a side drawer from the right.
result: pass

### 10. Credential Side Drawer
expected: The side drawer shows the provider name/description and a dynamic credential form. Filling in fields and clicking Save stores the credentials and auto-activates the integration.
result: issue
reported: "ENCRYPTION_KEY environment variable is not set error when saving credentials"
severity: minor

## Summary

total: 10
passed: 8
issues: 2
pending: 0
skipped: 0

## Gaps

- truth: "Settings page loads without errors"
  status: fixed
  reason: "User reported: Settings page crashed with column secrets.provider does not exist"
  severity: blocker
  test: 1
  root_cause: "Migrations 039 and 040 were written but never applied to Supabase cloud database"
  artifacts:
    - path: "packages/db/schema/039_provider_credential_fields.sql"
      issue: "Not applied to Supabase"
    - path: "packages/db/schema/040_secrets_provider_column.sql"
      issue: "Not applied to Supabase"
  missing:
    - "Run migrations in Supabase SQL Editor"
  debug_session: ""

- truth: "Saving credentials stores them encrypted"
  status: fixed
  reason: "User reported: ENCRYPTION_KEY environment variable is not set error when saving credentials"
  severity: minor
  test: 10
  root_cause: "ENCRYPTION_KEY not present in apps/web/.env.local"
  artifacts:
    - path: "apps/web/.env.local"
      issue: "Missing ENCRYPTION_KEY environment variable"
  missing:
    - "Add ENCRYPTION_KEY to .env.local"
  debug_session: ""
