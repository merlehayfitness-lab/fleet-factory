---
phase: 16-tenant-disable-fix-dashboard-freeze
verified: 2026-03-30T18:00:00Z
status: gaps_found
score: 11/12 must-haves verified
re_verification: false
gaps:
  - truth: "Health dashboard displays a VPS warning indicator when VPS container stop failed during disable"
    status: failed
    reason: "Action name mismatch: emergency-service.ts writes action='emergency.tenant_disabled' but page.tsx queries action='tenant_disabled'. The audit log entry is never found, so vpsWarning is always null and the indicator never renders."
    artifacts:
      - path: "apps/web/app/(dashboard)/businesses/[id]/page.tsx"
        issue: ".eq(\"action\", \"tenant_disabled\") on line 45 does not match the actual stored action string \"emergency.tenant_disabled\""
    missing:
      - "Change line 45 of page.tsx: .eq(\"action\", \"emergency.tenant_disabled\") to match the string written by emergency-service.ts"
human_verification:
  - test: "Disable a tenant and confirm the SuspendedBanner appears on every sub-page instead of a 404"
    expected: "Dashboard loads showing the frozen state with red sticky banner at the top of each page"
    why_human: "Requires a live Supabase session and a real business record to exercise the disabled status flow end-to-end"
  - test: "With a disabled business, attempt to deploy, create a task, and send a chat message via the UI"
    expected: "All action buttons are visually disabled with 'Business is suspended' tooltip; Server Actions return error messages; no writes occur"
    why_human: "Requires browser interaction to verify disabled states and tooltip text"
  - test: "Click the Restore button in the SuspendedBanner and complete the inline confirm flow"
    expected: "Business status changes back to active, banner disappears, and page refreshes to the active dashboard"
    why_human: "Requires live session and browser interaction to verify the restore flow and page refresh"
---

# Phase 16: Tenant Disable Fix — Dashboard Freeze Verification Report

**Phase Goal:** Fix tenant disable to show a frozen dashboard with suspended banner instead of 404, add VPS container lifecycle management, enforce read-only mode via Server Action guards and UI disabling, surface VPS warning indicators.
**Verified:** 2026-03-30
**Status:** gaps_found — 1 gap blocking TFIX-02 full delivery
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | pauseTenantContainers and resumeTenantContainers functions exist in packages/core/vps/vps-lifecycle.ts | VERIFIED | File exists; both functions exported, both wrap VPS calls in try/catch and return `{ success, stoppedCount/resumedCount, error }` objects, never throw |
| 2  | VPS pause/resume are best-effort — failures are caught and do not block tenant disable/restore | VERIFIED | Both functions return `{ success: false, error: "VPS unreachable" }` on catch rather than throwing; no-op path when `!isVpsConfigured()` |
| 3  | disableTenant in emergency-service.ts calls pauseTenantContainers after freezing agents | VERIFIED | Step 5 in disableTenant fetches business slug and calls `pauseTenantContainers(businessId, biz.slug)` with full best-effort wrapping |
| 4  | restoreTenant in emergency-service.ts calls resumeTenantContainers after setting status to active | VERIFIED | Step 3 in restoreTenant fetches business slug and calls `resumeTenantContainers(businessId, biz.slug)` with full best-effort wrapping |
| 5  | requireActiveBusiness guard function exists in apps/web/_lib/require-active-business.ts | VERIFIED | File exists; function queries `businesses.status`, returns `{ error: string }` for disabled/suspended, returns null for active |
| 6  | requireActiveBusiness checks for both 'disabled' and 'suspended' business statuses | VERIFIED | `if (business.status === "disabled" \|\| business.status === "suspended")` on line 29 |
| 7  | BusinessStatusProvider React Context exists with isDisabled boolean and status string | VERIFIED | `business-status-provider.tsx` exports `BusinessStatusProvider` with `isDisabled = status === "disabled" \|\| status === "suspended"` and `useBusinessStatus` hook |
| 8  | useBusinessStatus hook is exported from the provider module | VERIFIED | `export function useBusinessStatus()` on line 43 |
| 9  | SuspendedBanner component renders a sticky banner with business name and read-only explanation | VERIFIED | `sticky top-0 z-40` div with ShieldAlert icon, `{businessName} is {statusLabel}. The dashboard is in read-only mode...` text |
| 10 | SuspendedBanner includes a Restore button that calls restoreTenantAction with a confirm dialog | VERIFIED | Inline confirm/cancel state; `handleRestore` calls `restoreTenantAction(businessId)` and `router.refresh()` on success |
| 11 | Business [id] layout fetches business status, wraps children in BusinessStatusProvider, and renders SuspendedBanner when disabled | VERIFIED | `layout.tsx` selects `id, name, status`; renders `<BusinessStatusProvider>` wrapping children; conditionally renders `<SuspendedBanner>` when `isDisabled` |
| 12 | Layout no longer returns notFound() for disabled businesses — it renders the frozen dashboard instead | VERIFIED | `notFound()` is only called when `error \|\| !business` — a disabled business still returns data from Supabase so will not 404 |
| 13 | Every mutation Server Action calls requireActiveBusiness before writes | VERIFIED | 11 action files confirmed containing the import and guard call pattern; emergency-actions.ts confirmed clean |
| 14 | Emergency restore actions are EXEMPT from the guard | VERIFIED | `emergency-actions.ts` has zero matches for `requireActiveBusiness` |
| 15 | Deploy/Redeploy/Rollback buttons are disabled with tooltip when business is disabled | VERIFIED | `deploy-button.tsx`: `disabled={isDisabled \|\| isDeploying}` + `title={isDisabled ? "Business is suspended" : undefined}` + `opacity-50 cursor-not-allowed` className |
| 16 | Chat message input is disabled with placeholder 'Business is suspended' when disabled | VERIFIED | `chat-layout.tsx` SlackChatUI: `disabled={isDisabled \|\| isAgentFrozen}` + `disabledReason={isDisabled ? "Business is suspended" : ...}` passed to ChatMessageInput |
| 17 | Health dashboard shows the disabled status correctly via StatusBadge | VERIFIED | `health-dashboard.tsx` renders `<StatusBadge status={business.status} />` in the page header |
| 18 | Health dashboard displays a VPS warning indicator when VPS container stop failed during disable | FAILED | The `vpsWarning` prop infrastructure is wired correctly (page.tsx -> HealthDashboard -> render block), but the audit log query uses `action = "tenant_disabled"` while the emergency service writes `action = "emergency.tenant_disabled"`. The query returns null every time; vpsWarning is always null. |
| 19 | Read-only content remains fully interactive | VERIFIED | Chat history polling continues; deployment lists remain; quick links are plain Link elements with no disabled treatment; logs/tables unaffected |
| 20 | useBusinessStatus hook used by client components to check isDisabled | VERIFIED | deploy-button.tsx, deployment-center.tsx, chat-layout.tsx (SlackChatUI), agent-tree-node.tsx, new-task-form.tsx all import and consume useBusinessStatus |

