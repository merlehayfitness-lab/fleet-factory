-- 011_agent_frozen_status.sql
-- Add 'frozen' lifecycle status to agents table for emergency freeze control (AGNT-05)
ALTER TABLE public.agents
  DROP CONSTRAINT IF EXISTS agents_status_check;

ALTER TABLE public.agents
  ADD CONSTRAINT agents_status_check
  CHECK (status IN ('provisioning', 'active', 'paused', 'frozen', 'error', 'retired'));
