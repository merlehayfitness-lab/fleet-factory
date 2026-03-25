# Phase 1: Foundation and Tenant Provisioning - Research

**Researched:** 2026-03-25
**Domain:** Supabase Auth, RLS multi-tenancy, atomic Postgres provisioning, Next.js 15 App Router, Turborepo monorepo
**Confidence:** HIGH

## Summary

Phase 1 establishes four foundational pillars: (1) a Turborepo monorepo with the prescribed package structure, (2) Supabase Auth with cookie-based sessions and middleware-plus-RLS route protection, (3) a Postgres schema with RLS policies enforcing tenant isolation via an `is_business_member()` helper function, and (4) an atomic provisioning RPC that creates a business, owner membership, departments, starter agents, and a queued deployment job in a single transaction.

The most critical technical decisions are: use `supabase.rpc()` for provisioning (supabase-js does NOT support client-side transactions -- each `.insert()` is an independent HTTP request), wrap `auth.uid()` calls in `(select auth.uid())` for RLS performance caching, and enforce authorization in both middleware AND Server Components/Actions (defense in depth against CVE-2025-29927 middleware bypass).

**Primary recommendation:** Build the database schema and RLS policies first, then auth, then the provisioning RPC, then the UI -- in that order. Every subsequent phase depends on RLS being correct from day one.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | Sign in with email/password via Supabase Auth | Supabase SSR client pattern with `@supabase/ssr`, cookie-based sessions |
| AUTH-02 | Session persists across browser refresh | `@supabase/ssr` manages httpOnly cookies with automatic token refresh in middleware |
| AUTH-03 | Sign out and session invalidation | `supabase.auth.signOut()` clears cookies via server action |
| AUTH-04 | Unauthenticated users redirected to sign-in | Middleware checks session + Server Component `getUser()` as defense in depth |
| ISOL-01 | RLS on all tables with `is_business_member()` | Security definer function pattern, composite indexes on `(business_id, ...)` |
| ISOL-02 | Users read/write only their businesses via membership | RLS policies reference `business_users` table through helper function |
| ISOL-03 | Write ops gated by role on sensitive tables | `has_role_on_business()` helper with role parameter for owner/admin/manager checks |
| ISOL-04 | Agent templates globally readable, admin-only writable | Separate SELECT (all authenticated) and INSERT/UPDATE (admin check) policies |
| ISOL-05 | Tenant kill switch | `status` field on businesses table; RLS checks `status != 'disabled'` |
| PROV-01 | Create business wizard | Multi-step form with react-hook-form + Zod validation |
| PROV-02 | Atomic Postgres RPC | `provision_business_tenant()` SQL function called via `supabase.rpc()` |
| PROV-03 | 4 default departments seeded | Hardcoded in RPC function: Owner, Sales, Support, Operations |
| PROV-04 | Starter agents from templates | RPC queries `agent_templates` and inserts matching agents per department |
| PROV-05 | Deployment job queued | RPC inserts into `deployments` with `status = 'queued'` as final step |
| PROV-06 | Idempotent provisioning | RPC checks for existing business by slug, returns existing if found |
| DASH-01 | Sign-in page | `(auth)/sign-in` route group with Supabase Auth form |
| DASH-02 | Businesses list with status badges | Server Component fetching via RLS-scoped query, shadcn Table + Badge |
| DASH-03 | Create business wizard | Multi-step form in `(dashboard)/businesses/new` |
| DASH-04 | Business overview dashboard | Server Component with health indicators, agent counts, deployment status |
| DASH-05 | Departments setup page | `(dashboard)/businesses/[id]/departments` showing seeded departments |
</phase_requirements>

## Standard Stack

