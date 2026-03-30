-- 040: Add provider column to secrets table
-- Enables provider-scoped credential grouping (e.g. all HubSpot credentials together).

ALTER TABLE public.secrets ADD COLUMN IF NOT EXISTS provider text;

-- Provider-scoped uniqueness: one value per field per provider per business
CREATE UNIQUE INDEX IF NOT EXISTS idx_secrets_business_provider_field
  ON public.secrets (business_id, provider, key) WHERE provider IS NOT NULL;

-- Keep existing idx_secrets_business_key for backward compatibility with legacy secrets
