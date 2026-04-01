-- 052: Add 'verifying' to deployments status check constraint.
-- The verifying stage runs post-deploy health checks before transitioning to live.

ALTER TABLE public.deployments
  DROP CONSTRAINT IF EXISTS deployments_status_check;

ALTER TABLE public.deployments
  ADD CONSTRAINT deployments_status_check
  CHECK (status IN ('queued', 'building', 'deploying', 'verifying', 'live', 'failed', 'rolled_back'));