### Core (Phase 1 specific)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.5.x | App Router, Server Components, Server Actions | Patched for CVE-2025-29927. App Router is required for server-centric architecture. |
| React | 19.2.x | UI rendering | Required by Next.js 15. Server Components for data fetching. |
| TypeScript | 5.5+ (strict) | Type safety | Required by Zod v4. Strict mode catches tenant isolation bugs. |
| Tailwind CSS | 4.2.x | Styling | CSS-only config with `@theme inline`. No `tailwind.config.ts` needed. |
| @supabase/supabase-js | 2.99.x | Database client, auth | RLS-respecting queries via anon key. Service-role only server-side for admin ops. |
| @supabase/ssr | latest | Next.js auth integration | Cookie-based session management for App Router. Handles token refresh in middleware. |
| Zod | 4.3.x | Validation | Form validation, Server Action input parsing. 14x faster than v3. |
| Turborepo | 2.8.x | Monorepo orchestration | Caches builds, parallelizes tasks across packages. |
| pnpm | 9.x | Package manager | Workspace protocol, strict hoisting, standard for Turborepo. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui | CLI v4 | Component library | All UI: tables, badges, forms, dialogs, cards, buttons |
| radix-ui | unified | Accessible primitives | Powers shadcn/ui components |
| Lucide React | latest | Icons | Status indicators, nav icons, action buttons |
| react-hook-form | 7.x | Form management | Create business wizard multi-step form |
| sonner | latest | Toast notifications | Success/error feedback on provisioning |
| Biome | latest | Lint + format | Replaces ESLint + Prettier. Single tool. |
| Supabase CLI | latest | Local dev, migrations, type gen | `supabase start`, `supabase db push`, `supabase gen types` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @supabase/ssr | Manual cookie handling | @supabase/ssr handles token refresh edge cases automatically |
| react-hook-form | Native form actions | RHF gives multi-step wizard state, field validation, error display |
| Zod v4 | Zod v3 | v4 is 14x faster and greenfield project has no v3 lock-in |
| Biome | ESLint + Prettier | Biome is 35x faster, single config, covers 95% of cases |

**Installation:**
```bash
# Root
pnpm add -D turbo typescript @biomejs/biome supabase tsx

# apps/web
pnpm add next@15 react@19 react-dom@19 @supabase/supabase-js @supabase/ssr zod react-hook-form sonner
pnpm add -D @types/react @types/node tailwindcss@4
pnpm dlx shadcn@latest init --monorepo -c ./apps/web
```

## Architecture Patterns

### Recommended Project Structure (Phase 1 scope)
```
agency-factory/
├── apps/
│   └── web/                        # Next.js admin panel
│       ├── app/
│       │   ├── (auth)/             # Public auth routes
│       │   │   ├── sign-in/page.tsx
│       │   │   └── layout.tsx
│       │   ├── (dashboard)/        # Protected routes
│       │   │   ├── businesses/
│       │   │   │   ├── page.tsx            # List
│       │   │   │   ├── new/page.tsx        # Wizard
│       │   │   │   └── [id]/
│       │   │   │       ├── page.tsx        # Overview
│       │   │   │       └── departments/page.tsx
│       │   │   └── layout.tsx      # Dashboard shell with nav
│       │   ├── auth/callback/route.ts  # OAuth callback handler
│       │   └── layout.tsx          # Root layout
│       ├── _actions/               # Server actions (thin wrappers)
│       │   └── business-actions.ts
│       ├── _components/            # App-specific components
│       ├── _lib/                   # Supabase client utilities
│       │   ├── supabase/
│       │   │   ├── server.ts       # createServerClient()
│       │   │   ├── client.ts       # createBrowserClient()
│       │   │   └── middleware.ts   # updateSession()
│       │   └── env.ts             # Environment variable helpers
│       └── middleware.ts           # Route protection + session refresh
├── packages/
│   ├── db/
│   │   ├── schema/                 # SQL migration files
│   │   │   ├── 001_businesses.sql
│   │   │   ├── 002_business_users.sql
│   │   │   ├── 003_departments.sql
│   │   │   ├── 004_agent_templates.sql
│   │   │   ├── 005_agents.sql
│   │   │   ├── 006_deployments.sql
│   │   │   ├── 007_audit_logs.sql
│   │   │   ├── 008_rls_helpers.sql
│   │   │   ├── 009_rls_policies.sql
│   │   │   └── 010_provision_rpc.sql
│   │   ├── types/                  # Generated from `supabase gen types`
│   │   │   └── database.ts
│   │   └── index.ts
│   ├── core/
│   │   ├── tenant/
│   │   │   ├── provision.ts        # provisionBusinessTenant()
│   │   │   └── schema.ts          # Zod schemas for business input
│   │   └── types/
│   │       └── index.ts
│   └── ui/                         # shadcn/ui shared components
├── templates/                      # Department agent templates
│   └── default-departments.json
└── turbo.json
```

