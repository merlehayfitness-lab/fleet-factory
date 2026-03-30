# Phase 16: Tenant Disable Fix & Dashboard Freeze - Research

**Researched:** 2026-03-29
**Domain:** Multi-tenant suspension, read-only dashboard state, VPS container lifecycle
**Confidence:** HIGH

## Summary

This phase fixes a concrete bug: disabling a tenant via the emergency controls currently causes a 404 because the business layout (`layout.tsx`) calls `notFound()` when it can't find the business or the business query fails, and downstream pages also call `notFound()` without checking business status. The fix requires: (1) the layout to check business status and render a frozen/suspended UI wrapper instead of 404, (2) all Server Actions to refuse mutations when the business is disabled, (3) a new VPS endpoint to pause/stop containers, and (4) a "Suspended" banner overlay.

The existing codebase has strong foundations: the `disableTenant()` service already sets `status='disabled'` and freezes all agents, the deployment service already blocks deploys for disabled businesses, and the health dashboard already tracks the `isDisabled` flag. What is missing is the UI enforcement layer (layout-level status check, read-only guards on actions, suspended banner) and the VPS container pause/stop capability.

**Primary recommendation:** Enforce disabled state at the layout level by fetching `business.status` in the `[id]/layout.tsx` and passing it via React Context to all child pages. When status is `disabled`, render a frozen overlay banner and block all mutation Server Actions at the action layer with a `requireActiveBusiness()` guard function.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TFIX-01 | Disabled tenant shows frozen dashboard with "Suspended" banner instead of 404 | Layout-level status check pattern + BusinessStatusContext + SuspendedBanner component |
| TFIX-02 | Disabling tenant stops all VPS activity (pause containers, halt deployments) | New `pauseTenantContainers()` VPS function + deployment guard already exists |
| TFIX-03 | Admin panel blocks interaction with VPS when tenant disabled | `requireActiveBusiness()` guard in all mutation Server Actions + VPS action guards |
| TFIX-04 | Admin can still view business in read-only frozen state | Layout renders children normally (read-only), all mutation UIs disabled via context |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 14+ | Layout-level status enforcement | Already in use; layouts are the natural place for cross-cutting concerns like business status |
| React Context | 19.x | Pass business status to all child components | Cannot pass props from layout to children in App Router; context is the sanctioned workaround |
| Supabase RLS | -- | Data access isolation | Already enforced; disabled check is application-layer on top of RLS |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | 2.x | Toast notifications for blocked actions | Already installed; show "Business is suspended" toasts when users try mutations |
| lucide-react | latest | Suspended banner icons | Already installed; ShieldAlert or Ban icon for the banner |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React Context for status | Middleware-level redirect | Middleware cannot render custom UI; it can only redirect. We need a frozen dashboard, not a redirect to a "suspended" page |
| Per-action guard function | RLS-level enforcement | RLS blocks data access but can't show a friendly UI message. Both layers should be used but the UX comes from the action guard |
| Layout wrapper overlay | Per-page status checks | Per-page is fragile and requires touching 12+ page files. Layout is single point of enforcement |

## Architecture Patterns

### Recommended Implementation Structure
```
packages/core/
  emergency/
    emergency-service.ts     # ADD: pauseTenantContainers(), extend disableTenant()
  vps/
    vps-client.ts            # Existing: vpsPost() for container management
    vps-types.ts             # ADD: VpsContainerAction type

apps/web/
  app/(dashboard)/businesses/[id]/
    layout.tsx               # MODIFY: fetch status, provide context, render banner
  _components/
    suspended-banner.tsx     # NEW: frozen dashboard overlay banner
    business-status-provider.tsx  # NEW: React Context for business status
  _actions/
    *.ts                     # MODIFY: add requireActiveBusiness() guard
  _lib/
    require-active-business.ts   # NEW: shared guard function
```

