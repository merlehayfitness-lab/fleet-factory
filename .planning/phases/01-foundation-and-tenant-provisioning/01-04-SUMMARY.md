---
phase: 01-foundation-and-tenant-provisioning
plan: 04
subsystem: ui, dashboard
tags: [nextjs-app-router, server-components, shadcn-ui, supabase-rls, sidebar-nav, status-badges, dashboard]

# Dependency graph
requires:
  - phase: 01-foundation-and-tenant-provisioning (plan 02)
    provides: Supabase Auth, createServerClient(), middleware route protection, shadcn/ui, dashboard layout shell
  - phase: 01-foundation-and-tenant-provisioning (plan 03)
    provides: Provisioning RPC, domain types, create business wizard at /businesses/new
provides:
  - SidebarNav client component with main nav, per-business sub-nav, and user dropdown menu
  - StatusBadge reusable component mapping status strings to colored badge variants
  - Businesses list page with RLS-scoped query and empty state
  - Business overview dashboard with stats cards, quick links, and recent activity placeholder
  - Departments list page with type-specific icons in responsive card grid
  - Business [id] layout with RLS access validation
affects: [phase-02, phase-03, phase-04, phase-05]

# Tech tracking
tech-stack:
  added: [shadcn/ui-table, shadcn/ui-separator, shadcn/ui-avatar, shadcn/ui-dropdown-menu]
  patterns: [rls-scoped-server-component-queries, buttonVariants-for-link-styling, status-badge-color-mapping, sidebar-sub-navigation-from-pathname]

key-files:
  created:
    - apps/web/_components/sidebar-nav.tsx
    - apps/web/_components/status-badge.tsx
    - apps/web/_components/business-list.tsx
    - apps/web/_components/business-overview.tsx
    - apps/web/_components/departments-list.tsx
    - apps/web/app/(dashboard)/businesses/page.tsx
    - apps/web/app/(dashboard)/businesses/[id]/page.tsx
    - apps/web/app/(dashboard)/businesses/[id]/layout.tsx
    - apps/web/app/(dashboard)/businesses/[id]/departments/page.tsx
    - apps/web/components/ui/table.tsx
    - apps/web/components/ui/separator.tsx
    - apps/web/components/ui/avatar.tsx
    - apps/web/components/ui/dropdown-menu.tsx
  modified:
    - apps/web/app/(dashboard)/layout.tsx

key-decisions:
  - "Used buttonVariants() for Link styling instead of asChild -- base-ui Button does not support asChild prop"
  - "Business sub-nav extracted from pathname via regex match for dynamic route detection"
  - "Disabled nav links rendered as span elements with cursor-not-allowed and reduced opacity"
  - "signOut invoked from client via async wrapper function calling the server action directly"

patterns-established:
  - "RLS-scoped Server Component queries: fetch data via createServerClient(), RLS handles tenant isolation, .eq() for scope not security"
  - "StatusBadge reusable component: maps status strings to colored badge variants across all entity types"
  - "Sidebar sub-navigation: extracted from URL pathname, dynamically shown when viewing a business"
  - "Empty states: dashed border container with heading, description, and CTA link"
  - "buttonVariants() pattern for Link elements that need button styling (base-ui compatibility)"

requirements-completed: [DASH-02, DASH-04, DASH-05]

# Metrics
duration: 5min
completed: 2026-03-25
---

# Phase 1 Plan 04: Admin Dashboard Summary

**Dashboard shell with sidebar navigation, businesses list with status badges, business overview with stats cards and quick links, and departments page with type-specific icons -- all RLS-scoped**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-25T16:38:22Z
- **Completed:** 2026-03-25T16:44:10Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Built sidebar navigation with main links, dynamic per-business sub-navigation, disabled placeholders for future phases, and user dropdown with sign-out
- Created businesses list page showing all user's businesses with status badges, role, industry, and creation date in a shadcn Table
- Built business overview dashboard with 4 stats cards (deployment status, agents, departments, approvals), quick links grid, and recent activity placeholder
- Created departments page rendering seeded departments in a responsive card grid with type-specific Lucide icons (Crown, TrendingUp, Headphones, Settings)
- Added StatusBadge component mapping status strings (active, provisioning, error, etc.) to appropriately colored badges