### Pattern 1: Supabase SSR Client Utilities

**What:** Three Supabase client factories for different Next.js contexts.
**When to use:** Every data access point.

```typescript
// apps/web/_lib/supabase/server.ts
// Source: Supabase SSR docs
import { createServerClient as createSSRClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerClient() {
  const cookieStore = await cookies();
  return createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}
```

```typescript
// apps/web/_lib/supabase/middleware.ts
// Source: Supabase SSR docs
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && !request.nextUrl.pathname.startsWith('/sign-in')) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

### Pattern 2: RLS Helper Functions

**What:** `security definer` functions that check business membership and role.
**When to use:** Every RLS policy on tenant-scoped tables.

```sql
-- packages/db/schema/008_rls_helpers.sql
-- Source: Supabase RLS docs + MakerKit best practices

-- Check if current user is a member of the given business
CREATE OR REPLACE FUNCTION public.is_business_member(p_business_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.business_users bu
    JOIN public.businesses b ON b.id = bu.business_id
    WHERE bu.user_id = (SELECT auth.uid())
      AND bu.business_id = p_business_id
      AND b.status != 'disabled'
  );
$$;

-- Check if current user has a specific role on a business
CREATE OR REPLACE FUNCTION public.has_role_on_business(
  p_business_id uuid,
  p_role text DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.business_users bu
    JOIN public.businesses b ON b.id = bu.business_id
    WHERE bu.user_id = (SELECT auth.uid())
      AND bu.business_id = p_business_id
      AND b.status != 'disabled'
      AND (p_role IS NULL OR bu.role = p_role)
  );
$$;
```

### Pattern 3: Atomic Provisioning RPC

**What:** Single Postgres function that provisions an entire business tenant.
**When to use:** Business creation only. Called via `supabase.rpc('provision_business_tenant', {...})`.

```sql
-- packages/db/schema/010_provision_rpc.sql
CREATE OR REPLACE FUNCTION public.provision_business_tenant(
  p_name text,
  p_slug text,
  p_industry text DEFAULT 'general'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_business_id uuid;
  v_existing_id uuid;
  v_dept_types text[] := ARRAY['owner', 'sales', 'support', 'operations'];
  v_dept_type text;
  v_dept_id uuid;
  v_template RECORD;
BEGIN
  -- Idempotency: check if business with this slug already exists for this user
  SELECT b.id INTO v_existing_id
  FROM public.businesses b
  JOIN public.business_users bu ON bu.business_id = b.id
  WHERE b.slug = p_slug AND bu.user_id = v_user_id AND bu.role = 'owner';

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  -- 1. Create business
  INSERT INTO public.businesses (name, slug, industry, status)
  VALUES (p_name, p_slug, p_industry, 'provisioning')
  RETURNING id INTO v_business_id;

  -- 2. Create owner membership
  INSERT INTO public.business_users (business_id, user_id, role)
  VALUES (v_business_id, v_user_id, 'owner');

  -- 3. Seed departments + 4. Create agents from templates
  FOREACH v_dept_type IN ARRAY v_dept_types LOOP
    INSERT INTO public.departments (business_id, name, type)
    VALUES (v_business_id, initcap(v_dept_type), v_dept_type)
    RETURNING id INTO v_dept_id;

    FOR v_template IN
      SELECT * FROM public.agent_templates
      WHERE department_type = v_dept_type AND is_active = true
    LOOP
      INSERT INTO public.agents (
        business_id, department_id, template_id,
        name, system_prompt, tool_profile, model_profile, status
      ) VALUES (
        v_business_id, v_dept_id, v_template.id,
        v_template.name, v_template.system_prompt,
        v_template.tool_profile, v_template.model_profile, 'provisioning'
      );
    END LOOP;
  END LOOP;

  -- 5. Queue deployment
  INSERT INTO public.deployments (business_id, version, status)
  VALUES (v_business_id, 1, 'queued');

  -- Mark business active
  UPDATE public.businesses SET status = 'active' WHERE id = v_business_id;

  RETURN v_business_id;
END;
$$;
```

### Pattern 4: Thin Server Action

**What:** Server actions validate input, get auth context, delegate to core services.
**When to use:** Every mutation from UI.

```typescript
// apps/web/_actions/business-actions.ts
'use server';

import { createServerClient } from '@/_lib/supabase/server';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const createBusinessSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  industry: z.string().min(1),
});

