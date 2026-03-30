-- 040: Add provider column to secrets table
-- Enables provider-scoped credential grouping (e.g. all HubSpot credentials together).

ALTER TABLE public.secrets ADD COLUMN IF NOT EXISTS provider text;

-- Provider-scoped uniqueness: one value per field per provider per business
-- Must NOT be a partial index (WHERE clause) or ON CONFLICT won't match it.
-- NULLs in provider are naturally distinct in unique indexes, so legacy secrets are safe.
CREATE UNIQUE INDEX IF NOT EXISTS idx_secrets_business_provider_key
  ON public.secrets (business_id, provider, key);

-- Keep existing idx_secrets_business_key for backward compatibility with legacy secrets