### Pattern 1: Layout-Level Status Check with Context
**What:** The `[id]/layout.tsx` fetches business status on every request. If disabled, it wraps children in a read-only context provider and renders a "Suspended" banner. Children still render (read-only view) but mutations are blocked at the action layer.
**When to use:** Always -- this is the single enforcement point for the frozen dashboard.
**Example:**
```typescript
// apps/web/app/(dashboard)/businesses/[id]/layout.tsx
import { BusinessStatusProvider } from "@/_components/business-status-provider";
import { SuspendedBanner } from "@/_components/suspended-banner";

export default async function BusinessLayout({ children, params }) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: business, error } = await supabase
    .from("businesses")
    .select("id, name, status")
    .eq("id", id)
    .single();

  if (error || !business) {
    notFound();
  }

  const isDisabled = business.status === "disabled";

  return (
    <BusinessStatusProvider status={business.status} businessId={business.id} businessName={business.name}>
      {isDisabled && <SuspendedBanner businessName={business.name} />}
      {children}
    </BusinessStatusProvider>
  );
}
```

### Pattern 2: Server Action Guard Function
**What:** A shared `requireActiveBusiness()` function that every mutation Server Action calls before performing writes. It checks business status and returns an error response if disabled.
**When to use:** Every Server Action that mutates data for a business (deploy, create task, approve, chat, etc.).
**Example:**
```typescript
// apps/web/_lib/require-active-business.ts
export async function requireActiveBusiness(
  supabase: SupabaseClient,
  businessId: string,
): Promise<{ error: string } | null> {
  const { data: business } = await supabase
    .from("businesses")
    .select("status")
    .eq("id", businessId)
    .single();

  if (!business || business.status === "disabled") {
    return { error: "Business is suspended. No changes can be made until it is restored." };
  }
  return null;
}
```

### Pattern 3: Client-Side Mutation Blocking via Context
**What:** The `useBusinessStatus()` hook lets client components check if the business is disabled and disable buttons/forms accordingly. This provides immediate UX feedback without waiting for server rejection.
**When to use:** Any client component with mutation triggers (deploy buttons, form submits, chat inputs).
**Example:**
```typescript
// apps/web/_components/business-status-provider.tsx
"use client";
import { createContext, useContext } from "react";

interface BusinessStatusContextType {
  status: string;
  isDisabled: boolean;
  businessId: string;
  businessName: string;
}

const BusinessStatusContext = createContext<BusinessStatusContextType>({
  status: "active",
  isDisabled: false,
  businessId: "",
  businessName: "",
});

export function BusinessStatusProvider({ status, businessId, businessName, children }) {
  return (
    <BusinessStatusContext.Provider value={{ status, isDisabled: status === "disabled", businessId, businessName }}>
      {children}
    </BusinessStatusContext.Provider>
  );
}

export function useBusinessStatus() {
  return useContext(BusinessStatusContext);
}
```

### Pattern 4: VPS Container Pause on Tenant Disable
**What:** When `disableTenant()` is called, it also sends a POST to the VPS to pause all containers for that business. A new `pauseTenantContainers()` function calls the VPS REST API.
**When to use:** As part of the existing `disableTenant()` flow in the emergency service.
**Example:**
```typescript
// packages/core/vps/vps-deploy.ts (or new vps-lifecycle.ts)
export async function pauseTenantContainers(
  businessId: string,
  businessSlug: string,
): Promise<{ success: boolean; error?: string }> {
  if (!isVpsConfigured()) {
    return { success: true }; // No VPS, nothing to pause
  }
  return vpsPost<{ success: boolean }>("/api/tenants/pause", {
    businessId,
    businessSlug,
  });
}

export async function resumeTenantContainers(
  businessId: string,
  businessSlug: string,
): Promise<{ success: boolean; error?: string }> {
  if (!isVpsConfigured()) {
    return { success: true };
  }
  return vpsPost<{ success: boolean }>("/api/tenants/resume", {
    businessId,
    businessSlug,
  });
}
```

