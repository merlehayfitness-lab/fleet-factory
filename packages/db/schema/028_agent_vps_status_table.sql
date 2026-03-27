-- 028: Agent VPS Status Table
-- Per-agent VPS runtime status tracking.
-- Maps internal agent_id to vps_agent_id and tracks container health.

CREATE TABLE IF NOT EXISTS public.agent_vps_status (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL REFERENCES public.agents ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  vps_agent_id text NOT NULL,
  container_status text DEFAULT 'unknown'
    CHECK (container_status IN ('running', 'stopped', 'error', 'unknown')),
  last_health_check_at timestamptz,
  last_response_at timestamptz,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.agent_vps_status ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_agent_vps_status_business ON public.agent_vps_status (business_id);
CREATE INDEX IF NOT EXISTS idx_agent_vps_status_agent ON public.agent_vps_status (agent_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_vps_status_unique ON public.agent_vps_status (agent_id);

CREATE POLICY "agent_vps_status_select" ON public.agent_vps_status FOR SELECT
  TO authenticated USING (public.is_business_member(business_id));

CREATE POLICY "agent_vps_status_insert" ON public.agent_vps_status FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );

CREATE POLICY "agent_vps_status_update" ON public.agent_vps_status FOR UPDATE
  TO authenticated
  USING (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  )
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );
