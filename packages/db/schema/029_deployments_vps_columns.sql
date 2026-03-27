-- 029: Deployments VPS Columns
-- Add VPS deployment tracking columns to existing deployments table.

ALTER TABLE public.deployments
  ADD COLUMN IF NOT EXISTS optimization_report jsonb,
  ADD COLUMN IF NOT EXISTS deploy_target text DEFAULT 'local'
    CHECK (deploy_target IN ('local', 'vps')),
  ADD COLUMN IF NOT EXISTS vps_deploy_id text;
