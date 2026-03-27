-- 027: VPS Status Table
-- Singleton table tracking shared VPS health state.
-- One row represents the current status of the VPS deployment target.

CREATE TABLE IF NOT EXISTS public.vps_status (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  status text NOT NULL DEFAULT 'unknown'
    CHECK (status IN ('online', 'offline', 'degraded', 'unknown')),
  last_checked_at timestamptz DEFAULT now(),
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.vps_status ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read VPS status
CREATE POLICY "vps_status_select" ON public.vps_status FOR SELECT
  TO authenticated USING (true);

-- Only service role should update (via Server Actions with service client)
-- For now, allow any authenticated user to update (single-admin MVP)
CREATE POLICY "vps_status_update" ON public.vps_status FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "vps_status_insert" ON public.vps_status FOR INSERT
  TO authenticated WITH CHECK (true);

-- Seed with initial unknown status row
INSERT INTO public.vps_status (status, details)
VALUES ('unknown', '{"message": "VPS status not yet checked"}')
ON CONFLICT DO NOTHING;
