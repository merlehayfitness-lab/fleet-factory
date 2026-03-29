# Phase 13: Secrets Management UX - Research

**Researched:** 2026-03-29
**Domain:** Secrets management UI overhaul -- integration-first credential flows, dynamic fields, Settings page
**Confidence:** HIGH

## Summary

Phase 13 transforms the secrets management experience from a disconnected, flat-field credential form into an integration-first flow where choosing a provider determines what credential fields appear. The current secrets page (`/businesses/[id]/settings/secrets`) uses generic key/value pairs grouped by category (api_key, credential, token). The new flow groups secrets by provider (e.g., "Salesforce", "Slack"), dynamically renders provider-specific credential fields, and introduces a full Settings page that replaces the current gear dropdown on the Overview page.

The existing codebase provides strong foundations: the `secrets` table already has `integration_type` column, the `integrations` table has `provider` and `status` fields, and the integration catalog (`INTEGRATION_CATALOG` in `packages/core/integrations/catalog.ts`) already defines 15 providers across 5 categories. The primary work is: (1) a new `provider_credential_fields` database table defining what fields each provider needs, (2) overhauling the SecretsManager component to group by provider with collapsible cards, (3) creating a Settings page with Emergency Controls and Secrets sections, (4) adding a credential side drawer on the Integrations page, and (5) wiring the "Test Connection" and "eye toggle reveal" behaviors.

**Primary recommendation:** Store provider field definitions in a new database table (`provider_credential_fields`), link secrets to integrations via a new `provider` column on the secrets table, build the Settings page at `/businesses/[id]/settings` with Emergency Controls lifted from the Overview dropdown, and add a credential side drawer to the Integrations page integration cards.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Credentials can be added from TWO entry points: Integrations page (side drawer) and the Secrets page (standalone)
- From Integrations page: clicking "Configure" on an integration opens a side drawer with the credential form
- From Secrets page: user picks a provider from the full catalog of supported providers (all providers, not just configured ones)
- Saving credentials auto-creates the integration record if one doesn't exist yet (no separate step needed)
- The existing Settings gear dropdown on Overview page becomes a full Settings page with sections: Emergency Controls, Secrets, and future settings
- Settings page accessible from BOTH sidebar nav AND gear icon on Overview page
- Provider field definitions stored in database (not hardcoded TypeScript constants) so they can be updated without code changes
- Support full variety of field types: API key, client_id/secret pair, username/password, OAuth token+refresh, instance URL, webhook URL
- All fields shown for a provider are required (no optional fields)
- "Test Connection" button after credentials are saved to verify they work by pinging the provider API
- Secrets grouped by integration/provider (not by category)
- Each provider shows as a collapsed card with provider name and connection status badge -- click to expand and see fields
- Only configured providers shown on Secrets page (providers with at least one credential saved)
- No "Add Integration" button on Secrets page -- adding new providers is done from the Integrations page
- Secrets page lives on the new Settings page (alongside Emergency Controls)
- Edit in place: click on a credential field, enter new value, save -- replaces the encrypted value
- Reveal on click: eye toggle decrypts and shows the actual value for a few seconds, then re-masks
- Show last updated date but no staleness warnings
- Deleting a provider's credentials deactivates its integration record (sets to inactive/mock)

### Claude's Discretion
- Database schema for provider field definitions table
- Exact provider catalog (which providers and what fields each needs)
- How the "Test Connection" button works per provider (mock vs real API ping)
- Settings page section layout and routing structure
- How the eye toggle auto-re-masks after reveal (timeout duration)

### Deferred Ideas (OUT OF SCOPE)
- OAuth flow (redirect to provider, receive token) -- too complex for this phase, just store tokens manually for now
- Secret expiration/rotation reminders -- future enhancement
- Audit log of secret access/changes -- covered by existing audit_logs
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SECR-ENH-01 | Integration-first secrets flow (pick integration, category auto-fills, relevant fields appear) | Provider field definitions table drives dynamic forms; catalog provides provider list; saving credentials auto-creates integration record |
| SECR-ENH-02 | Secrets accessible from business settings page via link to dedicated secrets page | New Settings page at `/businesses/[id]/settings` with Emergency Controls section and Secrets section; sidebar nav updated; gear icon on Overview links to Settings |
| SECR-ENH-03 | Dynamic credential fields adapt to integration type (API key, OAuth, username/password, etc.) | `provider_credential_fields` table stores field_name, field_type, display_label per provider; form renders dynamically based on provider's field definitions |
| SECR-ENH-04 | Secrets page displays credentials grouped by integration | SecretsManager overhauled to group by provider with collapsible cards showing connection status badge, expand to see fields |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.x | App Router, Server Components, Server Actions | Already in use |
| Supabase | 2.x | Database, Auth, RLS | Already in use |
| shadcn/ui | latest | UI components (Card, Dialog, Collapsible, Input, Select, Button) | Already in use |
| @anthropic-ai/sdk | installed | Not needed this phase | N/A |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | installed | Toast notifications | Success/error feedback on save/delete/test |
| lucide-react | installed | Icons (Eye, EyeOff, Shield, Settings, Lock, etc.) | Throughout UI |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| DB-stored field definitions | Hardcoded TypeScript constants | User explicitly wants DB-stored for no-code-deploy updates |
| Side drawer (fixed panel) | Dialog/Modal | User wants drawer from Integrations page; project has existing fixed-panel pattern |
| Collapsible cards | Accordion component | Collapsible already installed and used in project |

**Installation:**
No new dependencies required. All needed components are already installed.

## Architecture Patterns

### Recommended Project Structure
```
packages/db/schema/
  039_provider_credential_fields.sql    # New table for provider field definitions
packages/core/
  secrets/service.ts                    # Extended: add provider-grouped queries, decrypt for reveal
  secrets/test-connection.ts            # New: test connection per provider (mostly mock)
  integrations/catalog.ts               # Existing: provider list already here
apps/web/
  app/(dashboard)/businesses/[id]/
    settings/page.tsx                   # New: Settings page with Emergency Controls + Secrets
    settings/secrets/page.tsx           # Existing: redirect or remove (secrets now on Settings page)
  _actions/
    secrets-actions.ts                  # Extended: revealSecret, testConnection, saveProviderCredentials
  _components/
    settings-page.tsx                   # New: Settings page client component
    provider-secrets-card.tsx           # New: collapsible provider card with credential fields
    credential-form.tsx                 # New: dynamic form driven by provider field definitions
    credential-side-drawer.tsx          # New: side drawer for Integrations page "Configure" flow
    secrets-manager.tsx                 # Overhauled: group by provider, collapsible cards
```

### Pattern 1: Dynamic Form from Database Field Definitions
**What:** Provider field definitions stored in DB determine which form fields render
**When to use:** When the form shape varies per provider and needs to be updatable without code changes
**Example:**
```typescript
// provider_credential_fields table rows for "hubspot":
// { provider: "hubspot", field_name: "api_key", field_type: "password", display_label: "API Key", field_order: 1 }

// Query fields, render dynamically:
const { data: fields } = await supabase
  .from("provider_credential_fields")
  .select("*")
  .eq("provider", "hubspot")
  .order("field_order");

// Render: fields.map(f => <Input type={f.field_type} label={f.display_label} ... />)
```

### Pattern 2: Fixed-Position Side Drawer (Existing Project Pattern)
**What:** Right-side panel for contextual editing without page navigation
**When to use:** Integrations page "Configure" button opens credential form
**Example:**
```typescript
// From task-detail-panel.tsx and profile-editor-drawer.tsx pattern:
// Fixed positioned div with slide-in transition
<div className={cn(
  "fixed inset-y-0 right-0 z-50 w-[420px] border-l bg-background shadow-xl transition-transform duration-200",
  isOpen ? "translate-x-0" : "translate-x-full"
)}>
  {/* Header with close button */}
  {/* Dynamic credential form */}
  {/* Save / Test Connection buttons */}
</div>
```

### Pattern 3: Eye Toggle with Auto-Re-mask Timer
**What:** Reveal encrypted value server-side, display for N seconds, then re-mask
**When to use:** Showing actual secret values temporarily
**Example:**
```typescript
// Server action decrypts and returns plaintext
export async function revealSecretAction(businessId: string, secretId: string) {
  const secret = await getSecretById(supabase, businessId, secretId);
  const plaintext = decrypt(secret.encrypted_value);
  return { value: plaintext };
}

// Client: show for 5 seconds then re-mask
function handleReveal(secretId: string) {
  const result = await revealSecretAction(businessId, secretId);
  setRevealedValues(prev => ({ ...prev, [secretId]: result.value }));
  setTimeout(() => {
    setRevealedValues(prev => { const next = {...prev}; delete next[secretId]; return next; });
  }, 5000); // Auto re-mask after 5 seconds
}
```