### Anti-Patterns to Avoid
- **Middleware-level redirect for disabled tenants:** Middleware can only redirect, not render custom UI. We need the dashboard to remain visible with a "Suspended" banner, not redirect to a generic error page.
- **Per-page status checks:** Adding business status checks to each of the 12+ page files is fragile and creates maintenance burden. Use the layout as a single enforcement point.
- **Client-only blocking:** Relying solely on disabling buttons client-side is insecure. Server Actions MUST also reject mutations for disabled businesses.
- **Blocking read operations:** The requirement specifically says "admin can still view the business in read-only frozen state." Never block reads/fetches for disabled businesses.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-component status propagation | Custom prop drilling through 12+ pages | React Context via BusinessStatusProvider | Layout cannot pass props to children in App Router; context is the official pattern |
| Server action mutation guards | Copy-paste status checks in each action | Shared `requireActiveBusiness()` function | Single function, consistent error messages, easy to add to all 18 action files |
| Suspended banner UI | Complex overlay with custom positioning | Simple fixed-top sticky banner component | A persistent banner at the top of the dashboard area is the established SaaS pattern for suspended accounts |
| VPS container pause | Direct Docker API calls from admin | REST API call to VPS proxy that handles Docker internally | The VPS proxy pattern is already established; admin app communicates via REST, proxy manages Docker |

**Key insight:** The hardest part of this phase is not building new features -- it is retrofitting the existing 18 Server Action files and 12+ page routes with consistent status checks. The architecture should minimize the number of touchpoints.

## Common Pitfalls

### Pitfall 1: Layout-Children Data Passing Limitation
**What goes wrong:** Developers try to pass props from layout to children via props. This does not work in Next.js App Router -- children is an opaque React node.
**Why it happens:** The layout evaluates independently from the page. The `children` prop is pre-rendered before the layout wraps it.
**How to avoid:** Use React Context (BusinessStatusProvider) created in the layout and consumed via `useBusinessStatus()` hook in client components. For Server Components within pages, re-fetch business status using React's request deduplication (same Supabase query will be deduped).
**Warning signs:** Trying to use `React.cloneElement(children, { isDisabled })` or similar patterns.

### Pitfall 2: Missing Server-Side Guard (Security Hole)
**What goes wrong:** Client-side buttons are disabled but Server Actions still accept mutations. A user could call the Server Action directly via fetch/curl.
**Why it happens:** Developers focus on the UI layer and forget that Server Actions are public HTTP endpoints.
**How to avoid:** EVERY mutation Server Action must call `requireActiveBusiness()` before performing any write. This is the defense-in-depth layer.
**Warning signs:** Server Actions that skip the business status check.

### Pitfall 3: Blocking the Restore Action
**What goes wrong:** The `requireActiveBusiness()` guard accidentally blocks the "Restore Tenant" action, making it impossible to re-enable a disabled business.
**Why it happens:** Overzealous guard application -- the guard is added to ALL actions including restore/emergency actions.
**How to avoid:** Explicitly exempt `restoreTenantAction` from the guard. The guard should only block non-emergency mutations.
**Warning signs:** Unable to restore a disabled tenant from the dashboard.

### Pitfall 4: VPS Pause Failure Blocking Disable
**What goes wrong:** If the VPS is offline or unreachable, the tenant disable operation fails entirely because it can't pause containers.
**Why it happens:** Synchronous VPS call in the critical path without error handling.
**How to avoid:** VPS container pause should be best-effort. If the VPS is unreachable, still disable the tenant in the database. Log the VPS failure but don't block the disable operation. The deployment guard already prevents new deploys regardless of VPS state.
**Warning signs:** Tenant disable failing with "VPS unreachable" error.

### Pitfall 5: Stale Client State After Disable
**What goes wrong:** Admin has the dashboard open, another admin disables the tenant, but the first admin's UI still shows active state and allows mutation attempts.
**Why it happens:** Client-side state is cached from initial page load. Context value doesn't auto-update.
**How to avoid:** The health dashboard already polls every 30 seconds. After disable, the next poll will return disabled status. For immediate feedback, `router.refresh()` is already called after the disable action. The context will update on next server render.
**Warning signs:** Actions succeeding on the server but failing on subsequent requests.

### Pitfall 6: Suspended Banner Covering Critical UI
**What goes wrong:** The suspended banner covers the Settings dropdown that contains the "Restore Tenant" button, making it impossible to restore.
**Why it happens:** Poor z-index management or fixed positioning that covers interactive elements.
**How to avoid:** The banner should be a sticky element that pushes content down, not an overlay. The Settings dropdown with "Restore Tenant" must remain accessible. Test the restore flow after disabling.
**Warning signs:** Cannot click "Restore Tenant" when the banner is visible.

## Code Examples

