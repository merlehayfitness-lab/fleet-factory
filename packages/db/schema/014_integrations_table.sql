-- 014: Integrations table for per-agent integration config
CREATE TABLE IF NOT EXISTS public.integrations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'mock',
  type text NOT NULL
    CHECK (type IN ('crm', 'email', 'helpdesk', 'calendar', 'messaging')),
  config jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'mock'
    CHECK (status IN ('active', 'inactive', 'mock')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_integrations_business
  ON public.integrations (business_id);

CREATE INDEX IF NOT EXISTS idx_integrations_agent
  ON public.integrations (agent_id);

DROP TRIGGER IF EXISTS set_integrations_updated_at ON public.integrations;
CREATE TRIGGER set_integrations_updated_at BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS policies
CREATE POLICY "integrations_select_member"
  ON public.integrations FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

CREATE POLICY "integrations_insert_admin"
  ON public.integrations FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role_on_business(business_id, 'owner') OR public.has_role_on_business(business_id, 'admin'));

CREATE POLICY "integrations_update_admin"
  ON public.integrations FOR UPDATE
  TO authenticated
  USING (public.has_role_on_business(business_id, 'owner') OR public.has_role_on_business(business_id, 'admin'))
  WITH CHECK (public.has_role_on_business(business_id, 'owner') OR public.has_role_on_business(business_id, 'admin'));

CREATE POLICY "integrations_delete_admin"
  ON public.integrations FOR DELETE
  TO authenticated
  USING (public.has_role_on_business(business_id, 'owner') OR public.has_role_on_business(business_id, 'admin'));
