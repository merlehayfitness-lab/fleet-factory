-- ====== 035: Make template_id nullable for wizard-created agents ======
ALTER TABLE public.agents
  ALTER COLUMN template_id DROP NOT NULL;
