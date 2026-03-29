# Phase 13: Secrets Management UX - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Overhaul the secrets management UX to be integration-first. Picking an integration determines what credential fields appear. Secrets grouped by provider, editable in place, accessible from a new Settings page and from the Integrations page via side drawer. Currently secrets are disconnected from integrations, use flat generic fields, and are buried under Deployments.

</domain>

<decisions>
## Implementation Decisions

### Integration-first flow
- Credentials can be added from TWO entry points: Integrations page (side drawer) and the Secrets page (standalone)
- From Integrations page: clicking "Configure" on an integration opens a side drawer with the credential form
- From Secrets page: user picks a provider from the full catalog of supported providers (all providers, not just configured ones)
- Saving credentials auto-creates the integration record if one doesn't exist yet (no separate step needed)
- The existing Settings gear dropdown on Overview page becomes a full Settings page with sections: Emergency Controls, Secrets, and future settings
- Settings page accessible from BOTH sidebar nav AND gear icon on Overview page

### Dynamic credential fields
- Provider field definitions stored in database (not hardcoded TypeScript constants) so they can be updated without code changes
- Support full variety of field types: API key, client_id/secret pair, username/password, OAuth token+refresh, instance URL, webhook URL — whatever each provider actually needs
- All fields shown for a provider are required (no optional fields) — if it's shown, it must be filled
- "Test Connection" button after credentials are saved to verify they work by pinging the provider API

### Secrets page layout
- Secrets grouped by integration/provider (e.g., "Salesforce", "Slack", "SendGrid") — not by category
- Each provider shows as a collapsed card with provider name and connection status badge — click to expand and see fields
- Only configured providers shown (providers with at least one credential saved)
- No "Add Integration" button on Secrets page — adding new providers is done from the Integrations page
- Secrets page lives on the new Settings page (alongside Emergency Controls)

### Edit & rotation UX
- Edit in place: click on a credential field, enter new value, save — replaces the encrypted value
- Reveal on click: eye toggle decrypts and shows the actual value for a few seconds, then re-masks
- Show last updated date but no staleness warnings (keep it simple)
- Deleting a provider's credentials deactivates its integration record (sets to inactive/mock)

### Claude's Discretion
- Database schema for provider field definitions table
- Exact provider catalog (which providers and what fields each needs)
- How the "Test Connection" button works per provider (mock vs real API ping)
- Settings page section layout and routing structure
- How the eye toggle auto-re-masks after reveal (timeout duration)

</decisions>

<specifics>
## Specific Ideas

- The flow from Integrations page should feel seamless: click Configure → drawer opens → fill credentials → save → integration activated. No page navigation.
- Settings page replaces the current gear dropdown — Emergency Controls become a section on that page, not a dropdown menu
- Provider field definitions in the DB means we can add new providers without deploying code — just insert rows
- Current secrets schema needs `provider` field and potentially FK to integrations table to link them properly

</specifics>

<deferred>
## Deferred Ideas

- OAuth flow (redirect to provider, receive token) — too complex for this phase, just store tokens manually for now
- Secret expiration/rotation reminders — future enhancement
- Audit log of secret access/changes — covered by existing audit_logs

</deferred>

---

*Phase: 13-secrets-management-ux*
*Context gathered: 2026-03-29*
