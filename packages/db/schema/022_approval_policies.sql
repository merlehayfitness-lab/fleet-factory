-- 022: Approval Policies table
-- Global approval policy rules that determine risk levels for agent actions.
-- Seeded with default policies covering common action categories.

CREATE TABLE IF NOT EXISTS public.approval_policies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  action_pattern text NOT NULL,
  risk_level text NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  description text,
  category text NOT NULL DEFAULT 'general'
    CHECK (category IN ('data_read', 'data_write', 'external_comm', 'config_change', 'destructive', 'financial', 'general')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.approval_policies ENABLE ROW LEVEL SECURITY;

-- Global table: all authenticated users can read, only service/admin can write
CREATE POLICY "policies_select_all" ON public.approval_policies FOR SELECT
  TO authenticated USING (true);

-- Seed default policies
INSERT INTO public.approval_policies (action_pattern, risk_level, description, category) VALUES
  ('search_%', 'low', 'Search and lookup operations', 'data_read'),
  ('review_%', 'low', 'Review and read operations', 'data_read'),
  ('check_%', 'low', 'Status checks and diagnostics', 'data_read'),
  ('draft_%', 'medium', 'Draft creation (not sent)', 'data_write'),
  ('create_%', 'medium', 'Record creation', 'data_write'),
  ('generate_%', 'medium', 'Report and content generation', 'data_write'),
  ('run_%', 'medium', 'Run diagnostics or processes', 'data_write'),
  ('send_%', 'high', 'Send external communications', 'external_comm'),
  ('respond_%', 'high', 'Respond to external parties', 'external_comm'),
  ('update_%', 'high', 'Update existing records or configs', 'config_change'),
  ('close_%', 'high', 'Close or resolve records', 'destructive'),
  ('delete_%', 'high', 'Delete records', 'destructive'),
  ('schedule_%', 'high', 'Schedule operations or maintenance', 'config_change')
ON CONFLICT DO NOTHING;