## Task Commits

Each task was committed atomically:

1. **Task 1: Create dashboard shell with sidebar navigation and shared components** - `48b3a95` (feat)
2. **Task 2: Create businesses list, business overview, and departments page** - `a5c69d0` (feat)

## Files Created/Modified
- `apps/web/_components/sidebar-nav.tsx` - Client component: brand, main nav, dynamic business sub-nav, user dropdown with sign-out
- `apps/web/_components/status-badge.tsx` - Reusable StatusBadge mapping status strings to colored Badge variants
- `apps/web/_components/business-list.tsx` - Table of businesses with name link, industry, status badge, role, date
- `apps/web/_components/business-overview.tsx` - Dashboard with stats cards, quick links, recent activity placeholder
- `apps/web/_components/departments-list.tsx` - Responsive card grid with type-specific Lucide icons per department
- `apps/web/app/(dashboard)/layout.tsx` - Updated to use SidebarNav component with user info
- `apps/web/app/(dashboard)/businesses/page.tsx` - Server Component fetching RLS-scoped businesses with empty state
- `apps/web/app/(dashboard)/businesses/[id]/layout.tsx` - Server Component validating business access via RLS
- `apps/web/app/(dashboard)/businesses/[id]/page.tsx` - Server Component fetching business details, agent/department counts, latest deployment
- `apps/web/app/(dashboard)/businesses/[id]/departments/page.tsx` - Server Component fetching departments for a business
- `apps/web/components/ui/table.tsx` - shadcn/ui Table component
- `apps/web/components/ui/separator.tsx` - shadcn/ui Separator component
- `apps/web/components/ui/avatar.tsx` - shadcn/ui Avatar component
- `apps/web/components/ui/dropdown-menu.tsx` - shadcn/ui Dropdown Menu component

## Decisions Made
- Used `buttonVariants()` for Link elements instead of `asChild` prop -- the base-ui Button component used by this shadcn version does not support asChild (Radix pattern). This is consistent with the base-ui render prop approach.
- Business sub-navigation is dynamically extracted from the URL pathname via regex match, not from server-side props.
- Disabled future-phase nav links (Deployments, Approvals, Tasks, Logs) rendered as `<span>` with `cursor-not-allowed` and reduced opacity rather than hidden entirely -- shows the full product surface.
- Sign-out invoked from the client-side dropdown via an async wrapper calling the server action directly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Button asChild prop not supported in base-ui**
- **Found during:** Task 2 (Businesses list page)
- **Issue:** Plan specified `<Button asChild><Link>` pattern, but the base-ui Button component does not support the `asChild` prop (which is a Radix UI pattern). TypeScript error TS2322.
- **Fix:** Used `buttonVariants()` directly on `<Link>` elements for button-styled links, avoiding the Button component wrapper entirely.
- **Files modified:** apps/web/app/(dashboard)/businesses/page.tsx
- **Verification:** `pnpm turbo typecheck` and `pnpm turbo build` both pass
- **Committed in:** `a5c69d0` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Fix was necessary for type safety with base-ui. No scope creep.

## Issues Encountered

None beyond the asChild compatibility issue documented in deviations above.

## User Setup Required

None - no external service configuration required. All pages use the existing Supabase client configuration from Plan 02.

## Next Phase Readiness
- Phase 1 is now complete: all 4 plans executed successfully
- Full user journey works: sign in -> create business -> see provisioned workspace with departments
- Dashboard shell with sidebar navigation is ready for Phase 2+ pages
- StatusBadge component is ready for use across deployment, agent, and task status displays
- Business overview dashboard is ready to receive real deployment data (Phase 3) and approval/task data (Phase 4)
- Disabled nav links are ready to be enabled as their corresponding pages are built

## Self-Check: PASSED

All 14 key files verified present. Both task commits (48b3a95, a5c69d0) verified in git history. Build and typecheck pass.

---
*Phase: 01-foundation-and-tenant-provisioning*
*Completed: 2026-03-25*
