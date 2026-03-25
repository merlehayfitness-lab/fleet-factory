-- 009_rls_helpers.sql
-- Security definer functions for RLS policy evaluation.
-- These functions check business membership and role with tenant kill switch support.

-- Check if current user is a member of the given business
-- Returns false if business is disabled (kill switch)
CREATE OR REPLACE FUNCTION public.is_business_member(p_business_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.business_users bu
    JOIN public.businesses b ON b.id = bu.business_id
    WHERE bu.user_id = (SELECT auth.uid())
      AND bu.business_id = p_business_id
      AND b.status != 'disabled'
  );
$$;

-- Check if current user has a specific role on a business
-- If p_role is NULL, any role matches (acts like is_business_member)
-- Returns false if business is disabled (kill switch)
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
    JOIN public.businesses b ON b.id = bu.business_id
    WHERE bu.user_id = (SELECT auth.uid())
      AND bu.business_id = p_business_id
      AND b.status != 'disabled'
      AND (p_role IS NULL OR bu.role = p_role)
  );
$$;
