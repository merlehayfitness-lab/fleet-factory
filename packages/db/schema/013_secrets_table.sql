-- 013: Secrets table for encrypted credential storage
CREATE TABLE IF NOT EXISTS public.secrets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  key text NOT NULL,
  encrypted_value text NOT NULL,
  category text NOT NULL DEFAULT 'api_key'
    CHECK (category IN ('api_key', 'credential', 'token')),
  integration_type text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.secrets ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_secrets_business_key
  ON public.secrets (business_id, key);

DROP TRIGGER IF EXISTS set_secrets_updated_at ON public.secrets;
CREATE TRIGGER set_secrets_updated_at BEFORE UPDATE ON public.secrets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: members can SELECT (encrypted value is opaque), owner/admin can INSERT/UPDATE/DELETE
CREATE POLICY "secrets_select_member"
  ON public.secrets FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

CREATE POLICY "secrets_insert_admin"
  ON public.secrets FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role_on_business(business_id, 'owner') OR public.has_role_on_business(business_id, 'admin'));

CREATE POLICY "secrets_update_admin"
  ON public.secrets FOR UPDATE
  TO authenticated
  USING (public.has_role_on_business(business_id, 'owner') OR public.has_role_on_business(business_id, 'admin'))
  WITH CHECK (public.has_role_on_business(business_id, 'owner') OR public.has_role_on_business(business_id, 'admin'));

CREATE POLICY "secrets_delete_admin"
  ON public.secrets FOR DELETE
  TO authenticated
  USING (public.has_role_on_business(business_id, 'owner') OR public.has_role_on_business(business_id, 'admin'));
