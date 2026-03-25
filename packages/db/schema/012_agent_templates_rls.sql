-- 012_agent_templates_rls.sql
-- Platform admin helper and template write policies (AGNT-01 CRUD support)

-- Platform admin check: any user who is an owner of at least one business
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_users bu
    WHERE bu.user_id = (SELECT auth.uid())
      AND bu.role = 'owner'
  );
$$;

-- Template write policies
CREATE POLICY "agent_templates_insert_admin"
  ON public.agent_templates FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "agent_templates_update_admin"
  ON public.agent_templates FOR UPDATE
  TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "agent_templates_delete_admin"
  ON public.agent_templates FOR DELETE
  TO authenticated
  USING (public.is_platform_admin());
