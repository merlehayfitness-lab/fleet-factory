-- 043: Add subdomain column to businesses
-- Supports per-tenant subdomain routing (e.g. acme.fleetfactory.ai)

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS subdomain text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_businesses_subdomain
  ON public.businesses (subdomain) WHERE subdomain IS NOT NULL;

COMMENT ON COLUMN public.businesses.subdomain IS 'Tenant subdomain for portal access e.g. acme.fleetfactory.ai';