### Suspended Banner Component
```typescript
// apps/web/_components/suspended-banner.tsx
"use client";

import { ShieldAlert } from "lucide-react";

interface SuspendedBannerProps {
  businessName: string;
}

export function SuspendedBanner({ businessName }: SuspendedBannerProps) {
  return (
    <div className="sticky top-0 z-40 flex items-center gap-2 border-b border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
      <ShieldAlert className="size-4 shrink-0" />
      <span>
        <strong>{businessName}</strong> is suspended. The dashboard is in
        read-only mode. No deployments, tasks, or changes can be made until the
        tenant is restored.
      </span>
    </div>
  );
}
```

### Server Action Guard Usage
```typescript
// Example: apps/web/_actions/deployment-actions.ts
import { requireActiveBusiness } from "@/_lib/require-active-business";

export async function triggerDeployAction(businessId: string) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Guard: block if business is disabled
  const guard = await requireActiveBusiness(supabase, businessId);
  if (guard) return guard;

  // ... proceed with deployment
}
```

### VPS Container Lifecycle Functions
```typescript
// packages/core/vps/vps-lifecycle.ts
import { isVpsConfigured } from "./vps-config";
import { vpsPost } from "./vps-client";

export async function pauseTenantContainers(
  businessId: string,
  businessSlug: string,
): Promise<{ success: boolean; pausedCount?: number; error?: string }> {
  if (!isVpsConfigured()) {
    return { success: true, pausedCount: 0 };
  }

  try {
    return await vpsPost<{ success: boolean; pausedCount: number }>(
      "/api/tenants/pause",
      { businessId, businessSlug },
    );
  } catch {
    // Best-effort: don't block tenant disable if VPS is unreachable
    return { success: false, error: "VPS unreachable" };
  }
}

export async function resumeTenantContainers(
  businessId: string,
  businessSlug: string,
): Promise<{ success: boolean; resumedCount?: number; error?: string }> {
  if (!isVpsConfigured()) {
    return { success: true, resumedCount: 0 };
  }

  try {
    return await vpsPost<{ success: boolean; resumedCount: number }>(
      "/api/tenants/resume",
      { businessId, businessSlug },
    );
  } catch {
    return { success: false, error: "VPS unreachable" };
  }
}
```

### Extended disableTenant() with VPS Pause
```typescript
// Addition to packages/core/emergency/emergency-service.ts disableTenant()
// After step 4 (freeze agents), add:

// 5. Pause VPS containers (best-effort)
try {
  const { data: biz } = await supabase
    .from("businesses")
    .select("slug")
    .eq("id", businessId)
    .single();

  if (biz?.slug) {
    const pauseResult = await pauseTenantContainers(businessId, biz.slug as string);
    if (!pauseResult.success) {
      console.warn("VPS container pause failed (best-effort):", pauseResult.error);
    }
    vpsPausedCount = pauseResult.pausedCount ?? 0;
  }
} catch (err) {
  console.warn("VPS container pause error (best-effort):", err);
}
```

## Server Actions Requiring Guards

All 18 action files need the `requireActiveBusiness()` guard on mutation functions:

| File | Mutation Functions to Guard | Exempt Functions |
|------|---------------------------|-----------------|
| `agent-actions.ts` | updateAgent, deleteAgent, updateAgentConfig | getAgent (read) |
| `agent-wizard-actions.ts` | createProvisionalAgent, updateWizardAgent, finalizeAgent | -- |
| `approval-actions.ts` | approveAction, rejectAction, bulkApprove, bulkReject | getApprovals (read) |
| `business-actions.ts` | createBusiness, updateBusiness | getBusiness (read) |
| `chat-actions.ts` | sendMessage | getMessages (read) |
| `deployment-actions.ts` | triggerDeploy, retryDeploy, rollbackDeploy | getDeployments (read) |
| `emergency-actions.ts` | freezeAgent, revokeTools, disableAgent, disableTenant | restoreTenant, restoreAgent (EXEMPT) |
| `integration-actions.ts` | createIntegration, deleteIntegration | getIntegrations (read) |
| `knowledge-actions.ts` | uploadDocument, deleteDocument, triggerProcessing | getDocuments (read) |
| `prompt-generator-actions.ts` | generatePrompt, refinePrompt | -- |
| `secrets-actions.ts` | saveSecret, deleteSecret | getSecrets (read) |
| `skill-actions.ts` | createSkill, updateSkill, deleteSkill, assignSkill | getSkills (read) |
| `task-actions.ts` | createTask, updateTask, deleteTask | getTasks (read) |
| `template-actions.ts` | createTemplate, updateTemplate | getTemplates (read) |
| `vps-actions.ts` | checkVpsHealth (safe), refreshVpsStatus | -- |
| `health-actions.ts` | -- | getHealthDashboard (read-only, EXEMPT) |
| `log-actions.ts` | -- | getLogs (read-only, EXEMPT) |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 404 on disabled tenant | Frozen dashboard with banner | This phase | Users see a clear "Suspended" message instead of confusing 404 |
| No VPS container management | Pause/resume containers on disable/restore | This phase | Resources freed, security improved when tenant disabled |
| No mutation guards | `requireActiveBusiness()` on all actions | This phase | Defense-in-depth prevents any mutations on disabled businesses |

