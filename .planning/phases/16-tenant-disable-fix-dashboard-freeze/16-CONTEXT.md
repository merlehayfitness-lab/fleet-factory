# Phase 16: Tenant Disable Fix & Dashboard Freeze - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the current behavior where disabling a tenant via emergency controls causes 404 errors. Instead, show a frozen dashboard with a "Suspended" banner, stop VPS containers, block all mutation actions, and allow read-only access to all pages. The business layout needs a status check, all Server Actions need mutation guards, and the VPS needs container stop/resume lifecycle calls.

</domain>

<decisions>
## Implementation Decisions

### Suspended Banner UX
- Sticky top bar that pushes content down (NOT an overlay or full-page block)
- Banner appears at the top of the dashboard content area, below the nav
- Banner text shows business name and explains the frozen state
- "Restore" button included directly in the banner for one-click access
- Banner visible on every sub-page (rendered in the layout)
- The Settings gear dropdown also keeps the Restore option (existing behavior stays)

### Disabled Button Treatment
- All mutation buttons (Deploy, Create Task, Approve, Chat input, etc.) are visually greyed out with `opacity`, `cursor-not-allowed`
- Hover shows a tooltip: "Business is suspended"
- No click action fires — buttons are truly disabled, not toast-on-click
- Read-only content (tables, logs, history) remains fully interactive (scrollable, searchable, filterable)

### Navigation
- All sidebar links remain fully navigable when disabled
- Every sub-page loads normally in read-only mode with the suspended banner
- No sidebar links are hidden or greyed out
- Admin can review all data across all pages

### VPS Container Behavior
- **On disable:** Stop containers (full shutdown, frees resources). NOT pause (which keeps memory allocated)
- **VPS unreachable:** Disable still succeeds in the database. Show a persistent warning badge on the dashboard: "VPS containers may still be running." Admin can retry VPS stop later
- **On restore:** Auto-resume (restart) containers on VPS. If containers were fully deleted, the resume fails gracefully and admin can redeploy
- VPS pause/resume is best-effort — the database status is the authoritative source of truth

### Read-Only Scope & Exceptions
- **Only allowed write action when disabled:** Restore Tenant (and the emergency restore-agent actions that already exist)
- **Log export/download:** Allowed even when disabled (server-side processing for export is not blocked)
- **Everything else blocked:** Deploy, redeploy, rollback, create tasks, approve/reject, chat messages, agent config changes, secret management, skill editing, knowledge upload, integration changes
- The `requireActiveBusiness()` guard goes in every mutation Server Action. Emergency restore actions are explicitly exempt

### Chat Page Behavior
- Show full conversation history (read-only, scrollable)
- Message input is disabled with placeholder text: "Business is suspended"
- No new messages can be sent

### Deployment Page Behavior
- Full deployment history visible with all past versions
- Current status shows "Suspended" badge
- Deploy / Redeploy / Rollback buttons greyed out with tooltip

### Status Semantics
- Both `suspended` and `disabled` statuses trigger the same frozen dashboard behavior
- The banner text reflects the actual status ("Suspended" vs "Disabled") but behavior is identical
- Continue using `disabled` for the emergency kill switch
- `suspended` reserved for future billing-related suspension (same UX when it arrives)
- The UI checks `status === 'disabled' || status === 'suspended'` everywhere

### Restore Flow
- Restoring re-enables the dashboard and sends VPS resume command
- Agents remain frozen after restore — admin must manually review and unfreeze each agent
- This matches existing `restoreTenant()` behavior (already keeps agents frozen)
- Restore requires a simple confirm dialog ("Are you sure?") — NOT type-to-confirm
- Restore button in the banner triggers the confirm dialog

### Claude's Discretion
- Exact banner styling (colors, icon choice, spacing)
- Tooltip implementation approach (native title vs custom tooltip component)
- How the VPS warning badge appears (banner sub-text vs separate badge)
- Whether `requireActiveBusiness()` lives in `_lib/` or `_actions/` directory
- How to handle the greyed-out state across different component types (buttons, forms, inputs)

</decisions>

<specifics>
## Specific Ideas

- The layout is the single enforcement point — fetch `business.status` in `[id]/layout.tsx`, provide via React Context, render banner conditionally
- Use `useBusinessStatus()` hook in client components to check `isDisabled` and disable mutation UI
- Server Components in pages can re-fetch business status (React request deduplication handles efficiency)
- The health dashboard already has `isDisabled` logic — extend it rather than duplicate
- Deployment service already blocks deploys for disabled businesses — this phase adds the UI and action-layer guards

</specifics>

<deferred>
## Deferred Ideas

- OAuth-based billing suspension flow (would use the `suspended` status) — future billing phase
- Automatic disable on billing failure — requires Stripe integration (Phase v2)
- Admin notification/email when tenant is disabled — could be added later to audit log system
- Scheduled auto-restore after N days — too complex for this phase, manual restore only
- Per-agent selective restore dialog on tenant restore — keep it simple with manual agent unfreeze

</deferred>

---

*Phase: 16-tenant-disable-fix-dashboard-freeze*
*Context gathered: 2026-03-30*
