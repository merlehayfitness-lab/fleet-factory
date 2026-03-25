-- 010_rls_policies.sql
-- RLS policies for all tables. Enforces tenant isolation via is_business_member()
-- and role-based access via has_role_on_business().

-- ============================================================================
-- BUSINESSES
-- ============================================================================

-- Members can view their businesses
CREATE POLICY "businesses_select_member"
  ON public.businesses FOR SELECT
  TO authenticated
  USING (public.is_business_member(id));

-- Any authenticated user can create a business
CREATE POLICY "businesses_insert_authenticated"
  ON public.businesses FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Only owners can update their business
CREATE POLICY "businesses_update_owner"
  ON public.businesses FOR UPDATE
  TO authenticated
  USING (public.has_role_on_business(id, 'owner'))
  WITH CHECK (public.has_role_on_business(id, 'owner'));

-- Only owners can delete their business
CREATE POLICY "businesses_delete_owner"
  ON public.businesses FOR DELETE
  TO authenticated
  USING (public.has_role_on_business(id, 'owner'));

-- ============================================================================
-- PROFILES
-- ============================================================================

-- Users can view their own profile
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- BUSINESS_USERS
-- ============================================================================

-- Members can view other members of their business
CREATE POLICY "business_users_select_member"
  ON public.business_users FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

-- Only owners can add members
CREATE POLICY "business_users_insert_owner"
  ON public.business_users FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role_on_business(business_id, 'owner'));

-- Only owners can update member roles
CREATE POLICY "business_users_update_owner"
  ON public.business_users FOR UPDATE
  TO authenticated
  USING (public.has_role_on_business(business_id, 'owner'))
  WITH CHECK (public.has_role_on_business(business_id, 'owner'));

-- Only owners can remove members
CREATE POLICY "business_users_delete_owner"
  ON public.business_users FOR DELETE
  TO authenticated
  USING (public.has_role_on_business(business_id, 'owner'));

-- ============================================================================
-- DEPARTMENTS
-- ============================================================================

-- Members can view departments in their business
CREATE POLICY "departments_select_member"
  ON public.departments FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

-- Owners and admins can create departments
CREATE POLICY "departments_insert_owner_admin"
  ON public.departments FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );

-- Owners and admins can update departments
CREATE POLICY "departments_update_owner_admin"
  ON public.departments FOR UPDATE
  TO authenticated
  USING (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  )
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );

-- Owners and admins can delete departments
CREATE POLICY "departments_delete_owner_admin"
  ON public.departments FOR DELETE
  TO authenticated
  USING (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );

-- ============================================================================
-- AGENT_TEMPLATES
-- ============================================================================

-- All authenticated users can read templates (globally readable)
CREATE POLICY "agent_templates_select_authenticated"
  ON public.agent_templates FOR SELECT
  TO authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE policies for regular users.
-- Admin operations use service_role client (server-side only).

-- ============================================================================
-- AGENTS
-- ============================================================================

-- Members can view agents in their business
CREATE POLICY "agents_select_member"
  ON public.agents FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

-- Owners and admins can create agents
CREATE POLICY "agents_insert_owner_admin"
  ON public.agents FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );

-- Owners and admins can update agents
CREATE POLICY "agents_update_owner_admin"
  ON public.agents FOR UPDATE
  TO authenticated
  USING (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  )
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );

-- Owners and admins can delete agents
CREATE POLICY "agents_delete_owner_admin"
  ON public.agents FOR DELETE
  TO authenticated
  USING (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );

-- ============================================================================
-- DEPLOYMENTS
-- ============================================================================

-- Members can view deployments in their business
CREATE POLICY "deployments_select_member"
  ON public.deployments FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

-- Owners and admins can create deployments
CREATE POLICY "deployments_insert_owner_admin"
  ON public.deployments FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );

-- Owners and admins can update deployments
CREATE POLICY "deployments_update_owner_admin"
  ON public.deployments FOR UPDATE
  TO authenticated
  USING (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  )
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );

-- ============================================================================
-- AUDIT_LOGS
-- ============================================================================

-- Members can view audit logs in their business
CREATE POLICY "audit_logs_select_member"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

-- Authenticated users can insert audit logs (actions log themselves)
CREATE POLICY "audit_logs_insert_authenticated"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_business_member(business_id));

-- No UPDATE or DELETE policies -- audit logs are immutable