export async function createBusiness(formData: FormData) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const input = createBusinessSchema.parse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    industry: formData.get('industry'),
  });

  const { data, error } = await supabase.rpc('provision_business_tenant', {
    p_name: input.name,
    p_slug: input.slug,
    p_industry: input.industry,
  });

  if (error) throw new Error(`Provisioning failed: ${error.message}`);
  redirect(`/businesses/${data}`);
}
```

### Anti-Patterns to Avoid
- **Sequential `.insert()` calls for provisioning:** supabase-js has NO transaction support. Use RPC.
- **`USING (true)` in RLS policies:** Never, even in development. Use real membership checks from day one.
- **Business logic in Server Actions:** Keep them under 15 lines. Logic goes in `packages/core/`.
- **Testing RLS via SQL Editor:** SQL Editor bypasses RLS. Test from the client SDK.
- **Relying solely on middleware for auth:** CVE-2025-29927 bypass. Always verify in Server Components too.
- **Manual `business_id` filtering:** Let RLS do it. Application code never filters by tenant.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth session management | Custom JWT/cookie logic | @supabase/ssr | Token refresh, cookie rotation, cross-tab sync are edge-case-heavy |
| Multi-tenant data isolation | WHERE clauses in every query | Supabase RLS + `is_business_member()` | One missed filter = data leak. RLS is database-enforced. |
| Atomic multi-table inserts | Try/catch around sequential inserts | Postgres RPC function | supabase-js cannot do transactions. RPC auto-wraps in a transaction. |
| Form state management | useState chains for multi-step wizard | react-hook-form | Handles validation, dirty tracking, step state, error display |
| Component primitives | Custom accessible dropdowns, modals | shadcn/ui (Radix) | Keyboard nav, screen readers, focus trapping -- thousands of edge cases |
| Monorepo build orchestration | Custom npm scripts | Turborepo | Caching, parallelization, dependency graph resolution |

**Key insight:** Phase 1's biggest risk is partial provisioning failures and RLS gaps. Both are solved by using Postgres-native features (transactions via RPC, RLS policies) rather than application-level workarounds.

## Common Pitfalls

### Pitfall 1: RLS Disabled by Default
**What goes wrong:** New tables are 100% public. 83% of exposed Supabase databases involve RLS misconfigurations.
**How to avoid:** Every migration file that creates a table MUST include `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and at least one policy in the same file. Add a test that queries `pg_class` to verify all public tables have `relrowsecurity = true`.
**Warning signs:** Any CREATE TABLE without a corresponding ALTER TABLE ENABLE ROW LEVEL SECURITY.

### Pitfall 2: Partial Provisioning State
**What goes wrong:** Business exists but departments are missing. UI shows broken empty state.
**How to avoid:** Single RPC function. If any step fails, entire transaction rolls back. Add `provisioning_status` field.
**Warning signs:** Multiple `.insert()` calls in a Server Action without RPC wrapping.

### Pitfall 3: RLS Silent Failures
**What goes wrong:** SELECT/UPDATE/DELETE with wrong RLS context return zero rows instead of throwing errors. Developer thinks "no data" instead of "access denied."
**How to avoid:** Always test RLS by authenticating as a specific user via the client SDK. Write cross-tenant tests: User-A queries Tenant-B data and asserts zero rows.
**Warning signs:** Empty dashboards that should have data. No RLS test suite.

### Pitfall 4: `auth.uid()` Performance Without Caching
**What goes wrong:** RLS policies calling `auth.uid()` directly evaluate the function per-row instead of once per query.
**How to avoid:** Always wrap in a SELECT: `(SELECT auth.uid())`. This tells Postgres to cache the result.
**Warning signs:** Slow queries on tables with many rows and RLS policies.

### Pitfall 5: Middleware-Only Auth (CVE-2025-29927)
**What goes wrong:** Attacker bypasses middleware entirely. All "protected" routes are accessible.
**How to avoid:** Defense in depth. Middleware handles session refresh + redirect. Server Components/Actions call `supabase.auth.getUser()` independently. RLS enforces at the database level.
**Warning signs:** No `getUser()` call in Server Components or Actions that fetch data.

