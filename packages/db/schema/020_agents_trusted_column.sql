-- 020: Add is_trusted column to agents
-- Trusted agents can auto-approve medium-risk tool executions without human approval.
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS is_trusted boolean DEFAULT false;