### Pattern 4: Auto-Create Integration on Credential Save
**What:** When saving credentials for a provider that has no integration record, auto-create one
**When to use:** Secrets page standalone flow -- user picks provider, fills credentials, integration record created automatically
**Example:**
```typescript
// In saveProviderCredentials action:
// 1. Check if integration exists for this provider + business
// 2. If not, create one with status "inactive" (or "active" if test passes)
// 3. Save all credential fields as individual secrets linked to provider
// 4. Revalidate both integrations and settings pages
```

### Anti-Patterns to Avoid
- **Decrypting all secrets on page load:** Only decrypt on explicit eye-toggle click, never batch-decrypt for display
- **Storing field definitions in TypeScript constants:** User explicitly wants DB-stored for no-deploy updates
- **Building a custom form builder:** Use simple field_type mapping (password, text, url) to native Input types
- **Mixing concerns on Settings page:** Emergency Controls and Secrets should be clearly separated sections, not interleaved

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Collapsible sections | Custom expand/collapse | shadcn/ui Collapsible (already installed) | Consistent behavior, accessibility |
| Side drawer | Custom overlay system | Fixed-position div pattern (existing in project) | Already proven in task-detail-panel.tsx and profile-editor-drawer.tsx |
| Encryption/decryption | New crypto approach | Existing AES-256-GCM in packages/core/crypto/encryption.ts | Already battle-tested, handles IV/auth-tag correctly |
| Provider catalog | Separate provider list | Existing INTEGRATION_CATALOG from packages/core/integrations/catalog.ts | Already has 15 providers with names, categories, logos |
| Toast notifications | Custom notification system | sonner (already installed and used throughout) | Project standard |

**Key insight:** The existing integration catalog and secrets infrastructure provide 80% of what's needed. The main new work is the provider_credential_fields table, the dynamic form rendering, and the Settings page layout.

## Common Pitfalls

### Pitfall 1: Secrets Table Schema Mismatch
**What goes wrong:** Current secrets have a flat `key` field (e.g., "OPENAI_API_KEY") without a `provider` column. Grouping by provider requires linking secrets to their provider.
**Why it happens:** Secrets were designed as generic key-value pairs in Phase 3, not provider-scoped.
**How to avoid:** Add a `provider` column to the secrets table (nullable for backward compatibility with existing secrets). New secrets always set `provider`. Query with `WHERE provider = 'hubspot'` to group.
**Warning signs:** Existing secrets without a provider value -- handle gracefully with "Uncategorized" fallback group.

### Pitfall 2: Unique Constraint on Secrets
**What goes wrong:** Current unique index is on `(business_id, key)`. Two providers could need the same key name (e.g., both need "API_KEY").
**Why it happens:** Keys were global per business, not scoped per provider.
**How to avoid:** Either (a) prefix keys with provider name (e.g., "HUBSPOT_API_KEY") which is the current convention, or (b) change the unique constraint to `(business_id, provider, field_name)`. Option (b) is cleaner for the new integration-first flow.
**Warning signs:** Duplicate key errors when saving credentials for a second provider.

### Pitfall 3: Side Drawer Z-Index Conflicts
**What goes wrong:** Side drawer on Integrations page may render behind dialogs or dropdowns.
**Why it happens:** Multiple overlay components competing for z-index.
**How to avoid:** Use z-50 for the drawer (matching existing pattern in task-detail-panel.tsx). Ensure the backdrop overlay catches clicks outside.
**Warning signs:** Drawer appears but clicks pass through to content behind it.

### Pitfall 4: Eye Toggle Server Roundtrip Latency
**What goes wrong:** Clicking eye toggle calls server to decrypt, causing noticeable delay.
**Why it happens:** Decryption requires ENCRYPTION_KEY which is server-side only.
**How to avoid:** Show a brief loading state on the field while decrypting. Cache the decrypted value client-side for the 5-second reveal window so re-toggling doesn't hit the server again.
**Warning signs:** Sluggish UI when clicking eye icon.

### Pitfall 5: Settings Page Route vs Existing Secrets Route
**What goes wrong:** The existing `/settings/secrets` page conflicts with the new `/settings` page structure.
**Why it happens:** Secrets page already exists under settings path.
**How to avoid:** Make `/settings` the main Settings page with Emergency Controls and Secrets as sections (tabs or scroll sections). The existing `/settings/secrets` route can redirect to `/settings#secrets` or be removed entirely since secrets are now a section on the Settings page.
**Warning signs:** Two different places showing secrets, confusing navigation.

