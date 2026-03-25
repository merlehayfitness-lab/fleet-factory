---
phase: 01-foundation-and-tenant-provisioning
plan: 02
subsystem: auth
tags: [supabase-ssr, supabase-auth, nextjs-middleware, cookie-sessions, shadcn-ui, tailwind-v4, defense-in-depth]

# Dependency graph
requires:
  - phase: 01-foundation-and-tenant-provisioning (plan 01)
    provides: Turborepo monorepo with apps/web, packages/db, packages/core
provides:
  - createServerClient() for Server Components and Server Actions
  - createBrowserClient() for Client Components
  - updateSession() middleware for route protection and session refresh
  - Email/password sign-in and sign-up pages with shadcn/ui
  - Protected dashboard layout with getUser() defense-in-depth auth check
  - Sign-out server action
  - Auth callback route for OAuth/email confirmation code exchange
  - Environment variable helper functions (getSupabaseUrl, getSupabaseAnonKey, getSupabaseServiceRoleKey)
affects: [01-03-PLAN, 01-04-PLAN, phase-02, phase-03]

# Tech tracking
tech-stack:
  added: [@supabase/supabase-js, @supabase/ssr, sonner, shadcn/ui, class-variance-authority, clsx, tailwind-merge, tw-animate-css, @base-ui/react, radix-ui]
  patterns: [supabase-ssr-cookie-auth, defense-in-depth-auth, server-action-signout, env-var-helpers]

key-files:
  created:
    - apps/web/_lib/env.ts
    - apps/web/_lib/supabase/server.ts
    - apps/web/_lib/supabase/client.ts
    - apps/web/_lib/supabase/middleware.ts
    - apps/web/app/auth/callback/route.ts
    - apps/web/.env.local.example
    - apps/web/middleware.ts
    - apps/web/app/(auth)/layout.tsx
    - apps/web/app/(auth)/sign-in/page.tsx
    - apps/web/app/(auth)/sign-up/page.tsx
    - apps/web/app/(dashboard)/layout.tsx
    - apps/web/_actions/auth-actions.ts
    - apps/web/components/ui/button.tsx
    - apps/web/components/ui/card.tsx
    - apps/web/components/ui/input.tsx
    - apps/web/components/ui/label.tsx
    - apps/web/lib/utils.ts
    - apps/web/components.json
  modified:
    - apps/web/package.json
    - apps/web/app/globals.css
    - apps/web/app/layout.tsx

key-decisions:
  - "Environment variables accessed via helper functions that throw on missing values (per CLAUDE.md rule)"
  - "Middleware redirects authenticated users away from auth pages to /businesses"
  - "Sign-out action in separate 'use server' file for clean Server Action isolation"
  - "shadcn/ui initialized with Tailwind v4 defaults (OKLCH colors, tw-animate-css, data-slot pattern)"

patterns-established:
  - "Supabase SSR: createServerClient() for server, createBrowserClient() for client, updateSession() for middleware"
  - "Defense in depth: middleware session refresh + Server Component getUser() validation"
  - "Auth route group (auth) for public pages, (dashboard) for protected pages"
  - "Server Actions in apps/web/_actions/ directory with 'use server' directive"
  - "shadcn/ui components in apps/web/components/ui/"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04, DASH-01]

# Metrics
duration: 5min
completed: 2026-03-25
---

# Phase 1 Plan 02: Supabase Auth + Route Protection Summary

**Cookie-based Supabase Auth with @supabase/ssr, email/password sign-in/sign-up pages using shadcn/ui, middleware route protection, and defense-in-depth Server Component auth checks**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-25T16:16:10Z
- **Completed:** 2026-03-25T16:21:32Z
- **Tasks:** 2
- **Files modified:** 22

## Accomplishments
- Created three Supabase client utilities (server, client, middleware) following the official @supabase/ssr pattern
- Built sign-in and sign-up pages with email/password forms using shadcn/ui Card, Input, Button, Label components
- Implemented middleware route protection that redirects unauthenticated users to /sign-in
- Added defense-in-depth auth check in dashboard layout via getUser() (protects against CVE-2025-29927 middleware bypass)
- Created sign-out server action and auth callback route for code exchange
- Initialized shadcn/ui with Tailwind v4 (OKLCH colors, tw-animate-css, data-slot pattern)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Supabase client utilities and environment helpers** - `7ea790c` (feat)
2. **Task 2: Create middleware, sign-in page, sign-up page, and protected dashboard layout** - `359f619` (feat)

## Files Created/Modified
- `apps/web/_lib/env.ts` - Environment variable helpers with throw-on-missing validation
- `apps/web/_lib/supabase/server.ts` - createServerClient() for Server Components/Actions
- `apps/web/_lib/supabase/client.ts` - createBrowserClient() for Client Components
- `apps/web/_lib/supabase/middleware.ts` - updateSession() for middleware route protection
- `apps/web/app/auth/callback/route.ts` - OAuth/email confirmation code exchange
- `apps/web/.env.local.example` - Placeholder Supabase environment config
- `apps/web/middleware.ts` - Root middleware calling updateSession()
- `apps/web/app/(auth)/layout.tsx` - Centered auth layout (no nav)
- `apps/web/app/(auth)/sign-in/page.tsx` - Email/password sign-in form
- `apps/web/app/(auth)/sign-up/page.tsx` - Email/password sign-up form with confirmation
- `apps/web/app/(dashboard)/layout.tsx` - Protected layout with sidebar and sign-out
- `apps/web/_actions/auth-actions.ts` - Sign-out server action
- `apps/web/components/ui/button.tsx` - shadcn/ui Button component
- `apps/web/components/ui/card.tsx` - shadcn/ui Card component
- `apps/web/components/ui/input.tsx` - shadcn/ui Input component
- `apps/web/components/ui/label.tsx` - shadcn/ui Label component
- `apps/web/lib/utils.ts` - cn() utility for class merging
- `apps/web/components.json` - shadcn/ui configuration
- `apps/web/app/globals.css` - Updated with shadcn/ui theme (OKLCH)
- `apps/web/app/layout.tsx` - Updated with Geist font and cn() usage

## Decisions Made
- Environment variables accessed via helper functions that throw on missing values (per CLAUDE.md coding rule)
- Middleware redirects authenticated users visiting auth pages to /businesses (prevents signed-in users seeing sign-in form)
- Sign-out action placed in separate `_actions/auth-actions.ts` file for clean 'use server' isolation
- shadcn/ui initialized with default Tailwind v4 theme (OKLCH colors, tw-animate-css, data-slot attributes)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Supabase credentials will be needed at runtime but are configured via `.env.local` (see `.env.local.example`).

## Next Phase Readiness
- Auth foundation is complete -- all subsequent plans can assume authenticated user context
- Supabase client utilities are ready for data fetching in Server Components
- Dashboard layout shell is ready for business listing and detail pages (Plan 03)
- shadcn/ui is initialized and ready for additional component usage
- RLS policies from Plan 01 now have auth.uid() context via Supabase Auth

## Self-Check: PASSED

All 18 key files verified present. Both task commits (7ea790c, 359f619) verified in git history. Build and typecheck pass.

---
*Phase: 01-foundation-and-tenant-provisioning*
*Completed: 2026-03-25*