**Already working (no changes needed):**
- `disableTenant()` service: sets status to 'disabled', freezes all agents
- `restoreTenant()` service: sets status back to 'active', agents remain frozen
- Deployment service: already checks `business.status === "disabled"` and blocks deploys
- Health dashboard: already has `isDisabled` flag and shows correct status badge

## Open Questions

1. **VPS Proxy Pause Endpoint**
   - What we know: The VPS proxy is a standalone npm project. It has `/api/deploy` and `/api/health` endpoints.
   - What's unclear: The proxy does not currently have a `/api/tenants/pause` or `/api/tenants/resume` endpoint. This needs to be added to the VPS proxy codebase.
   - Recommendation: Create the VPS function signatures in `packages/core/vps/` that call the endpoint. The actual VPS proxy endpoint implementation is out of scope for this phase (it's on the VPS side). The admin app should gracefully handle the case where the endpoint doesn't exist yet (404 from VPS treated as best-effort failure).

2. **"suspended" vs "disabled" Status**
   - What we know: The DB schema has both `suspended` and `disabled` as valid business statuses. The emergency service currently only uses `disabled`.
   - What's unclear: Whether `suspended` should be used for a lighter-weight freeze (e.g., billing suspension) vs `disabled` for admin kill switch.
   - Recommendation: Continue using `disabled` for the emergency kill switch. Treat `suspended` as a future billing-related state. The UI should show the frozen banner for BOTH statuses.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `packages/core/emergency/emergency-service.ts` -- existing disableTenant()/restoreTenant() implementation
- Codebase inspection: `apps/web/app/(dashboard)/businesses/[id]/layout.tsx` -- current layout that causes the 404 bug
- Codebase inspection: `packages/core/deployment/service.ts` line 51 -- existing `business.status === "disabled"` guard
- Codebase inspection: `apps/web/_components/health-dashboard.tsx` -- existing isDisabled flag usage
- Codebase inspection: `apps/web/middleware.ts` -- current middleware (session only, no business checks)
- [Next.js Layout Docs](https://nextjs.org/docs/app/api-reference/file-conventions/layout) -- layout cannot pass props to children
- [Next.js Discussion #44506](https://github.com/vercel/next.js/discussions/44506) -- confirmed: use Context for layout-to-children data

### Secondary (MEDIUM confidence)
- [Docker Pause/Stop Docs](https://docs.docker.com/reference/cli/docker/container/stop/) -- Docker pause vs stop semantics for VPS container management
- [Next.js Multi-Tenant Guide](https://nextjs.org/docs/app/guides/multi-tenant) -- general multi-tenant patterns

### Tertiary (LOW confidence)
- VPS proxy endpoint availability -- the pause/resume endpoints don't exist yet, implementation deferred to VPS side

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all patterns use existing libraries and established Next.js patterns
- Architecture: HIGH -- layout-level enforcement with Context is the documented Next.js approach
- Pitfalls: HIGH -- identified from direct codebase inspection and known Next.js App Router limitations
- VPS pause: MEDIUM -- the admin-side code is straightforward but the VPS proxy endpoint doesn't exist yet

**Research date:** 2026-03-29
**Valid until:** 2026-04-28 (30 days -- stable domain, no fast-moving dependencies)