**Score:** 11/12 automated truths verified (1 failed: VPS warning indicator due to action name mismatch)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/core/vps/vps-lifecycle.ts` | VPS container pause/resume functions | VERIFIED | 67 lines; exports `pauseTenantContainers` and `resumeTenantContainers`; fully substantive, no stubs |
| `apps/web/_lib/require-active-business.ts` | Server Action guard blocking disabled/suspended mutations | VERIFIED | 37 lines; correct logic; wired into 11 action files |
| `apps/web/_components/business-status-provider.tsx` | React Context with useBusinessStatus hook | VERIFIED | 45 lines; exports `BusinessStatusProvider` and `useBusinessStatus`; wired into layout and 5 client components |
| `apps/web/_components/suspended-banner.tsx` | Sticky banner with restore button and confirm dialog | VERIFIED | 84 lines; fully functional; wired into business layout |
| `packages/core/emergency/emergency-service.ts` | Extended disableTenant/restoreTenant with VPS calls | VERIFIED | VPS calls at steps 5 (disable) and 3 (restore); best-effort wrapping; vps_warning in audit metadata |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `emergency-service.ts` | `vps/vps-lifecycle.ts` | `import { pauseTenantContainers, resumeTenantContainers }` | WIRED | Line 14; both called in disableTenant (step 5) and restoreTenant (step 3) |
| `packages/core/server.ts` | `vps/vps-lifecycle.ts` | Re-export | WIRED | Line 121: `export { pauseTenantContainers, resumeTenantContainers } from "./vps/vps-lifecycle"` |
| `suspended-banner.tsx` | `emergency-actions.ts` | `restoreTenantAction` call | WIRED | Import on line 5; called inside `handleRestore` async function |
| `business/[id]/layout.tsx` | `business-status-provider.tsx` | `BusinessStatusProvider` wrapping children | WIRED | Lines 38-51; `<BusinessStatusProvider status=... businessId=... businessName=...>` |
| `business/[id]/layout.tsx` | `suspended-banner.tsx` | Conditional `SuspendedBanner` render | WIRED | Lines 43-50; rendered when `isDisabled` |
| `deploy-button.tsx` | `business-status-provider.tsx` | `useBusinessStatus` hook | WIRED | Line 18 import; line 36 `const { isDisabled } = useBusinessStatus()` |
| `chat-layout.tsx` | `business-status-provider.tsx` | `useBusinessStatus` hook | WIRED | Line 11 import; line 103 `const { isDisabled } = useBusinessStatus()` |
| `health-dashboard.tsx` | `emergency-service.ts` vps_warning metadata | `vpsWarning` prop from page.tsx audit log query | BROKEN | `page.tsx` queries `.eq("action", "tenant_disabled")` but service writes `"emergency.tenant_disabled"` — query always returns null |

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TFIX-01 | 16-01, 16-03 | Disabled tenant shows frozen dashboard with "Suspended" banner instead of 404 | SATISFIED | Layout selects status and renders SuspendedBanner; notFound() only fires when business truly missing; banner is sticky at top of every sub-page |
| TFIX-02 | 16-01, 16-03 | Disabling tenant stops all VPS activity (pause containers, halt deployments) | PARTIAL | VPS pause/resume lifecycle is implemented and called from emergency service. However, the VPS warning surfacing is broken (action name mismatch prevents vpsWarning from ever being non-null on the dashboard) |
| TFIX-03 | 16-01, 16-02, 16-03 | Admin panel blocks interaction with VPS when tenant disabled | SATISFIED | requireActiveBusiness guard in 11 mutation action files; deploy button, retry/rollback, chat send, task create, agent create, approvals all disabled |
| TFIX-04 | 16-01, 16-02, 16-03 | Admin can still view business in read-only frozen state | SATISFIED | Layout renders dashboard (not 404); chat history, logs, deployment history, agent views remain fully navigable; all read-only actions unguarded |

Note: REQUIREMENTS.md tracking table still shows TFIX-01 through TFIX-04 as "Not started" — this is a documentation gap only and does not reflect the actual code state.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/app/(dashboard)/businesses/[id]/page.tsx` | 45 | `.eq("action", "tenant_disabled")` — wrong action string | Blocker | VPS warning indicator never appears; TFIX-02 "surfacing" is non-functional |

