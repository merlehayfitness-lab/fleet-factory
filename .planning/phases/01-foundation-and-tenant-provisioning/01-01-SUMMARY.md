---
phase: 01-foundation-and-tenant-provisioning
plan: 01
subsystem: database, infra
tags: [turborepo, pnpm, nextjs, tailwindcss-v4, postgres, rls, supabase, biome, typescript]

# Dependency graph
requires: []
provides:
  - Turborepo monorepo with apps/web, packages/db, packages/core
  - Complete Postgres schema for all Phase 1 entities (8 tables)
  - RLS helper functions (is_business_member, has_role_on_business)
  - RLS policies enforcing tenant isolation on all tables
  - Tenant kill switch via business status field
  - 4 starter agent templates seeded (owner, sales, support, operations)
  - Default departments template JSON
  - updated_at trigger function reusable across tables
affects: [01-02-PLAN, 01-03-PLAN, 01-04-PLAN, phase-02, phase-03]

# Tech tracking
tech-stack:
  added: [turborepo@2.8, pnpm@9.15, next@15.5, react@19.1, tailwindcss@4.1, typescript@5.9, biome@1.9]
  patterns: [turborepo-monorepo, pnpm-workspaces, tailwind-v4-css-only, rls-security-definer, tenant-kill-switch]

key-files:
  created:
    - package.json
    - pnpm-workspace.yaml
    - turbo.json
    - biome.json
    - apps/web/package.json
    - apps/web/app/layout.tsx
    - apps/web/app/page.tsx
    - packages/db/index.ts
    - packages/db/schema/001_businesses.sql
    - packages/db/schema/002_profiles.sql
    - packages/db/schema/003_business_users.sql
    - packages/db/schema/004_departments.sql
    - packages/db/schema/005_agent_templates.sql
    - packages/db/schema/006_agents.sql
    - packages/db/schema/007_deployments.sql
    - packages/db/schema/008_audit_logs.sql
    - packages/db/schema/009_rls_helpers.sql
    - packages/db/schema/010_rls_policies.sql
    - packages/core/index.ts
    - templates/default-departments.json
  modified: []

key-decisions:
  - "Manual monorepo scaffold instead of create-turbo to avoid unwanted boilerplate"
  - "Tailwind CSS v4 with CSS-only config (@import tailwindcss) - no tailwind.config.ts"
  - "Biome for linting/formatting instead of ESLint+Prettier (single tool, faster)"
  - "RLS helper functions use (SELECT auth.uid()) for query plan caching"
  - "Agent templates use ON CONFLICT DO NOTHING for idempotent seeding"
  - "Audit logs INSERT gated by is_business_member (not open to all authenticated)"

patterns-established:
  - "Monorepo layout: apps/web, packages/db, packages/core, templates/"
  - "SQL migration numbering: NNN_entity_name.sql in packages/db/schema/"
  - "RLS pattern: is_business_member() for SELECT, has_role_on_business() for mutations"
  - "All tables use ENABLE ROW LEVEL SECURITY immediately after creation"
  - "Shared update_updated_at_column() trigger function for timestamp management"

requirements-completed: [ISOL-01, ISOL-02, ISOL-03, ISOL-04, ISOL-05]

# Metrics
duration: 5min
completed: 2026-03-25
---

# Phase 1 Plan 01: Monorepo + Schema Summary

**Turborepo monorepo with Next.js 15.5, Tailwind v4, and 10 SQL migration files covering 8 tables with RLS tenant isolation via is_business_member() and has_role_on_business()**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-25T16:07:33Z
- **Completed:** 2026-03-25T16:12:33Z
- **Tasks:** 2
- **Files modified:** 29

## Accomplishments
- Scaffolded Turborepo monorepo with 3 packages (apps/web, packages/db, packages/core) that builds and typechecks
- Created complete Postgres schema for all 8 Phase 1 entities with RLS enabled on every table
- Implemented is_business_member() and has_role_on_business() security definer functions with tenant kill switch
- Seeded 4 starter agent templates and a default departments JSON template
- Established RLS policy patterns for all tables: membership-based SELECT, role-based mutations

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Turborepo monorepo** - `0a0608d` (feat)
2. **Task 2: Create database schema SQL files and RLS policies** - `f1180fb` (feat)

## Files Created/Modified
- `package.json` - Root monorepo config with turbo scripts
- `pnpm-workspace.yaml` - Workspace package definitions (apps/*, packages/*)
- `turbo.json` - Turborepo pipeline (build, dev, lint, typecheck)
- `biome.json` - Biome formatter (2-space indent, 100 line width) and linter config
- `.gitignore` - Standard ignores for node_modules, .next, .env, etc.
- `apps/web/package.json` - Next.js 15.5 with React 19, Tailwind v4
- `apps/web/tsconfig.json` - TypeScript strict mode with @/* path alias
- `apps/web/next.config.ts` - Minimal Next.js config
- `apps/web/app/layout.tsx` - Root layout with metadata
- `apps/web/app/page.tsx` - Minimal homepage
- `apps/web/app/globals.css` - Tailwind v4 CSS-only import
- `packages/db/package.json` - @agency-factory/db package
- `packages/db/tsconfig.json` - TypeScript strict mode
- `packages/db/index.ts` - Placeholder re-export
- `packages/db/schema/001_businesses.sql` - Businesses table with status field and updated_at trigger
- `packages/db/schema/002_profiles.sql` - Profiles with auto-create on auth.users signup
- `packages/db/schema/003_business_users.sql` - Business-user membership with role
- `packages/db/schema/004_departments.sql` - Departments scoped to business
- `packages/db/schema/005_agent_templates.sql` - Global templates with 4 seed records
- `packages/db/schema/006_agents.sql` - Agents linked to business, department, and template
- `packages/db/schema/007_deployments.sql` - Deployment records with status tracking
- `packages/db/schema/008_audit_logs.sql` - Immutable audit trail
- `packages/db/schema/009_rls_helpers.sql` - is_business_member() and has_role_on_business() security definer functions
- `packages/db/schema/010_rls_policies.sql` - RLS policies for all 8 tables
- `packages/core/package.json` - @agency-factory/core package
- `packages/core/tsconfig.json` - TypeScript strict mode
- `packages/core/index.ts` - Placeholder export
- `templates/default-departments.json` - 4 default department templates

## Decisions Made
- Manual monorepo scaffold (no create-turbo) to avoid unwanted boilerplate and maintain full control
- Tailwind CSS v4 with CSS-only config -- no tailwind.config.ts needed
- Biome for lint/format instead of ESLint+Prettier (single tool, 35x faster)
- RLS helpers use `(SELECT auth.uid())` wrapper for query plan caching (per research recommendation)
- Agent template seeds use ON CONFLICT DO NOTHING for idempotent re-application
- Audit log INSERT policy gated by is_business_member() rather than open to all authenticated users (prevents cross-tenant log injection)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Monorepo foundation is ready for Plan 02 (Supabase Auth integration)
- Schema SQL files ready to apply via Supabase CLI or SQL Editor
- RLS policies ready -- all subsequent plans can rely on tenant isolation being enforced
- packages/db and packages/core are ready for type generation and domain logic

## Self-Check: PASSED

All 28 key files verified present. Both task commits (0a0608d, f1180fb) verified in git history.

---
*Phase: 01-foundation-and-tenant-provisioning*
*Completed: 2026-03-25*