## Code Examples

### RLS Policy for Tenant-Scoped Table
```sql
-- Source: Supabase RLS docs
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view departments"
  ON public.departments FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

CREATE POLICY "Owners/admins can manage departments"
  ON public.departments FOR ALL
  TO authenticated
  USING (public.has_role_on_business(business_id, 'owner'))
  WITH CHECK (public.has_role_on_business(business_id, 'owner'));
```

### Agent Templates (Globally Readable, Admin-Only Writable)
```sql
ALTER TABLE public.agent_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read templates"
  ON public.agent_templates FOR SELECT
  TO authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE policies for regular users
-- Admin operations use service_role client (server-side only)
```

### Server Component with Auth Check
```typescript
// apps/web/app/(dashboard)/businesses/page.tsx
import { createServerClient } from '@/_lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function BusinessesPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  // RLS automatically scopes to user's businesses
  const { data: businesses } = await supabase
    .from('businesses')
    .select('*, business_users!inner(role)')
    .order('created_at', { ascending: false });

  return <BusinessList businesses={businesses ?? []} />;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 | Unified SSR package for all frameworks. auth-helpers is deprecated. |
| Tailwind v3 JS config | Tailwind v4 CSS-only `@theme inline` | 2025 | No `tailwind.config.ts`. Theming in CSS with OKLCH colors. |
| `tailwindcss-animate` | `tw-animate-css` | 2025 | Old animation plugin deprecated in shadcn/ui v4. |
| `React.forwardRef` | Direct ref props | React 19 | shadcn/ui v4 components use `data-slot` attributes instead. |
| Multiple `@radix-ui/react-*` | Single `radix-ui` package | 2025 | One import for all Radix primitives. |
| HSL color values | OKLCH color values | Tailwind v4 | Wider gamut, perceptually uniform. shadcn/ui v4 uses OKLCH. |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: replaced by `@supabase/ssr`
- `tailwindcss-animate`: replaced by `tw-animate-css`
- `React.forwardRef`: no longer needed in React 19

## Open Questions

1. **Agent templates seed data**
   - What we know: 4 department types need templates with `system_prompt`, `tool_profile`, `model_profile`
   - What's unclear: Exact template content for MVP (can be stubs)
   - Recommendation: Create minimal stub templates with placeholder prompts. Real content is a Phase 2 concern.

2. **Supabase project setup**
   - What we know: Need a Supabase project (local dev via CLI, hosted for staging)
   - What's unclear: Whether to use Supabase CLI local dev or a hosted dev project
   - Recommendation: Use `supabase start` for local development. Faster iteration, no network dependency.

## Sources

### Primary (HIGH confidence)
- [Supabase RLS Official Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) - Policy syntax, auth helpers, performance optimization
- [Supabase SSR Docs](https://supabase.com/docs/guides/auth/server-side/nextjs) - Cookie-based auth for Next.js App Router
- [MakerKit RLS Best Practices](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) - `has_role_on_account()` pattern, security definer functions, performance tips
- [shadcn/ui Tailwind v4 Guide](https://ui.shadcn.com/docs/tailwind-v4) - `@theme inline`, OKLCH, `tw-animate-css`, `data-slot`
- [shadcn/ui Monorepo Guide](https://ui.shadcn.com/docs/monorepo) - `--monorepo` flag, workspace setup
- [CVE-2025-29927 Postmortem](https://vercel.com/blog/postmortem-on-next-js-middleware-bypass) - Middleware bypass, defense in depth requirement

### Secondary (MEDIUM confidence)
- [AntStack Multi-Tenant RLS](https://www.antstack.com/blog/multi-tenant-applications-with-rls-on-supabase-postgress/) - JWT claims pattern for tenant scoping
- [DEV Community LockIn RLS Architecture](https://dev.to/blackie360/-enforcing-row-level-security-in-supabase-a-deep-dive-into-lockins-multi-tenant-architecture-4hd2) - Real-world multi-tenant RLS implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via official docs and npm, versions confirmed
- Architecture: HIGH - Patterns from Supabase official docs and validated project research
- Pitfalls: HIGH - Corroborated across CVE reports, Supabase docs, and multiple post-mortems

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (30 days -- stable domain, unlikely to change)
