-- 009_rls_helpers.sql
-- Security definer functions for RLS policy evaluation.
-- These functions check business membership and role.
--
-- NOTE: Disabled businesses are still visible to members (frozen dashboard).
-- Mutation blocking is enforced at the application layer via requireActiveBusiness().

-- Check if current user is a member of the given business
CREATE OR REPLACE FUNCTION public.is_business_member(p_business_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.business_users bu
    WHERE bu.user_id = (SELECT auth.uid())
      AND bu.business_id = p_business_id
  );
$$;

-- Check if current user has a specific role on a business
-- If p_role is NULL, any role matches (acts like is_business_member)
CREATE OR REPLACE FUNCTION public.has_role_on_business(
  p_business_id uuid,
  p_role text DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.business_users bu
    WHERE bu.user_id = (SELECT auth.uid())
      AND bu.business_id = p_business_id
      AND (p_role IS NULL OR bu.role = p_role)
  );
$$;
