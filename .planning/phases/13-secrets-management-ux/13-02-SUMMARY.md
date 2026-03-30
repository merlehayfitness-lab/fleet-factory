---
phase: 13-secrets-management-ux
plan: 02
subsystem: ui
tags: [settings-page, secrets, provider-credentials, collapsible-cards, eye-toggle, edit-in-place, shadcn-ui]

# Dependency graph
requires:
  - phase: 13-secrets-management-ux
    provides: "provider_credential_fields table, secrets.provider column, provider-scoped CRUD service, server actions"
  - phase: 12-integrations-catalog-setup
    provides: "INTEGRATION_CATALOG with 15 providers for display names and logos"
provides:
  - "Settings page at /businesses/[id]/settings with Emergency Controls and Secrets sections"
  - "Provider-grouped SecretsManager with collapsible ProviderSecretsCard components"
  - "CredentialForm with dynamic inputs from provider_credential_fields DB data"
  - "Eye toggle with 5-second auto-re-mask and server-side decryption"
  - "Edit-in-place, test connection, and delete-all-credentials actions"
  - "Settings link in sidebar nav and gear icon on Overview page"
affects: [13-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: [provider-grouped collapsible credentials UI, eye-toggle with timed auto-re-mask, dynamic form from DB field definitions]

key-files:
  created:
    - apps/web/_components/settings-page.tsx
    - apps/web/_components/provider-secrets-card.tsx
    - apps/web/_components/credential-form.tsx
    - apps/web/app/(dashboard)/businesses/[id]/settings/page.tsx
  modified:
    - apps/web/_components/secrets-manager.tsx
    - apps/web/_components/sidebar-nav.tsx
    - apps/web/_components/health-dashboard.tsx
    - apps/web/app/(dashboard)/businesses/[id]/settings/secrets/page.tsx

key-decisions:
  - "Task 1 files already committed in prior 13-03 work (837ca0c) -- no duplicate commit created, Task 2 committed separately"
  - "Eye toggle uses 5-second setTimeout with client-side cache to avoid repeated server decryption calls"
  - "CredentialForm tracks modified fields via local Set state and only sends changed values on edit"
  - "Legacy secrets (null provider) rendered in flat list at bottom, separate from provider cards"

patterns-established:
  - "Collapsible provider card pattern: CardHeader as trigger, CardContent as panel with credential form and action buttons"
  - "Timed reveal pattern: server-side decrypt -> client cache -> setTimeout auto-re-mask"
  - "Dynamic form from DB field definitions: CredentialField[] drives Input rendering with type mapping"

requirements-completed: [SECR-ENH-02, SECR-ENH-04]

# Metrics
duration: 7min
completed: 2026-03-29
---

# Phase 13 Plan 02: Settings Page & Provider-Grouped Secrets UI Summary

**Settings page with emergency controls and provider-grouped collapsible credential cards featuring eye toggle reveal, edit-in-place, test connection, and dynamic forms from DB field definitions**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-30T01:37:52Z
- **Completed:** 2026-03-30T01:45:38Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Created Settings page at /businesses/[id]/settings with two sections: Emergency Controls (tenant disable/restore) and Secrets & Credentials (provider-grouped manager)
- Built ProviderSecretsCard with Collapsible pattern, eye toggle (5-second auto-re-mask via setTimeout), test connection, save changes, and delete-all-credentials functionality
- Built CredentialForm driven dynamically by provider_credential_fields DB data with edit-in-place tracking
- Overhauled SecretsManager from flat category-based listing to provider-grouped collapsible cards with legacy section
- Updated sidebar nav with Settings link and replaced Overview gear dropdown with simple navigation link to /settings
- Redirected /settings/secrets to /settings#secrets for backward compatibility

## Task Commits

Each task was committed atomically:

1. **Task 1: Settings page with Emergency Controls section and navigation updates** - `837ca0c` (feat, pre-existing commit from prior execution)
2. **Task 2: Provider-grouped secrets manager with collapsible cards, eye toggle, and credential form** - `8a9203d` (feat)

## Files Created/Modified
- `apps/web/app/(dashboard)/businesses/[id]/settings/page.tsx` - Settings page Server Component with auth, business fetch, grouped secrets, and field definitions
- `apps/web/_components/settings-page.tsx` - Client component with Emergency Controls (disable/restore) and Secrets sections
- `apps/web/_components/secrets-manager.tsx` - Overhauled to render provider-grouped ProviderSecretsCards with legacy section
- `apps/web/_components/provider-secrets-card.tsx` - Collapsible card with eye toggle, test connection, delete all, save changes
- `apps/web/_components/credential-form.tsx` - Dynamic form driven by provider field definitions with edit tracking
- `apps/web/_components/sidebar-nav.tsx` - Added Settings link between Knowledge Base and Logs
- `apps/web/_components/health-dashboard.tsx` - Replaced DropdownMenu with simple Link to /settings, removed emergency control state/handlers
- `apps/web/app/(dashboard)/businesses/[id]/settings/secrets/page.tsx` - Redirect to /settings#secrets

## Decisions Made
- Task 1 work was already committed in 837ca0c (part of prior 13-03 execution) -- verified files match and no duplicate commit created
- Eye toggle uses 5-second auto-re-mask with client-side cache during reveal window to avoid redundant server round-trips
- CredentialForm uses a local Set to track which fields were modified, only sending changed values on save (efficient for partial updates)
- Legacy secrets (provider = null) displayed in flat list at bottom, separate from provider-grouped collapsible cards

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 1 already committed in prior work**
- **Found during:** Task 1 (Settings page and navigation)
- **Issue:** All Task 1 files (settings page, sidebar nav, health dashboard, secrets redirect) were already committed in 837ca0c as part of earlier 13-03 execution
- **Fix:** Verified working tree matches HEAD for all Task 1 files; skipped duplicate commit; proceeded to Task 2
- **Files modified:** None (already in git)
- **Verification:** `git diff HEAD` showed no changes for Task 1 files

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** No scope change. Task 1 was already complete; Task 2 executed as planned.

## Issues Encountered
- Pre-existing 13-03 commits included Task 1 work (settings page, sidebar nav, health dashboard) -- detected by empty git diff and handled by documenting the existing commit

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Settings page fully functional with Emergency Controls and Secrets sections
- Provider-grouped secrets UI ready for use via Settings page
- Credential side drawer (13-03) can link to Settings page for full credential management
- All server actions from 13-01 now consumed by the frontend

## Self-Check: PASSED

All files verified present. All commits verified in git log.

---
*Phase: 13-secrets-management-ux*
*Completed: 2026-03-29*