---

### Human Verification Required

#### 1. Frozen Dashboard End-to-End

**Test:** Set a business's status to `'disabled'` in Supabase, then navigate to `/businesses/{id}` in the browser.
**Expected:** The page loads (no 404), the red SuspendedBanner appears at the top of every sub-page (/agents, /deployments, /tasks, /chat, /logs), and all mutation buttons show disabled state with tooltip.
**Why human:** Requires a live Supabase session and browser to exercise the actual layout render path.

#### 2. Mutation Controls Disabled With Tooltip

**Test:** With a disabled business, hover over the Deploy button, attempt to send a chat message, and try to create a new task.
**Expected:** Buttons are greyed out with `title="Business is suspended"` tooltip text; no actions succeed; Server Actions return error responses.
**Why human:** Browser interaction required to verify native `title` tooltip rendering and button visual states.

#### 3. Restore Flow

**Test:** Click "Restore" in the SuspendedBanner, then click "Confirm" in the inline confirmation.
**Expected:** Business status returns to active, banner disappears, page refreshes to the active dashboard.
**Why human:** Requires browser interaction and a live database write to verify the full round-trip.

---

### Gaps Summary

**1 gap blocks full TFIX-02 delivery.**

The VPS warning indicator infrastructure is completely built: `disableTenant` stores `vps_warning: "VPS containers may still be running"` in the audit log metadata when `vpsStoppedCount === 0`, `page.tsx` queries for the latest disable audit log and extracts that field, and `HealthDashboard` renders an amber warning badge when `vpsWarning` is truthy.

However, there is a one-word mismatch: the audit log entry is stored with `action: "emergency.tenant_disabled"` (line 347 of `emergency-service.ts`) but `page.tsx` queries `.eq("action", "tenant_disabled")` (line 45). The query returns zero rows, `lastDisableLog` is null, and `vpsWarning` is always null. The warning badge never renders.

**Fix:** Change line 45 of `apps/web/app/(dashboard)/businesses/[id]/page.tsx` from:
```typescript
.eq("action", "tenant_disabled")
```
to:
```typescript
.eq("action", "emergency.tenant_disabled")
```

This is a 1-character fix (prefix `"emergency."`) that unblocks the full TFIX-02 VPS warning surface.

All other phase goals (TFIX-01, TFIX-03, TFIX-04) are fully verified and working. The core frozen dashboard behavior, Server Action guards, UI disabled states, and restore flow are all substantively implemented and properly wired.

---

_Verified: 2026-03-30_
_Verifier: Claude (gsd-verifier)_
