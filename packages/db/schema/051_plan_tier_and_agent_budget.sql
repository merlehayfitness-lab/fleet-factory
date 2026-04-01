-- 051: Plan tier, agent budgets, key_source tracking, usage_records cleanup
-- Adds plan_tier and monthly_token_limit to businesses, token_budget to agents,
-- key_source to api_usage, get_plan_limits() function, and drops usage_records.

-- 1. Add plan_tier to businesses
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS plan_tier text NOT NULL DEFAULT 'pro'
    CHECK (plan_tier IN ('trial', 'starter', 'pro', 'enterprise'));
COMMENT ON COLUMN public.businesses.plan_tier IS 'Subscription tier determining concurrency and token limits';

-- 2. Add monthly_token_limit to businesses
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS monthly_token_limit integer DEFAULT 3000000;
COMMENT ON COLUMN public.businesses.monthly_token_limit IS 'Monthly token cap from plan tier (null = unlimited for enterprise)';

-- 3. Add token_budget to agents
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS token_budget integer DEFAULT NULL;
COMMENT ON COLUMN public.agents.token_budget IS 'Per-agent monthly token budget override (null = use template default)';

-- 4. Add key_source to api_usage
ALTER TABLE public.api_usage
  ADD COLUMN IF NOT EXISTS key_source text DEFAULT NULL;
COMMENT ON COLUMN public.api_usage.key_source IS 'Which API key was used: platform or business';

-- 5. Plan tier defaults function
CREATE OR REPLACE FUNCTION public.get_plan_limits(tier text)
RETURNS jsonb
STABLE
LANGUAGE sql
AS $$
  SELECT CASE tier
    WHEN 'trial' THEN '{"max_concurrent": 1, "monthly_tokens": 100000}'::jsonb
    WHEN 'starter' THEN '{"max_concurrent": 3, "monthly_tokens": 1000000}'::jsonb
    WHEN 'pro' THEN '{"max_concurrent": 5, "monthly_tokens": 3000000}'::jsonb
    WHEN 'enterprise' THEN '{"max_concurrent": 10, "monthly_tokens": null}'::jsonb
    ELSE '{"max_concurrent": 3, "monthly_tokens": 1000000}'::jsonb
  END
$$;

-- 6. Drop usage_records table (replaced by api_usage)
DROP POLICY IF EXISTS "usage_select_member" ON public.usage_records;
DROP POLICY IF EXISTS "usage_insert_admin" ON public.usage_records;
DROP TABLE IF EXISTS public.usage_records;