## Code Examples

### Provider Credential Fields Table Schema
```sql
-- 039_provider_credential_fields.sql
CREATE TABLE IF NOT EXISTS public.provider_credential_fields (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  provider text NOT NULL,           -- matches INTEGRATION_CATALOG id: "hubspot", "slack", etc.
  field_name text NOT NULL,         -- internal key: "api_key", "client_id", "webhook_url"
  field_type text NOT NULL DEFAULT 'password'
    CHECK (field_type IN ('password', 'text', 'url')),
  display_label text NOT NULL,      -- UI label: "API Key", "Client ID", "Webhook URL"
  placeholder text,                 -- Input placeholder text
  help_text text,                   -- Help text below the field
  field_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Unique: one field definition per provider + field_name
CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_fields_unique
  ON public.provider_credential_fields (provider, field_name);

-- Index for provider lookups
CREATE INDEX IF NOT EXISTS idx_provider_fields_provider
  ON public.provider_credential_fields (provider);

-- Make globally readable (field definitions are not sensitive)
ALTER TABLE public.provider_credential_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "provider_fields_select_all"
  ON public.provider_credential_fields FOR SELECT
  TO authenticated
  USING (true);

-- Only service_role can INSERT/UPDATE/DELETE (admin seeding)
```

### Secrets Table Migration (Add Provider Column)
```sql
-- 040_secrets_provider_column.sql
ALTER TABLE public.secrets ADD COLUMN IF NOT EXISTS provider text;

-- New unique constraint: one field per provider per business
-- Keep old constraint for backward compat with existing non-provider secrets
CREATE UNIQUE INDEX IF NOT EXISTS idx_secrets_business_provider_field
  ON public.secrets (business_id, provider, key) WHERE provider IS NOT NULL;
```

### Seed Data for Provider Credential Fields
```sql
-- Example seed data (would be inserted via migration or admin tool)
INSERT INTO provider_credential_fields (provider, field_name, field_type, display_label, placeholder, help_text, field_order) VALUES
  -- HubSpot (API key only)
  ('hubspot', 'api_key', 'password', 'API Key', 'Enter HubSpot API key', 'Found in Settings > Integrations > API key', 1),
  -- Salesforce (instance URL + client ID + client secret)
  ('salesforce', 'instance_url', 'url', 'Instance URL', 'https://yourorg.salesforce.com', 'Your Salesforce org URL', 1),
  ('salesforce', 'client_id', 'text', 'Client ID', 'Enter Connected App Client ID', 'From Setup > App Manager', 2),
  ('salesforce', 'client_secret', 'password', 'Client Secret', 'Enter Connected App Secret', 'From Setup > App Manager', 3),
  -- SendGrid (API key only)
  ('sendgrid', 'api_key', 'password', 'API Key', 'SG.xxxx...', 'Full access or restricted API key', 1),
  -- Slack (bot token + signing secret)
  ('slack', 'bot_token', 'password', 'Bot Token', 'xoxb-xxxx...', 'Bot User OAuth Token from app settings', 1),
  ('slack', 'signing_secret', 'password', 'Signing Secret', 'Enter signing secret', 'From Basic Information > App Credentials', 2),
  -- Zendesk (subdomain + email + API token)
  ('zendesk', 'subdomain', 'text', 'Subdomain', 'yourcompany', 'yourcompany.zendesk.com', 1),
  ('zendesk', 'email', 'text', 'Admin Email', 'admin@company.com', 'Email of the API user', 2),
  ('zendesk', 'api_token', 'password', 'API Token', 'Enter API token', 'From Admin > Channels > API', 3)
  -- ... more providers
ON CONFLICT DO NOTHING;
```

### Dynamic Credential Form Component Pattern
```typescript
// credential-form.tsx
interface CredentialField {
  field_name: string;
  field_type: string;
  display_label: string;
  placeholder: string | null;
  help_text: string | null;
}

interface CredentialFormProps {
  provider: string;
  fields: CredentialField[];
  existingValues: Record<string, string>; // field_name -> masked or empty
  onSave: (values: Record<string, string>) => Promise<void>;
  onTestConnection: () => Promise<void>;
}

// Render Input for each field based on field_type
// All fields required (per user decision)
// Save button + Test Connection button
```

### Reveal Secret Server Action
```typescript
// In secrets-actions.ts
export async function revealSecretAction(businessId: string, secretId: string) {
  const supabase = await createServerClient();
  // Auth check...
  const { data } = await supabase
    .from("secrets")
    .select("encrypted_value")
    .eq("id", secretId)
    .eq("business_id", businessId)
    .single();

  if (!data) return { error: "Secret not found" };

  const plaintext = decrypt(data.encrypted_value);
  return { value: plaintext };
}
```

### Test Connection Pattern (Mostly Mock)
```typescript
// test-connection.ts
export async function testConnection(
  provider: string,
  credentials: Record<string, string>
): Promise<{ success: boolean; message: string }> {
  // For MVP, most providers return mock success
  // Real tests for providers with simple API key validation:
  switch (provider) {
    case "sendgrid":
      // Real: fetch("https://api.sendgrid.com/v3/scopes", { headers: { Authorization: `Bearer ${credentials.api_key}` } })
      return { success: true, message: "Connection verified (mock)" };
    default:
      return { success: true, message: "Connection verified (mock)" };
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Generic key/value secrets | Provider-scoped credential groups | This phase | Secrets grouped by provider, dynamic fields |
| Gear dropdown (Emergency Controls only) | Full Settings page | This phase | Settings becomes a proper page with sections |
| Secrets buried under Deployments | Secrets on Settings page + Integrations drawer | This phase | Two clear entry points for credential management |
| Category-based grouping (api_key/credential/token) | Provider-based grouping (HubSpot/Slack/etc.) | This phase | More intuitive for users |

## Open Questions

1. **Backward compatibility for existing secrets**
   - What we know: Existing secrets have no `provider` column, using flat key names like "OPENAI_API_KEY"
   - What's unclear: Whether to migrate existing secrets to provider-scoped format or show them in an "Uncategorized" section
   - Recommendation: Show existing provider-less secrets in a "Legacy / Uncategorized" section at the bottom of the Secrets page. Don't auto-migrate -- let users re-enter via the new provider flow.

2. **Test Connection scope**
   - What we know: User wants "Test Connection" button after credentials are saved
   - What's unclear: Which providers should have real API pings vs mock
   - Recommendation: All providers return mock "Connection verified" for now. Add real pings for SendGrid and HubSpot if time permits (simple API key validation endpoints). Flag as "mock test" in the UI with a subtle indicator.

3. **Settings page routing**
   - What we know: Settings page needs Emergency Controls + Secrets sections; accessible from sidebar and gear icon
   - What's unclear: Whether to use tabs, scroll sections, or sub-routes
   - Recommendation: Single page with scroll sections (anchored with `id` attributes). Simple, no extra routing complexity. Emergency Controls section at top, Secrets section below.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `packages/db/schema/013_secrets_table.sql` -- current secrets schema
- Codebase inspection: `packages/db/schema/014_integrations_table.sql` -- current integrations schema
- Codebase inspection: `packages/core/secrets/service.ts` -- existing CRUD + encrypt/decrypt
- Codebase inspection: `packages/core/crypto/encryption.ts` -- AES-256-GCM implementation
- Codebase inspection: `packages/core/integrations/catalog.ts` -- 15 providers already defined
- Codebase inspection: `apps/web/_components/secrets-manager.tsx` -- current secrets UI
- Codebase inspection: `apps/web/_components/health-dashboard.tsx` -- current gear dropdown with Emergency Controls
- Codebase inspection: `apps/web/_components/emergency-controls.tsx` -- emergency controls component
- Codebase inspection: `apps/web/_components/sidebar-nav.tsx` -- current navigation structure
- Codebase inspection: `apps/web/_components/task-detail-panel.tsx` -- fixed-position side panel pattern
- Codebase inspection: `apps/web/_components/profile-editor-drawer.tsx` -- drawer pattern

### Secondary (MEDIUM confidence)
- Phase 12 research (`12-RESEARCH.md`) -- integration catalog architecture, department inheritance

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, no new dependencies
- Architecture: HIGH -- patterns well-established in codebase (side drawers, collapsible cards, server actions with encryption)
- Pitfalls: HIGH -- identified from direct codebase inspection of schema constraints and existing component patterns

**Research date:** 2026-03-29
**Valid until:** 2026-04-28 (stable -- no external library dependencies to change)
