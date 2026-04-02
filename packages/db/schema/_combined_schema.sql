-- Combined schema for Fleet Factory
-- Paste this entire file into Supabase SQL Editor and run it.

-- ====== 001_businesses.sql ======
-- 001_businesses.sql
-- Tenant root table. Every business is an isolated tenant.

CREATE TABLE IF NOT EXISTS public.businesses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  industry text DEFAULT 'general',
  status text NOT NULL DEFAULT 'provisioning'
    CHECK (status IN ('provisioning', 'active', 'suspended', 'disabled')),
  vps_config jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS immediately
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_businesses_updated_at ON public.businesses;
CREATE TRIGGER set_businesses_updated_at
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- ====== 002_profiles.sql ======
-- 002_profiles.sql
-- User profiles, auto-created on auth.users signup via trigger.

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS immediately
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Auto-update updated_at
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', '')
  );
  RETURN NEW;
END;
$$;

-- Trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ====== 003_business_users.sql ======
-- 003_business_users.sql
-- Links users to businesses with role-based access.

CREATE TABLE IF NOT EXISTS public.business_users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'member')),
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (business_id, user_id)
);

-- Enable RLS immediately
ALTER TABLE public.business_users ENABLE ROW LEVEL SECURITY;

-- Composite index for membership lookups
CREATE INDEX IF NOT EXISTS idx_business_users_business_user
  ON public.business_users (business_id, user_id);


-- ====== 004_departments.sql ======
-- 004_departments.sql
-- Departments within a business tenant.

CREATE TABLE IF NOT EXISTS public.departments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('owner', 'sales', 'support', 'operations', 'custom')),
  description text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS immediately
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Composite index for department lookups by business and type
CREATE INDEX IF NOT EXISTS idx_departments_business_type
  ON public.departments (business_id, type);

-- Auto-update updated_at
DROP TRIGGER IF EXISTS set_departments_updated_at ON public.departments;
CREATE TRIGGER set_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- ====== 005_agent_templates.sql ======
-- 005_agent_templates.sql
-- Global agent templates. Readable by all authenticated users, writable only via service_role.

CREATE TABLE IF NOT EXISTS public.agent_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  department_type text NOT NULL,
  description text,
  system_prompt text NOT NULL,
  tool_profile jsonb DEFAULT '{}',
  model_profile jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS immediately
ALTER TABLE public.agent_templates ENABLE ROW LEVEL SECURITY;

-- Index for template lookup by department type
CREATE INDEX IF NOT EXISTS idx_agent_templates_department_type
  ON public.agent_templates (department_type);

-- Auto-update updated_at
DROP TRIGGER IF EXISTS set_agent_templates_updated_at ON public.agent_templates;
CREATE TRIGGER set_agent_templates_updated_at
  BEFORE UPDATE ON public.agent_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed starter templates (one per department type)
INSERT INTO public.agent_templates (name, department_type, description, system_prompt, tool_profile, model_profile)
VALUES
  (
    'Owner Agent',
    'owner',
    'Business owner oversight and strategy agent',
    'You are an owner agent for {{business_name}}. You help with business oversight, strategy, and high-level decision making.',
    '{}',
    '{}'
  ),
  (
    'Sales Agent',
    'sales',
    'Lead generation, outreach, and deal management agent',
    'You are a sales agent for {{business_name}}. You help with lead generation, outreach, and deal management.',
    '{}',
    '{}'
  ),
  (
    'Support Agent',
    'support',
    'Customer support and ticket resolution agent',
    'You are a support agent for {{business_name}}. You help with customer support and ticket resolution.',
    '{}',
    '{}'
  ),
  (
    'Operations Agent',
    'operations',
    'Internal operations, scheduling, and process management agent',
    'You are an operations agent for {{business_name}}. You help with internal operations, scheduling, and process management.',
    '{}',
    '{}'
  )
ON CONFLICT DO NOTHING;


-- ====== 006_agents.sql ======
-- 006_agents.sql
-- Agents instantiated from templates, scoped to a business and department.

CREATE TABLE IF NOT EXISTS public.agents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.agent_templates,
  name text NOT NULL,
  system_prompt text NOT NULL,
  tool_profile jsonb DEFAULT '{}',
  model_profile jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'provisioning'
    CHECK (status IN ('provisioning', 'active', 'paused', 'error', 'retired')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS immediately
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

-- Composite index for agent lookups by business and department
CREATE INDEX IF NOT EXISTS idx_agents_business_department
  ON public.agents (business_id, department_id);

-- Auto-update updated_at
DROP TRIGGER IF EXISTS set_agents_updated_at ON public.agents;
CREATE TRIGGER set_agents_updated_at
  BEFORE UPDATE ON public.agents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- ====== 007_deployments.sql ======
-- 007_deployments.sql
-- Deployment records for each business tenant.

CREATE TABLE IF NOT EXISTS public.deployments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'building', 'deploying', 'verifying', 'live', 'failed', 'rolled_back')),
  config_snapshot jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS immediately
ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;

-- Index for deployment lookups by business, ordered by creation
CREATE INDEX IF NOT EXISTS idx_deployments_business_created
  ON public.deployments (business_id, created_at DESC);


-- ====== 008_audit_logs.sql ======
-- 008_audit_logs.sql
-- Audit trail for important actions within a business.

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS immediately
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Index for log lookups by business, ordered by creation
CREATE INDEX IF NOT EXISTS idx_audit_logs_business_created
  ON public.audit_logs (business_id, created_at DESC);

-- Index for filtering logs by action within a business
CREATE INDEX IF NOT EXISTS idx_audit_logs_business_action
  ON public.audit_logs (business_id, action);


-- ====== 009_rls_helpers.sql ======
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


-- ====== 010_provision_rpc.sql ======
-- provision_business_tenant() -- Atomic tenant provisioning RPC
--
-- Creates a complete business tenant in a single transaction:
-- 1. Business record
-- 2. Owner membership
-- 3. 4 default departments (Owner, Sales, Support, Operations)
-- 4. Starter agents from agent_templates
-- 5. Queued deployment job
--
-- Idempotent: returns existing business_id if slug already exists for the user.
-- Called via supabase.rpc('provision_business_tenant', { p_name, p_slug, p_industry })

CREATE OR REPLACE FUNCTION public.provision_business_tenant(
  p_name text,
  p_slug text,
  p_industry text DEFAULT 'general'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_business_id uuid;
  v_existing_id uuid;
  v_dept_types text[] := ARRAY['owner', 'sales', 'support', 'operations'];
  v_dept_type text;
  v_dept_id uuid;
  v_template RECORD;
BEGIN
  -- Must be authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Idempotency check (PROV-06): return existing business if slug matches for this owner
  SELECT b.id INTO v_existing_id
  FROM public.businesses b
  JOIN public.business_users bu ON bu.business_id = b.id
  WHERE b.slug = p_slug
    AND bu.user_id = v_user_id
    AND bu.role = 'owner';

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  -- 1. Create business with status = 'provisioning'
  INSERT INTO public.businesses (name, slug, industry, status)
  VALUES (p_name, p_slug, p_industry, 'provisioning')
  RETURNING id INTO v_business_id;

  -- 2. Create owner membership
  INSERT INTO public.business_users (business_id, user_id, role)
  VALUES (v_business_id, v_user_id, 'owner');

  -- 3. Seed departments + 4. Create agents from templates
  FOREACH v_dept_type IN ARRAY v_dept_types LOOP
    INSERT INTO public.departments (business_id, name, type)
    VALUES (v_business_id, initcap(v_dept_type), v_dept_type)
    RETURNING id INTO v_dept_id;

    -- Create agents from matching active templates
    FOR v_template IN
      SELECT * FROM public.agent_templates
      WHERE department_type = v_dept_type AND is_active = true
    LOOP
      INSERT INTO public.agents (
        business_id, department_id, template_id,
        name, system_prompt, tool_profile, model_profile, status
      ) VALUES (
        v_business_id, v_dept_id, v_template.id,
        v_template.name, v_template.system_prompt,
        v_template.tool_profile, v_template.model_profile, 'provisioning'
      );
    END LOOP;
  END LOOP;

  -- 5. Queue deployment
  INSERT INTO public.deployments (business_id, version, status)
  VALUES (v_business_id, 1, 'queued');

  -- Mark business active
  UPDATE public.businesses SET status = 'active' WHERE id = v_business_id;

  RETURN v_business_id;
END;
$$;


-- ====== 010_rls_policies.sql ======
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


-- ====== 011_agent_frozen_status.sql ======
-- 011_agent_frozen_status.sql
-- Add 'frozen' lifecycle status to agents table for emergency freeze control (AGNT-05)
ALTER TABLE public.agents
  DROP CONSTRAINT IF EXISTS agents_status_check;

ALTER TABLE public.agents
  ADD CONSTRAINT agents_status_check
  CHECK (status IN ('provisioning', 'active', 'paused', 'frozen', 'error', 'retired'));


-- ====== 012_agent_templates_rls.sql ======
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


-- ====== 013_secrets_table.sql ======
-- 013: Secrets table for encrypted credential storage
CREATE TABLE IF NOT EXISTS public.secrets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  key text NOT NULL,
  encrypted_value text NOT NULL,
  category text NOT NULL DEFAULT 'api_key'
    CHECK (category IN ('api_key', 'credential', 'token')),
  integration_type text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.secrets ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_secrets_business_key
  ON public.secrets (business_id, key);

DROP TRIGGER IF EXISTS set_secrets_updated_at ON public.secrets;
CREATE TRIGGER set_secrets_updated_at BEFORE UPDATE ON public.secrets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: members can SELECT (encrypted value is opaque), owner/admin can INSERT/UPDATE/DELETE
CREATE POLICY "secrets_select_member"
  ON public.secrets FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

CREATE POLICY "secrets_insert_admin"
  ON public.secrets FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role_on_business(business_id, 'owner') OR public.has_role_on_business(business_id, 'admin'));

CREATE POLICY "secrets_update_admin"
  ON public.secrets FOR UPDATE
  TO authenticated
  USING (public.has_role_on_business(business_id, 'owner') OR public.has_role_on_business(business_id, 'admin'))
  WITH CHECK (public.has_role_on_business(business_id, 'owner') OR public.has_role_on_business(business_id, 'admin'));

CREATE POLICY "secrets_delete_admin"
  ON public.secrets FOR DELETE
  TO authenticated
  USING (public.has_role_on_business(business_id, 'owner') OR public.has_role_on_business(business_id, 'admin'));


-- ====== 014_integrations_table.sql ======
-- 014: Integrations table for per-agent integration config
CREATE TABLE IF NOT EXISTS public.integrations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'mock',
  type text NOT NULL
    CHECK (type IN ('crm', 'email', 'helpdesk', 'calendar', 'messaging')),
  config jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'mock'
    CHECK (status IN ('active', 'inactive', 'mock')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_integrations_business
  ON public.integrations (business_id);

CREATE INDEX IF NOT EXISTS idx_integrations_agent
  ON public.integrations (agent_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_integrations_business_agent_type
  ON public.integrations (business_id, agent_id, type);

DROP TRIGGER IF EXISTS set_integrations_updated_at ON public.integrations;
CREATE TRIGGER set_integrations_updated_at BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS policies
CREATE POLICY "integrations_select_member"
  ON public.integrations FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

CREATE POLICY "integrations_insert_admin"
  ON public.integrations FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role_on_business(business_id, 'owner') OR public.has_role_on_business(business_id, 'admin'));

CREATE POLICY "integrations_update_admin"
  ON public.integrations FOR UPDATE
  TO authenticated
  USING (public.has_role_on_business(business_id, 'owner') OR public.has_role_on_business(business_id, 'admin'))
  WITH CHECK (public.has_role_on_business(business_id, 'owner') OR public.has_role_on_business(business_id, 'admin'));

CREATE POLICY "integrations_delete_admin"
  ON public.integrations FOR DELETE
  TO authenticated
  USING (public.has_role_on_business(business_id, 'owner') OR public.has_role_on_business(business_id, 'admin'));


-- ====== 015_deployments_columns.sql ======
-- 015: Add triggered_by and rolled_back_to columns to deployments
ALTER TABLE public.deployments
  ADD COLUMN IF NOT EXISTS triggered_by uuid REFERENCES auth.users,
  ADD COLUMN IF NOT EXISTS rolled_back_to integer;


-- ====== 016_tasks_table.sql ======
-- 016: Tasks table
-- Core task entity for agent task execution and tracking.
-- Tasks belong to a business (tenant root), can be assigned to a department and agent,
-- and support parent/child hierarchy for subtask decomposition.

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  parent_task_id uuid REFERENCES public.tasks,
  department_id uuid REFERENCES public.departments,
  assigned_agent_id uuid REFERENCES public.agents,
  created_by uuid REFERENCES auth.users,
  title text NOT NULL,
  description text,
  payload jsonb DEFAULT '{}',
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high')),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'assigned', 'in_progress', 'waiting_approval', 'assistance_requested', 'completed', 'failed')),
  source text NOT NULL DEFAULT 'admin'
    CHECK (source IN ('admin', 'api', 'webhook', 'orchestrator')),
  result jsonb,
  error_message text,
  token_usage jsonb DEFAULT '{"prompt_tokens": 0, "completion_tokens": 0}',
  cost_cents integer DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_tasks_business ON public.tasks (business_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON public.tasks (parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks (business_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_agent ON public.tasks (assigned_agent_id);

CREATE POLICY "tasks_select_member" ON public.tasks FOR SELECT
  TO authenticated USING (public.is_business_member(business_id));

CREATE POLICY "tasks_insert_admin" ON public.tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
    OR public.has_role_on_business(business_id, 'manager')
  );

CREATE POLICY "tasks_update_admin" ON public.tasks FOR UPDATE
  TO authenticated
  USING (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
    OR public.has_role_on_business(business_id, 'manager')
  )
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
    OR public.has_role_on_business(business_id, 'manager')
  );

CREATE POLICY "tasks_delete_admin" ON public.tasks FOR DELETE
  TO authenticated
  USING (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );


-- ====== 017_subtask_dependencies.sql ======
-- 017: Subtask Dependencies
-- DAG edges for subtask ordering. Each row says "task_id depends on depends_on_task_id".
-- Used by the orchestrator to determine execution order for decomposed tasks.

CREATE TABLE IF NOT EXISTS public.subtask_dependencies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.tasks ON DELETE CASCADE,
  depends_on_task_id uuid NOT NULL REFERENCES public.tasks ON DELETE CASCADE,
  UNIQUE (task_id, depends_on_task_id)
);

ALTER TABLE public.subtask_dependencies ENABLE ROW LEVEL SECURITY;

-- RLS: inherit access from the parent task's business_id
CREATE POLICY "subtask_deps_select" ON public.subtask_dependencies FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id = task_id AND public.is_business_member(t.business_id)
  ));

CREATE POLICY "subtask_deps_insert" ON public.subtask_dependencies FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id = task_id AND (
      public.has_role_on_business(t.business_id, 'owner')
      OR public.has_role_on_business(t.business_id, 'admin')
      OR public.has_role_on_business(t.business_id, 'manager')
    )
  ));

CREATE POLICY "subtask_deps_delete" ON public.subtask_dependencies FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id = task_id AND (
      public.has_role_on_business(t.business_id, 'owner')
      OR public.has_role_on_business(t.business_id, 'admin')
    )
  ));


-- ====== 018_assistance_requests.sql ======
-- 018: Assistance Requests
-- When an agent is blocked during task execution, it creates an assistance request.
-- Admins can respond to unblock the agent and resume task execution.

CREATE TABLE IF NOT EXISTS public.assistance_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents,
  context text NOT NULL,
  blocking_reason text NOT NULL,
  admin_response text,
  responded_by uuid REFERENCES auth.users,
  responded_at timestamptz,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'responded', 'resolved')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.assistance_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_assistance_business ON public.assistance_requests (business_id);
CREATE INDEX IF NOT EXISTS idx_assistance_task ON public.assistance_requests (task_id);
CREATE INDEX IF NOT EXISTS idx_assistance_status ON public.assistance_requests (business_id, status);

CREATE POLICY "assistance_select_member" ON public.assistance_requests FOR SELECT
  TO authenticated USING (public.is_business_member(business_id));

CREATE POLICY "assistance_insert_admin" ON public.assistance_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
    OR public.has_role_on_business(business_id, 'manager')
  );

CREATE POLICY "assistance_update_admin" ON public.assistance_requests FOR UPDATE
  TO authenticated
  USING (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
    OR public.has_role_on_business(business_id, 'manager')
  )
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
    OR public.has_role_on_business(business_id, 'manager')
  );


-- ====== 019_usage_records.sql ======
-- 019: Usage Records
-- Tracks token usage and cost per agent task execution for metering.
CREATE TABLE IF NOT EXISTS public.usage_records (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks,
  agent_id uuid NOT NULL REFERENCES public.agents,
  model text NOT NULL DEFAULT 'claude-sonnet',
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  cost_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_usage_business ON public.usage_records (business_id);
CREATE INDEX IF NOT EXISTS idx_usage_agent ON public.usage_records (agent_id);
CREATE INDEX IF NOT EXISTS idx_usage_task ON public.usage_records (task_id);
CREATE INDEX IF NOT EXISTS idx_usage_created ON public.usage_records (business_id, created_at);

-- Members can view usage data; insert is system-only via Server Actions (managers+ can trigger tasks)
CREATE POLICY "usage_select_member" ON public.usage_records FOR SELECT
  TO authenticated USING (public.is_business_member(business_id));

CREATE POLICY "usage_insert_admin" ON public.usage_records FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
    OR public.has_role_on_business(business_id, 'manager')
  );


-- ====== 020_agents_trusted_column.sql ======
-- 020: Add is_trusted column to agents
-- Trusted agents can auto-approve medium-risk tool executions without human approval.
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS is_trusted boolean DEFAULT false;


-- ====== 021_approvals_table.sql ======
-- 021: Approvals table
-- Stores approval requests created when agents attempt risky actions.
-- Supports risk-tiered approval with two-step rejection flow.

CREATE TABLE IF NOT EXISTS public.approvals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents,
  action_type text NOT NULL,
  action_summary text NOT NULL,
  agent_reasoning text,
  risk_level text NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  risk_explanation text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'auto_approved', 'approved', 'rejected', 'retry_pending', 'guidance_required')),
  decided_by uuid REFERENCES auth.users,
  decided_at timestamptz,
  decision_note text,
  retry_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_approvals_business ON public.approvals (business_id);
CREATE INDEX IF NOT EXISTS idx_approvals_task ON public.approvals (task_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON public.approvals (business_id, status);

-- RLS policies: members can read, managers+ can insert/update
CREATE POLICY "approvals_select_member" ON public.approvals FOR SELECT
  TO authenticated USING (public.is_business_member(business_id));

CREATE POLICY "approvals_insert_admin" ON public.approvals FOR INSERT
  TO authenticated WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
    OR public.has_role_on_business(business_id, 'manager'));

CREATE POLICY "approvals_update_admin" ON public.approvals FOR UPDATE
  TO authenticated
  USING (public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
    OR public.has_role_on_business(business_id, 'manager'))
  WITH CHECK (public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
    OR public.has_role_on_business(business_id, 'manager'));


-- ====== 022_approval_policies.sql ======
-- 022: Approval Policies table
-- Global approval policy rules that determine risk levels for agent actions.
-- Seeded with default policies covering common action categories.

CREATE TABLE IF NOT EXISTS public.approval_policies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  action_pattern text NOT NULL,
  risk_level text NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  description text,
  category text NOT NULL DEFAULT 'general'
    CHECK (category IN ('data_read', 'data_write', 'external_comm', 'config_change', 'destructive', 'financial', 'general')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.approval_policies ENABLE ROW LEVEL SECURITY;

-- Global table: all authenticated users can read, only service/admin can write
CREATE POLICY "policies_select_all" ON public.approval_policies FOR SELECT
  TO authenticated USING (true);

-- Seed default policies
INSERT INTO public.approval_policies (action_pattern, risk_level, description, category) VALUES
  ('search_%', 'low', 'Search and lookup operations', 'data_read'),
  ('review_%', 'low', 'Review and read operations', 'data_read'),
  ('check_%', 'low', 'Status checks and diagnostics', 'data_read'),
  ('draft_%', 'medium', 'Draft creation (not sent)', 'data_write'),
  ('create_%', 'medium', 'Record creation', 'data_write'),
  ('generate_%', 'medium', 'Report and content generation', 'data_write'),
  ('run_%', 'medium', 'Run diagnostics or processes', 'data_write'),
  ('send_%', 'high', 'Send external communications', 'external_comm'),
  ('respond_%', 'high', 'Respond to external parties', 'external_comm'),
  ('update_%', 'high', 'Update existing records or configs', 'config_change'),
  ('close_%', 'high', 'Close or resolve records', 'destructive'),
  ('delete_%', 'high', 'Delete records', 'destructive'),
  ('schedule_%', 'high', 'Schedule operations or maintenance', 'config_change')
ON CONFLICT DO NOTHING;


-- ====== 023_phase4_rls_policies.sql ======
-- 023: Phase 4 RLS policies placeholder
--
-- All Phase 4 RLS policies are defined in their respective migration files:
--   016_tasks_table.sql        -- tasks RLS (4 policies)
--   017_subtask_dependencies.sql -- subtask_dependencies RLS (inherited via tasks FK)
--   018_assistance_requests.sql -- assistance_requests RLS (2 policies)
--   019_usage_records.sql      -- usage_records RLS (2 policies)
--   021_approvals_table.sql    -- approvals RLS (3 policies)
--   022_approval_policies.sql  -- approval_policies RLS (1 policy)
--
-- No additional supplemental RLS policies needed for Phase 4.
-- This file exists for documentation and migration numbering consistency.


-- ====== 024_conversations_table.sql ======
-- 024: Conversations table
-- Stores chat conversations scoped to a business + department.

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users,
  title text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  last_message_at timestamptz DEFAULT now(),
  message_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_conversations_business ON public.conversations (business_id);
CREATE INDEX IF NOT EXISTS idx_conversations_department ON public.conversations (business_id, department_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON public.conversations (business_id, user_id);

-- RLS: any business member can read conversations
CREATE POLICY "conversations_select_member" ON public.conversations FOR SELECT
  TO authenticated USING (public.is_business_member(business_id));

-- RLS: owner/admin/manager can create conversations
CREATE POLICY "conversations_insert_admin" ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
    OR public.has_role_on_business(business_id, 'manager')
  );

-- RLS: owner/admin/manager can update conversations (archive, update counts)
CREATE POLICY "conversations_update_admin" ON public.conversations FOR UPDATE
  TO authenticated
  USING (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
    OR public.has_role_on_business(business_id, 'manager')
  )
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
    OR public.has_role_on_business(business_id, 'manager')
  );


-- ====== 025_messages_table.sql ======
-- 025: Messages table
-- Stores individual messages within conversations. Messages are immutable (no UPDATE/DELETE).

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.conversations ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'agent', 'system')),
  agent_id uuid REFERENCES public.agents,
  content text NOT NULL,
  tool_calls jsonb DEFAULT '[]',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages (conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_business ON public.messages (business_id);

-- RLS: any business member can read messages
CREATE POLICY "messages_select_member" ON public.messages FOR SELECT
  TO authenticated USING (public.is_business_member(business_id));

-- RLS: owner/admin/manager can insert messages (messages are immutable, no UPDATE/DELETE)
CREATE POLICY "messages_insert_admin" ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
    OR public.has_role_on_business(business_id, 'manager')
  );


-- ====== 026_phase5_rls_policies.sql ======
-- 026: Phase 5 performance indexes
-- Additional indexes for health dashboard queries on existing tables.

CREATE INDEX IF NOT EXISTS idx_agents_business_status ON public.agents (business_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_business_completed ON public.tasks (business_id, completed_at DESC) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_business_failed ON public.tasks (business_id, status) WHERE status = 'failed';
CREATE INDEX IF NOT EXISTS idx_audit_logs_business_recent ON public.audit_logs (business_id, created_at DESC);


-- ====== 027_vps_status_table.sql ======
-- 027: VPS Status Table
-- Singleton table tracking shared VPS health state.
-- One row represents the current status of the VPS deployment target.

CREATE TABLE IF NOT EXISTS public.vps_status (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  status text NOT NULL DEFAULT 'unknown'
    CHECK (status IN ('online', 'offline', 'degraded', 'unknown')),
  last_checked_at timestamptz DEFAULT now(),
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.vps_status ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read VPS status
CREATE POLICY "vps_status_select" ON public.vps_status FOR SELECT
  TO authenticated USING (true);

-- Only service role should update (via Server Actions with service client)
-- For now, allow any authenticated user to update (single-admin MVP)
CREATE POLICY "vps_status_update" ON public.vps_status FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "vps_status_insert" ON public.vps_status FOR INSERT
  TO authenticated WITH CHECK (true);

-- Seed with initial unknown status row
INSERT INTO public.vps_status (status, details)
VALUES ('unknown', '{"message": "VPS status not yet checked"}')
ON CONFLICT DO NOTHING;


-- ====== 028_agent_vps_status_table.sql ======
-- 028: Agent VPS Status Table
-- Per-agent VPS runtime status tracking.
-- Maps internal agent_id to vps_agent_id and tracks container health.

CREATE TABLE IF NOT EXISTS public.agent_vps_status (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL REFERENCES public.agents ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  vps_agent_id text NOT NULL,
  container_status text DEFAULT 'unknown'
    CHECK (container_status IN ('running', 'stopped', 'error', 'unknown')),
  last_health_check_at timestamptz,
  last_response_at timestamptz,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.agent_vps_status ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_agent_vps_status_business ON public.agent_vps_status (business_id);
CREATE INDEX IF NOT EXISTS idx_agent_vps_status_agent ON public.agent_vps_status (agent_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_vps_status_unique ON public.agent_vps_status (agent_id);

CREATE POLICY "agent_vps_status_select" ON public.agent_vps_status FOR SELECT
  TO authenticated USING (public.is_business_member(business_id));

CREATE POLICY "agent_vps_status_insert" ON public.agent_vps_status FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );

CREATE POLICY "agent_vps_status_update" ON public.agent_vps_status FOR UPDATE
  TO authenticated
  USING (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  )
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );


-- ====== 029_deployments_vps_columns.sql ======
-- 029: Deployments VPS Columns
-- Add VPS deployment tracking columns to existing deployments table.

ALTER TABLE public.deployments
  ADD COLUMN IF NOT EXISTS optimization_report jsonb,
  ADD COLUMN IF NOT EXISTS deploy_target text DEFAULT 'local'
    CHECK (deploy_target IN ('local', 'vps')),
  ADD COLUMN IF NOT EXISTS vps_deploy_id text;


-- ====== 030_pgvector_extension.sql ======
-- ====== 030: pgvector Extension ======
CREATE EXTENSION IF NOT EXISTS vector;


-- ====== 031_knowledge_tables.sql ======
-- ====== 031: Knowledge Tables ======

-- knowledge_documents: stores document metadata
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents ON DELETE CASCADE,
  title text NOT NULL,
  filename text,
  file_type text NOT NULL DEFAULT 'text'
    CHECK (file_type IN ('text', 'markdown', 'pdf', 'docx', 'xlsx')),
  file_size_bytes integer,
  storage_path text,
  status text NOT NULL DEFAULT 'uploading'
    CHECK (status IN ('uploading', 'processing', 'ready', 'failed')),
  error_message text,
  chunk_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_knowledge_docs_business
  ON public.knowledge_documents (business_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_agent
  ON public.knowledge_documents (business_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_status
  ON public.knowledge_documents (business_id, status);

-- RLS: members read, owner/admin write
CREATE POLICY "knowledge_docs_select_member" ON public.knowledge_documents
  FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE POLICY "knowledge_docs_insert_admin" ON public.knowledge_documents
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin'));
CREATE POLICY "knowledge_docs_update_admin" ON public.knowledge_documents
  FOR UPDATE TO authenticated
  USING (public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin'))
  WITH CHECK (public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin'));
CREATE POLICY "knowledge_docs_delete_admin" ON public.knowledge_documents
  FOR DELETE TO authenticated
  USING (public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin'));

-- knowledge_chunks: stores text chunks with embeddings
CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES public.knowledge_documents ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  embedding vector(1536) NOT NULL,
  token_count integer,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_business
  ON public.knowledge_chunks (business_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_agent
  ON public.knowledge_chunks (business_id, agent_id);

-- HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
  ON public.knowledge_chunks
  USING hnsw (embedding vector_cosine_ops);

-- RLS: members read, owner/admin write
CREATE POLICY "knowledge_chunks_select_member" ON public.knowledge_chunks
  FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE POLICY "knowledge_chunks_insert_admin" ON public.knowledge_chunks
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin'));
CREATE POLICY "knowledge_chunks_delete_admin" ON public.knowledge_chunks
  FOR DELETE TO authenticated
  USING (public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin'));

-- knowledge_retrievals: logs retrieval events for observability
CREATE TABLE IF NOT EXISTS public.knowledge_retrievals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents,
  conversation_id uuid REFERENCES public.conversations,
  task_id uuid REFERENCES public.tasks,
  query_text text NOT NULL,
  chunks_retrieved jsonb NOT NULL DEFAULT '[]',
  retrieval_time_ms integer,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.knowledge_retrievals ENABLE ROW LEVEL SECURITY;

-- RLS: members read, members insert (agents need to log retrievals)
CREATE POLICY "knowledge_retrievals_select_member" ON public.knowledge_retrievals
  FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE POLICY "knowledge_retrievals_insert_member" ON public.knowledge_retrievals
  FOR INSERT TO authenticated
  WITH CHECK (public.is_business_member(business_id));


-- ====== 032_knowledge_rpc.sql ======
-- ====== 032: Knowledge Retrieval RPC ======
CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(
  p_business_id uuid,
  p_agent_id uuid DEFAULT NULL,
  p_query_embedding vector(1536) DEFAULT NULL,
  p_match_threshold float DEFAULT 0.3,
  p_match_count int DEFAULT 3
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  chunk_index int,
  agent_id uuid,
  similarity float
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.document_id,
    kc.content,
    kc.chunk_index,
    kc.agent_id,
    1 - (kc.embedding <=> p_query_embedding)::float AS similarity
  FROM public.knowledge_chunks kc
  WHERE kc.business_id = p_business_id
    AND (
      kc.agent_id IS NULL
      OR kc.agent_id = p_agent_id
    )
    AND 1 - (kc.embedding <=> p_query_embedding) > p_match_threshold
  ORDER BY kc.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$;


-- ====== 033_agent_role_hierarchy.sql ======
-- ====== 033: Agent Role & Hierarchy ======
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS parent_agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS skill_definition text,
  ADD COLUMN IF NOT EXISTS role_definition jsonb;

CREATE INDEX IF NOT EXISTS idx_agents_parent_agent_id
  ON public.agents (parent_agent_id);


-- ====== 034_department_skill.sql ======
-- ====== 034: Department Skill ======
ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS department_skill text;


-- ====== 035_nullable_template_id.sql ======
-- ====== 035: Make template_id nullable for wizard-created agents ======
ALTER TABLE public.agents
  ALTER COLUMN template_id DROP NOT NULL;


-- ====== 036_skills_tables.sql ======
-- ====== 036: Skills, Skill Assignments, and Skill Templates ======

-- 1. Skills table (per-tenant skill entities with soft delete)
CREATE TABLE IF NOT EXISTS public.skills (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  content text NOT NULL,
  trigger_phrases text[],
  source_type text NOT NULL DEFAULT 'manual'
    CHECK (source_type IN ('manual', 'imported', 'template')),
  source_url text,
  version integer NOT NULL DEFAULT 1,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_skills_business
  ON public.skills (business_id);
CREATE INDEX IF NOT EXISTS idx_skills_business_name
  ON public.skills (business_id, name);

-- 2. Skill Assignments table (many-to-many with agent OR department target)
CREATE TABLE IF NOT EXISTS public.skill_assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  skill_id uuid NOT NULL REFERENCES public.skills ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT skill_assignment_target CHECK (
    (agent_id IS NOT NULL AND department_id IS NULL)
    OR (agent_id IS NULL AND department_id IS NOT NULL)
  )
);

ALTER TABLE public.skill_assignments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_skill_assignments_agent
  ON public.skill_assignments (agent_id);
CREATE INDEX IF NOT EXISTS idx_skill_assignments_department
  ON public.skill_assignments (department_id);
CREATE INDEX IF NOT EXISTS idx_skill_assignments_skill
  ON public.skill_assignments (skill_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_assignments_unique_agent
  ON public.skill_assignments (skill_id, agent_id) WHERE agent_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_assignments_unique_dept
  ON public.skill_assignments (skill_id, department_id) WHERE department_id IS NOT NULL;

-- 3. Skill Templates table (globally readable starter templates)
CREATE TABLE IF NOT EXISTS public.skill_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  content text NOT NULL,
  department_type text NOT NULL,
  role_type text,
  trigger_phrases text[],
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.skill_templates ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_skill_templates_department
  ON public.skill_templates (department_type);

-- ====== RLS Policies ======

-- Skills: SELECT for business members, INSERT/UPDATE/DELETE for owner/admin
CREATE POLICY "skills_select_member" ON public.skills
  FOR SELECT TO authenticated
  USING (public.is_business_member(business_id));

CREATE POLICY "skills_insert_admin" ON public.skills
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );

CREATE POLICY "skills_update_admin" ON public.skills
  FOR UPDATE TO authenticated
  USING (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  )
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );

CREATE POLICY "skills_delete_admin" ON public.skills
  FOR DELETE TO authenticated
  USING (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );

-- Skill Assignments: SELECT for members, INSERT/DELETE for owner/admin
CREATE POLICY "skill_assignments_select_member" ON public.skill_assignments
  FOR SELECT TO authenticated
  USING (public.is_business_member(business_id));

CREATE POLICY "skill_assignments_insert_admin" ON public.skill_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );

CREATE POLICY "skill_assignments_delete_admin" ON public.skill_assignments
  FOR DELETE TO authenticated
  USING (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );

-- Skill Templates: SELECT for all authenticated users (globally readable)
CREATE POLICY "skill_templates_select_authenticated" ON public.skill_templates
  FOR SELECT TO authenticated
  USING (true);

-- ====== Seed Starter Skill Templates (10 total) ======

-- Owner Department (2 templates)
INSERT INTO public.skill_templates (name, description, content, department_type, role_type, trigger_phrases)
VALUES
(
  'Strategic Planning',
  'Goal setting, KPI tracking, and quarterly business reviews',
  E'## Capabilities\n\n- Set and track quarterly OKRs and KPIs for the business\n- Analyze progress against strategic goals and flag deviations\n- Generate quarterly review summaries with recommendations\n- Identify growth opportunities based on performance data\n\n## Workflows\n\n1. **Goal Setting**: When asked to set goals, gather context on current metrics, propose SMART objectives, and create tracking checkpoints\n2. **KPI Monitoring**: Regularly check KPI dashboards, compare against targets, and alert on significant variances (>10% deviation)\n3. **Quarterly Review**: At quarter end, compile performance data, identify wins and misses, and draft a review document with action items\n\n## Boundaries\n\n- Do not make financial commitments or approve budgets without owner confirmation\n- Recommendations should be data-driven; flag when data is insufficient\n- Escalate strategic pivots or major goal changes to the business owner',
  'owner',
  'planning',
  ARRAY['set goals', 'track KPIs', 'quarterly review', 'strategic plan', 'OKR']
),
(
  'Team Coordination',
  'Cross-department communication and meeting facilitation',
  E'## Capabilities\n\n- Facilitate cross-department communication and alignment\n- Schedule and prepare agendas for team meetings\n- Track action items and follow up on commitments\n- Identify bottlenecks in inter-team workflows\n\n## Workflows\n\n1. **Meeting Prep**: Before scheduled meetings, compile updates from each department, draft an agenda, and share with participants\n2. **Action Tracking**: After meetings, extract action items, assign owners, set deadlines, and send follow-up reminders\n3. **Escalation**: When cross-department blockers are identified, route them to the appropriate team lead with context\n\n## Boundaries\n\n- Do not override department-specific decisions without team lead input\n- Keep meeting summaries concise and action-oriented\n- Respect individual team workflows; coordinate, do not dictate',
  'owner',
  'coordination',
  ARRAY['coordinate teams', 'meeting agenda', 'action items', 'cross-department', 'follow up']
);

-- Sales Department (3 templates)
INSERT INTO public.skill_templates (name, description, content, department_type, role_type, trigger_phrases)
VALUES
(
  'Lead Qualification',
  'Ideal customer profile matching, lead scoring, and prioritization',
  E'## Capabilities\n\n- Score inbound leads against the Ideal Customer Profile (ICP)\n- Prioritize leads by fit score, engagement level, and deal potential\n- Enrich lead data from available sources (company size, industry, role)\n- Flag high-priority leads for immediate sales follow-up\n\n## Workflows\n\n1. **Lead Scoring**: On new lead intake, evaluate against ICP criteria (industry, company size, budget, pain points). Assign a score of 1-100.\n2. **Prioritization**: Rank qualified leads by score and engagement recency. Surface the top 10 daily.\n3. **Enrichment**: For leads missing key data, attempt to fill gaps from public sources and note confidence level.\n\n## Boundaries\n\n- Do not contact leads directly; route qualified leads to the sales team\n- Scoring criteria should be reviewed monthly with the sales manager\n- Mark uncertain qualifications clearly rather than guessing',
  'sales',
  'qualification',
  ARRAY['qualify lead', 'score lead', 'ICP match', 'prioritize leads', 'lead enrichment']
),
(
  'Outreach Cadence',
  'Email sequence management, follow-up timing, and personalization',
  E'## Capabilities\n\n- Design multi-step email outreach sequences for different prospect segments\n- Personalize outreach messages based on prospect context and engagement history\n- Optimize send timing based on open rate data and prospect timezone\n- Track sequence performance and suggest A/B test variations\n\n## Workflows\n\n1. **Sequence Design**: Given a prospect segment, create a 4-6 step email cadence with appropriate spacing (Day 1, 3, 7, 14, 21)\n2. **Personalization**: Before each send, customize the template with prospect-specific details (company name, recent news, mutual connections)\n3. **Follow-up**: Monitor replies and engagement. Adjust cadence timing for engaged prospects; pause for opt-outs.\n\n## Boundaries\n\n- Respect opt-out requests immediately and permanently\n- Do not send more than one email per prospect per day\n- All outreach must comply with CAN-SPAM and GDPR guidelines\n- Flag negative responses for human review',
  'sales',
  'outreach',
  ARRAY['email sequence', 'outreach', 'follow up', 'cadence', 'personalize email']
),
(
  'Deal Management',
  'Pipeline tracking, forecasting, and close planning',
  E'## Capabilities\n\n- Track deals through pipeline stages (Prospect, Discovery, Proposal, Negotiation, Closed)\n- Forecast revenue based on pipeline stage probabilities and historical close rates\n- Identify stalled deals and suggest re-engagement strategies\n- Prepare deal briefs with key decision-maker info and competitive context\n\n## Workflows\n\n1. **Pipeline Update**: Daily, review all active deals. Flag deals that have not progressed in 7+ days.\n2. **Forecast**: Weekly, calculate weighted pipeline value and compare against quota targets.\n3. **Close Planning**: For deals in Negotiation stage, prepare a close plan with next steps, decision timeline, and risk factors.\n\n## Boundaries\n\n- Do not approve discounts or special terms without manager authorization\n- Revenue forecasts should note confidence intervals\n- Competitive intelligence must come from public sources only',
  'sales',
  'pipeline',
  ARRAY['pipeline', 'deal tracking', 'forecast', 'close plan', 'stalled deals']
);

-- Support Department (2 templates)
INSERT INTO public.skill_templates (name, description, content, department_type, role_type, trigger_phrases)
VALUES
(
  'Ticket Triage',
  'Classification, urgency assessment, and intelligent routing',
  E'## Capabilities\n\n- Classify incoming support tickets by category (bug, feature request, billing, how-to, account)\n- Assess urgency level (critical, high, normal, low) based on content and customer tier\n- Route tickets to the appropriate team member or specialist queue\n- Detect duplicate tickets and link related issues\n\n## Workflows\n\n1. **Classification**: On new ticket, analyze subject and body. Assign category and urgency within 30 seconds.\n2. **Routing**: Based on category and agent availability, assign to the best-matched support agent.\n3. **Escalation**: Auto-escalate if: customer is enterprise tier, issue mentions data loss, or ticket has been open >4 hours without response.\n\n## Boundaries\n\n- Never close a ticket without customer confirmation of resolution\n- Critical tickets must be escalated to a human agent immediately\n- Do not share internal escalation rules with customers',
  'support',
  'triage',
  ARRAY['triage ticket', 'classify issue', 'route ticket', 'urgent support', 'escalate']
),
(
  'Knowledge Base Lookup',
  'Search, answer synthesis, and documentation gap identification',
  E'## Capabilities\n\n- Search the knowledge base for relevant articles matching customer questions\n- Synthesize clear, concise answers from multiple knowledge base sources\n- Identify gaps in documentation and suggest new articles to create\n- Track frequently asked questions that are not well-covered\n\n## Workflows\n\n1. **Search & Answer**: On customer question, search KB articles. If a match is found, compose a tailored answer citing the source article.\n2. **Gap Detection**: If no relevant article is found, log the topic as a documentation gap and provide a best-effort answer.\n3. **FAQ Tracking**: Weekly, compile the top unanswered or poorly-answered questions for the content team.\n\n## Boundaries\n\n- Always cite the source article when answering from the knowledge base\n- If unsure about an answer, escalate to a human agent rather than guessing\n- Do not modify knowledge base articles directly; suggest edits through the review process',
  'support',
  'knowledge',
  ARRAY['search knowledge base', 'find answer', 'FAQ', 'documentation', 'help article']
);

-- Operations Department (3 templates)
INSERT INTO public.skill_templates (name, description, content, department_type, role_type, trigger_phrases)
VALUES
(
  'Process Automation',
  'Workflow triggers, error handling, and automated reporting',
  E'## Capabilities\n\n- Monitor workflow triggers and execute automated process steps\n- Handle errors in automated pipelines with retry logic and fallback paths\n- Generate daily and weekly operational reports from process data\n- Identify process bottlenecks and suggest optimization opportunities\n\n## Workflows\n\n1. **Trigger Monitoring**: Watch for defined trigger events. When fired, execute the associated workflow steps in sequence.\n2. **Error Handling**: On pipeline failure, attempt retry (max 3). If still failing, pause the workflow and alert the operations team.\n3. **Reporting**: At scheduled intervals, compile process metrics (completion rate, avg duration, error rate) into a formatted report.\n\n## Boundaries\n\n- Do not modify production workflows without approval from operations lead\n- Retry logic should have exponential backoff to avoid cascade failures\n- Alert on any process that exceeds 3x its normal duration',
  'operations',
  'automation',
  ARRAY['automate workflow', 'process trigger', 'error handling', 'pipeline', 'automated report']
),
(
  'Data Analysis',
  'Metrics collection, anomaly detection, and trend visualization',
  E'## Capabilities\n\n- Collect and aggregate operational metrics from multiple data sources\n- Detect anomalies in time-series data using statistical thresholds\n- Generate trend analysis reports with visualizations and insights\n- Build and maintain dashboards for key operational KPIs\n\n## Workflows\n\n1. **Metric Collection**: Hourly, pull metrics from configured data sources. Store in the analysis pipeline.\n2. **Anomaly Detection**: Compare each metric against its rolling 30-day average. Flag values beyond 2 standard deviations.\n3. **Trend Reports**: Weekly, generate trend summaries highlighting notable changes, correlations, and forecasts.\n\n## Boundaries\n\n- Data access must respect tenant isolation; never mix data across businesses\n- Anomaly alerts should include context (what changed, possible causes)\n- Do not take automated action on anomalies; alert the team for investigation',
  'operations',
  'analysis',
  ARRAY['analyze data', 'detect anomaly', 'metrics report', 'trend analysis', 'dashboard']
),
(
  'Resource Scheduling',
  'Calendar management, capacity planning, and workload balancing',
  E'## Capabilities\n\n- Manage team calendars and schedule meetings based on availability\n- Track team capacity and workload across projects\n- Balance resource allocation to prevent over- or under-utilization\n- Forecast resource needs based on upcoming project timelines\n\n## Workflows\n\n1. **Scheduling**: When a meeting or task needs scheduling, check team availability and propose the earliest suitable slot.\n2. **Capacity Check**: Daily, calculate team utilization rates. Flag individuals above 90% or below 40% utilization.\n3. **Forecasting**: Based on project timelines and current allocation, predict resource shortfalls 2 weeks ahead.\n\n## Boundaries\n\n- Respect team member time-off and blocked calendar slots\n- Do not overbook resources beyond 100% capacity without manager approval\n- Scheduling changes to client-facing meetings require confirmation',
  'operations',
  'scheduling',
  ARRAY['schedule meeting', 'capacity planning', 'resource allocation', 'workload balance', 'calendar']
);

-- 036b: Add import_collection column for grouping imported skills by repo name
ALTER TABLE public.skills ADD COLUMN IF NOT EXISTS import_collection text;
CREATE INDEX IF NOT EXISTS idx_skills_import_collection
  ON public.skills (business_id, import_collection) WHERE import_collection IS NOT NULL;


-- ====== 037_template_profile_defaults.sql ======
-- 037_template_profile_defaults.sql
-- Populate agent_templates with per-department default model_profile and tool_profile.
-- Only updates templates that still have empty '{}' profiles (idempotent-safe).

-- Owner: Opus model, oversight tools
UPDATE public.agent_templates
SET
  model_profile = '{"model": "claude-opus-4-6"}'::jsonb,
  tool_profile = '{"allowed_tools": ["review_dashboard", "generate_report", "update_business_settings"], "mcp_servers": []}'::jsonb
WHERE department_type = 'owner'
  AND model_profile = '{}'::jsonb
  AND tool_profile = '{}'::jsonb;

-- Sales: Sonnet model, CRM/outreach tools
UPDATE public.agent_templates
SET
  model_profile = '{"model": "claude-sonnet-4-6"}'::jsonb,
  tool_profile = '{"allowed_tools": ["search_contacts", "draft_email", "send_email", "create_deal", "update_deal_stage"], "mcp_servers": []}'::jsonb
WHERE department_type = 'sales'
  AND model_profile = '{}'::jsonb
  AND tool_profile = '{}'::jsonb;

-- Support: Haiku model, helpdesk tools
UPDATE public.agent_templates
SET
  model_profile = '{"model": "claude-haiku-4-5-20251001"}'::jsonb,
  tool_profile = '{"allowed_tools": ["search_tickets", "create_ticket", "respond_to_ticket", "close_ticket", "search_kb"], "mcp_servers": []}'::jsonb
WHERE department_type = 'support'
  AND model_profile = '{}'::jsonb
  AND tool_profile = '{}'::jsonb;

-- Operations: Sonnet model, ops tools
UPDATE public.agent_templates
SET
  model_profile = '{"model": "claude-sonnet-4-6"}'::jsonb,
  tool_profile = '{"allowed_tools": ["check_system_status", "run_diagnostic", "update_config", "schedule_maintenance"], "mcp_servers": []}'::jsonb
WHERE department_type = 'operations'
  AND model_profile = '{}'::jsonb
  AND tool_profile = '{}'::jsonb;


-- ====== 038_integrations_department_scope.sql ======
-- 038: Add department-level integration support and catalog metadata

ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments ON DELETE CASCADE;
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS setup_instructions text;
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS name text;

CREATE INDEX IF NOT EXISTS idx_integrations_department ON public.integrations (department_id);

-- Replace old unique constraint with partial indexes
DROP INDEX IF EXISTS idx_integrations_business_agent_type;

-- Agent-level: one integration per type per agent per business
CREATE UNIQUE INDEX IF NOT EXISTS idx_integrations_agent_unique
  ON public.integrations (business_id, agent_id, type) WHERE agent_id IS NOT NULL;

-- Department-level: one integration per type per department per business
CREATE UNIQUE INDEX IF NOT EXISTS idx_integrations_department_unique
  ON public.integrations (business_id, department_id, type) WHERE department_id IS NOT NULL;


-- ====== 039_provider_credential_fields.sql ======
-- 039: Provider credential field definitions
-- Drives dynamic credential forms per integration provider.
-- Field definitions are global (not per-tenant) -- seeded with all 15 catalog providers.

CREATE TABLE IF NOT EXISTS public.provider_credential_fields (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  provider text NOT NULL,
  field_name text NOT NULL,
  field_type text NOT NULL DEFAULT 'password'
    CHECK (field_type IN ('password', 'text', 'url')),
  display_label text NOT NULL,
  placeholder text,
  help_text text,
  field_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- One field per provider+field_name combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_credential_fields_provider_field
  ON public.provider_credential_fields (provider, field_name);

-- Lookup by provider
CREATE INDEX IF NOT EXISTS idx_provider_credential_fields_provider
  ON public.provider_credential_fields (provider);

-- RLS: anyone authenticated can read field definitions (they are not sensitive)
ALTER TABLE public.provider_credential_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "provider_credential_fields_select_authenticated"
  ON public.provider_credential_fields FOR SELECT
  TO authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE policies -- only service_role can modify

-- Seed field definitions for all 15 catalog providers
INSERT INTO public.provider_credential_fields (provider, field_name, field_type, display_label, placeholder, help_text, field_order)
VALUES
  -- HubSpot (CRM)
  ('hubspot', 'api_key', 'password', 'API Key', NULL, 'Found in Settings > Integrations > API key', 0),

  -- Salesforce (CRM)
  ('salesforce', 'instance_url', 'url', 'Instance URL', 'https://yourcompany.my.salesforce.com', NULL, 0),
  ('salesforce', 'client_id', 'text', 'Client ID', NULL, NULL, 1),
  ('salesforce', 'client_secret', 'password', 'Client Secret', NULL, NULL, 2),

  -- Pipedrive (CRM)
  ('pipedrive', 'api_token', 'password', 'API Token', NULL, 'Found in Settings > Personal Preferences > API', 0),

  -- SendGrid (Email)
  ('sendgrid', 'api_key', 'password', 'API Key', NULL, 'Full access or restricted API key', 0),

  -- Mailgun (Email)
  ('mailgun', 'api_key', 'password', 'API Key', NULL, NULL, 0),
  ('mailgun', 'domain', 'text', 'Sending Domain', 'mg.yourdomain.com', 'e.g. mg.yourdomain.com', 1),

  -- Amazon SES (Email)
  ('ses', 'access_key_id', 'text', 'Access Key ID', NULL, NULL, 0),
  ('ses', 'secret_access_key', 'password', 'Secret Access Key', NULL, NULL, 1),
  ('ses', 'region', 'text', 'AWS Region', 'us-east-1', 'e.g. us-east-1', 2),

  -- Zendesk (Helpdesk)
  ('zendesk', 'subdomain', 'text', 'Subdomain', 'yourcompany', 'yourcompany.zendesk.com', 0),
  ('zendesk', 'email', 'text', 'Admin Email', NULL, NULL, 1),
  ('zendesk', 'api_token', 'password', 'API Token', NULL, NULL, 2),

  -- Freshdesk (Helpdesk)
  ('freshdesk', 'domain', 'text', 'Domain', 'yourcompany', 'yourcompany.freshdesk.com', 0),
  ('freshdesk', 'api_key', 'password', 'API Key', NULL, NULL, 1),

  -- Intercom (Helpdesk)
  ('intercom', 'access_token', 'password', 'Access Token', NULL, 'From Developer Hub > Your App', 0),

  -- Google Calendar (Calendar)
  ('google-calendar', 'client_id', 'text', 'Client ID', NULL, NULL, 0),
  ('google-calendar', 'client_secret', 'password', 'Client Secret', NULL, NULL, 1),
  ('google-calendar', 'refresh_token', 'password', 'Refresh Token', NULL, NULL, 2),

  -- Outlook Calendar (Calendar)
  ('outlook-calendar', 'client_id', 'text', 'Client ID', NULL, NULL, 0),
  ('outlook-calendar', 'client_secret', 'password', 'Client Secret', NULL, NULL, 1),
  ('outlook-calendar', 'tenant_id', 'text', 'Tenant ID', NULL, NULL, 2),

  -- Calendly (Calendar)
  ('calendly', 'api_key', 'password', 'Personal Access Token', NULL, 'From Integrations page', 0),

  -- Slack (Messaging)
  ('slack', 'bot_token', 'password', 'Bot Token', 'xoxb-xxxx...', NULL, 0),
  ('slack', 'signing_secret', 'password', 'Signing Secret', NULL, 'From Basic Information > App Credentials', 1),
  ('slack', 'client_id', 'text', 'Client ID', NULL, 'From api.slack.com > Your App > Basic Information', 2),
  ('slack', 'client_secret', 'password', 'Client Secret', NULL, 'From api.slack.com > Your App > Basic Information', 3),

  -- Microsoft Teams (Messaging)
  ('teams', 'app_id', 'text', 'App ID', NULL, NULL, 0),
  ('teams', 'app_password', 'password', 'App Password', NULL, NULL, 1),

  -- Discord (Messaging)
  ('discord', 'bot_token', 'password', 'Bot Token', NULL, NULL, 0),
  ('discord', 'application_id', 'text', 'Application ID', NULL, NULL, 1)
ON CONFLICT DO NOTHING;


-- ====== 040_secrets_provider_column.sql ======
-- 040: Add provider column to secrets table
-- Enables provider-scoped credential grouping (e.g. all HubSpot credentials together).

ALTER TABLE public.secrets ADD COLUMN IF NOT EXISTS provider text;

-- Provider-scoped uniqueness: one value per field per provider per business
-- Must NOT be a partial index (WHERE clause) or ON CONFLICT won't match it.
-- NULLs in provider are naturally distinct in unique indexes, so legacy secrets are safe.
CREATE UNIQUE INDEX IF NOT EXISTS idx_secrets_business_provider_key
  ON public.secrets (business_id, provider, key);

-- Keep existing idx_secrets_business_key for backward compatibility with legacy secrets


-- ====== 041_slack_tables.sql ======
-- 041: Slack integration tables
-- Stores per-business Slack workspace installations and channel-to-department mappings.
-- Also adds Slack metadata columns to messages and conversations tables.

-- 1. slack_installations: one Slack workspace per business
CREATE TABLE IF NOT EXISTS public.slack_installations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  slack_team_id text NOT NULL,
  slack_team_name text,
  bot_user_id text NOT NULL,
  installed_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(business_id),
  UNIQUE(slack_team_id)
);

ALTER TABLE public.slack_installations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_slack_installations_team_id
  ON public.slack_installations (slack_team_id);

-- RLS: business members can view their installation
CREATE POLICY "slack_installations_select_member"
  ON public.slack_installations FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

-- RLS: owner/admin can create installation
CREATE POLICY "slack_installations_insert_admin"
  ON public.slack_installations FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );

-- RLS: owner/admin can update installation
CREATE POLICY "slack_installations_update_admin"
  ON public.slack_installations FOR UPDATE
  TO authenticated
  USING (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  )
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );

-- 2. slack_channel_mappings: maps Slack channels to departments/agents
CREATE TABLE IF NOT EXISTS public.slack_channel_mappings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents ON DELETE SET NULL,
  slack_channel_id text NOT NULL,
  slack_channel_name text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.slack_channel_mappings ENABLE ROW LEVEL SECURITY;

-- One channel per business (no duplicate channel mappings)
CREATE UNIQUE INDEX IF NOT EXISTS idx_slack_channel_mappings_business_channel
  ON public.slack_channel_mappings (business_id, slack_channel_id);

-- One main channel per department (where agent_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_slack_channel_mappings_business_dept
  ON public.slack_channel_mappings (business_id, department_id) WHERE agent_id IS NULL;

-- RLS: business members can view channel mappings
CREATE POLICY "slack_channel_mappings_select_member"
  ON public.slack_channel_mappings FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

-- RLS: owner/admin can create mappings
CREATE POLICY "slack_channel_mappings_insert_admin"
  ON public.slack_channel_mappings FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );

-- RLS: owner/admin can update mappings
CREATE POLICY "slack_channel_mappings_update_admin"
  ON public.slack_channel_mappings FOR UPDATE
  TO authenticated
  USING (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  )
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );

-- RLS: owner/admin can delete mappings
CREATE POLICY "slack_channel_mappings_delete_admin"
  ON public.slack_channel_mappings FOR DELETE
  TO authenticated
  USING (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );

-- 3. ALTER messages table: add Slack metadata columns
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS slack_ts text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS slack_channel_id text;

CREATE INDEX IF NOT EXISTS idx_messages_slack_ts
  ON public.messages (slack_ts) WHERE slack_ts IS NOT NULL;

-- 4. ALTER conversations table: link conversation to Slack channel
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS slack_channel_id text;


-- ====== 042_expand_agent_templates.sql ======
-- 042: Expand agent_templates for V2
-- Adds skills_package, mcp_servers, token_budget, reporting_chain, and role_level
-- to support hierarchical department templates with auto-assigned skills and MCP servers.

ALTER TABLE public.agent_templates
  ADD COLUMN IF NOT EXISTS skills_package jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS mcp_servers jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS token_budget integer DEFAULT 100000,
  ADD COLUMN IF NOT EXISTS reporting_chain text,
  ADD COLUMN IF NOT EXISTS role_level integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parent_template_id uuid REFERENCES public.agent_templates(id) ON DELETE SET NULL;

-- role_level: 0 = C-suite, 1 = department head, 2 = specialist
-- reporting_chain: e.g. 'ceo' or 'ceo.marketing' or 'ceo.marketing.content'

CREATE INDEX IF NOT EXISTS idx_agent_templates_role_level
  ON public.agent_templates (role_level);

CREATE INDEX IF NOT EXISTS idx_agent_templates_parent
  ON public.agent_templates (parent_template_id);

COMMENT ON COLUMN public.agent_templates.skills_package IS 'Array of skill package refs [{name, source, version}]';
COMMENT ON COLUMN public.agent_templates.mcp_servers IS 'Array of MCP server configs [{name, url, auth}]';
COMMENT ON COLUMN public.agent_templates.token_budget IS 'Max tokens per day for this agent role';
COMMENT ON COLUMN public.agent_templates.reporting_chain IS 'Dot-separated hierarchy path e.g. ceo.marketing.content';
COMMENT ON COLUMN public.agent_templates.role_level IS '0=C-suite, 1=dept head, 2=specialist';


-- ====== 043_businesses_subdomain.sql ======
-- 043: Add subdomain column to businesses
-- Supports per-tenant subdomain routing (e.g. acme.fleetfactory.ai)

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS subdomain text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_businesses_subdomain
  ON public.businesses (subdomain) WHERE subdomain IS NOT NULL;

COMMENT ON COLUMN public.businesses.subdomain IS 'Tenant subdomain for portal access e.g. acme.fleetfactory.ai';


-- ====== 044_port_allocations.sql ======
-- 044: Port allocations table
-- Manages port block assignments for VPS tenant containers.
-- Each business gets a block of 100 ports starting at 4000.

CREATE TABLE IF NOT EXISTS public.port_allocations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  port_range_start integer NOT NULL,
  port_range_end integer NOT NULL,
  allocated_at timestamptz DEFAULT now() NOT NULL,
  released_at timestamptz,
  UNIQUE(business_id),
  CHECK (port_range_end > port_range_start),
  CHECK (port_range_start >= 4000)
);

ALTER TABLE public.port_allocations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_port_allocations_business
  ON public.port_allocations (business_id);

CREATE INDEX IF NOT EXISTS idx_port_allocations_range
  ON public.port_allocations (port_range_start, port_range_end);

-- RLS: business members can view their port allocation
CREATE POLICY "port_allocations_select_member"
  ON public.port_allocations FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

-- Helper function to allocate the next available port block
CREATE OR REPLACE FUNCTION public.allocate_port_block(p_business_id uuid)
RETURNS public.port_allocations
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_start integer;
  v_result public.port_allocations;
BEGIN
  -- Check if business already has an allocation
  SELECT * INTO v_result
  FROM public.port_allocations
  WHERE business_id = p_business_id AND released_at IS NULL;

  IF FOUND THEN
    RETURN v_result;
  END IF;

  -- Find the next available block (blocks of 100, starting at 4000)
  SELECT COALESCE(MAX(port_range_end), 3999) + 1
  INTO v_next_start
  FROM public.port_allocations
  WHERE released_at IS NULL;

  -- Ensure we start at minimum 4000
  IF v_next_start < 4000 THEN
    v_next_start := 4000;
  END IF;

  INSERT INTO public.port_allocations (business_id, port_range_start, port_range_end)
  VALUES (p_business_id, v_next_start, v_next_start + 99)
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;


-- ====== 045_api_usage_and_queue.sql ======
-- 045: API usage tracking and call queue for rate limiting
-- api_usage: detailed per-call usage logging (extends usage_records with rate-limit context)
-- api_call_queue: Supabase-backed overflow queue for rate limiting

-- 1. api_usage: tracks every API call with timing and cost
CREATE TABLE IF NOT EXISTS public.api_usage (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid REFERENCES public.businesses ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents ON DELETE SET NULL,
  model text NOT NULL,
  provider text NOT NULL DEFAULT 'anthropic',
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer GENERATED ALWAYS AS (prompt_tokens + completion_tokens) STORED,
  cost_cents numeric(10,4) NOT NULL DEFAULT 0,
  latency_ms integer,
  status text NOT NULL DEFAULT 'completed'
    CHECK (status IN ('completed', 'failed', 'rate_limited', 'queued')),
  error_message text,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_api_usage_business ON public.api_usage (business_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_agent ON public.api_usage (agent_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created ON public.api_usage (created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_business_date ON public.api_usage (business_id, created_at);

-- RLS: business members can view usage
CREATE POLICY "api_usage_select_member"
  ON public.api_usage FOR SELECT
  TO authenticated
  USING (
    business_id IS NULL  -- system-level usage visible to all authenticated
    OR public.is_business_member(business_id)
  );

-- 2. api_call_queue: overflow queue for rate-limited calls
CREATE TABLE IF NOT EXISTS public.api_call_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid REFERENCES public.businesses ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  priority integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  error_message text,
  created_at timestamptz DEFAULT now() NOT NULL,
  started_at timestamptz,
  completed_at timestamptz
);

ALTER TABLE public.api_call_queue ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_api_call_queue_status ON public.api_call_queue (status);
CREATE INDEX IF NOT EXISTS idx_api_call_queue_priority ON public.api_call_queue (status, priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_api_call_queue_business ON public.api_call_queue (business_id);

-- RLS: business members can view their queue
CREATE POLICY "api_call_queue_select_member"
  ON public.api_call_queue FOR SELECT
  TO authenticated
  USING (
    business_id IS NULL
    OR public.is_business_member(business_id)
  );

-- Helper: get current concurrent call count
CREATE OR REPLACE FUNCTION public.get_active_api_calls()
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::integer
  FROM public.api_call_queue
  WHERE status = 'processing';
$$;


-- ====== 046_rd_memos.sql ======
-- 046: R&D Council memos table
-- Stores structured outputs from autonomous R&D council sessions.

CREATE TABLE IF NOT EXISTS public.rd_memos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL,
  business_id uuid REFERENCES public.businesses ON DELETE CASCADE,
  title text NOT NULL,
  summary text NOT NULL,
  content text NOT NULL,
  proposer_agent text NOT NULL,
  participants jsonb NOT NULL DEFAULT '[]',
  votes jsonb NOT NULL DEFAULT '{}',
  tags text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  session_type text NOT NULL DEFAULT 'scheduled'
    CHECK (session_type IN ('scheduled', 'ad_hoc', 'emergency')),
  context_refs jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.rd_memos ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_rd_memos_session ON public.rd_memos (session_id);
CREATE INDEX IF NOT EXISTS idx_rd_memos_business ON public.rd_memos (business_id);
CREATE INDEX IF NOT EXISTS idx_rd_memos_status ON public.rd_memos (status);
CREATE INDEX IF NOT EXISTS idx_rd_memos_created ON public.rd_memos (created_at);
CREATE INDEX IF NOT EXISTS idx_rd_memos_tags ON public.rd_memos USING gin (tags);

-- RLS: business members can view memos for their business; system memos (null business_id) visible to all
CREATE POLICY "rd_memos_select_member"
  ON public.rd_memos FOR SELECT
  TO authenticated
  USING (
    business_id IS NULL
    OR public.is_business_member(business_id)
  );

-- Auto-update updated_at
DROP TRIGGER IF EXISTS set_rd_memos_updated_at ON public.rd_memos;
CREATE TRIGGER set_rd_memos_updated_at
  BEFORE UPDATE ON public.rd_memos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.rd_memos IS 'Structured memos from R&D Council autonomous sessions';
COMMENT ON COLUMN public.rd_memos.participants IS 'Array of {agent, model, role} objects';
COMMENT ON COLUMN public.rd_memos.votes IS 'Map of agent_name -> {vote: approve|reject|abstain, reasoning: text}';
COMMENT ON COLUMN public.rd_memos.context_refs IS 'References to product links, build phases, previous memos';


-- ====== 047_whatsapp_config.sql ======
-- 047: WhatsApp configuration table
-- Per-business WhatsApp integration settings for alerts, commands, and digests.

CREATE TABLE IF NOT EXISTS public.whatsapp_config (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  phone_number text NOT NULL,
  provider text NOT NULL DEFAULT 'twilio'
    CHECK (provider IN ('twilio', 'meta')),
  provider_config jsonb NOT NULL DEFAULT '{}',
  notification_preferences jsonb NOT NULL DEFAULT '{
    "deployment_complete": true,
    "approval_needed": true,
    "new_crm_lead": true,
    "follow_up_due": true,
    "daily_digest": true,
    "spend_alert": true
  }',
  daily_digest_time time DEFAULT '09:00',
  is_active boolean DEFAULT false,
  verified_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(business_id)
);

ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_whatsapp_config_business
  ON public.whatsapp_config (business_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_config_active
  ON public.whatsapp_config (is_active) WHERE is_active = true;

-- RLS: business members can view
CREATE POLICY "whatsapp_config_select_member"
  ON public.whatsapp_config FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

-- RLS: owner/admin can insert
CREATE POLICY "whatsapp_config_insert_admin"
  ON public.whatsapp_config FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );

-- RLS: owner/admin can update
CREATE POLICY "whatsapp_config_update_admin"
  ON public.whatsapp_config FOR UPDATE
  TO authenticated
  USING (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  )
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );

-- Auto-update updated_at
DROP TRIGGER IF EXISTS set_whatsapp_config_updated_at ON public.whatsapp_config;
CREATE TRIGGER set_whatsapp_config_updated_at
  BEFORE UPDATE ON public.whatsapp_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.whatsapp_config IS 'Per-business WhatsApp integration for agent alerts and commands';
COMMENT ON COLUMN public.whatsapp_config.provider_config IS 'Provider-specific config: Twilio {accountSid, authToken, fromNumber} or Meta {appId, appSecret, verifyToken}';


-- ====== 048_expand_departments_type.sql ======
-- 048: Expand departments type check for V2 department types
-- V2 adds marketing, rd (R&D), executive, and hr department types.

-- Drop the existing check constraint and add expanded one
ALTER TABLE public.departments
  DROP CONSTRAINT IF EXISTS departments_type_check;

ALTER TABLE public.departments
  ADD CONSTRAINT departments_type_check
  CHECK (type IN ('owner', 'sales', 'support', 'operations', 'custom', 'marketing', 'rd', 'executive', 'hr'));


-- ====== 049_seed_v2_templates.sql ======
-- 049: Seed V2 hierarchical department templates (~20 roles)
-- Organized: CEO → Department Heads → Specialists
-- Each template includes skills_package, mcp_servers, token_budget, reporting_chain

-- First, update existing templates with V2 fields
UPDATE public.agent_templates SET
  role_level = 0,
  reporting_chain = 'ceo',
  token_budget = 200000,
  skills_package = '[]'::jsonb,
  mcp_servers = '[]'::jsonb
WHERE name = 'Owner Agent' AND department_type = 'owner';

UPDATE public.agent_templates SET
  role_level = 1,
  reporting_chain = 'ceo.sales',
  token_budget = 150000
WHERE name = 'Sales Agent' AND department_type = 'sales';

UPDATE public.agent_templates SET
  role_level = 1,
  reporting_chain = 'ceo.support',
  token_budget = 120000
WHERE name = 'Support Agent' AND department_type = 'support';

UPDATE public.agent_templates SET
  role_level = 1,
  reporting_chain = 'ceo.operations',
  token_budget = 120000
WHERE name = 'Operations Agent' AND department_type = 'operations';

-- ============================================================================
-- CEO (executive department) — always deploys first, hires the rest
-- ============================================================================
INSERT INTO public.agent_templates (name, department_type, description, system_prompt, role_level, reporting_chain, token_budget, skills_package, mcp_servers, tool_profile, model_profile)
VALUES (
  'CEO Agent',
  'executive',
  'Chief executive officer — deploys first, orchestrates hiring of all other agents, monitors cross-department performance',
  'You are the CEO agent for {{business_name}}. You are the first agent deployed and responsible for:
1. Hiring and onboarding all department heads and specialists
2. Setting company-wide objectives and KPIs
3. Reviewing cross-department reports and memos
4. Approving high-risk actions and budget overruns
5. Conducting daily standup summaries across all departments

You have authority over all other agents. When a new department or agent is needed, you initiate the hiring process. You receive escalations from all department heads.

Current departments under your leadership: Marketing, Sales, Operations, Support, R&D.',
  0, 'ceo', 250000,
  '[{"name": "agent-orchestrator", "source": "builtin"}, {"name": "kpi-tracker", "source": "builtin"}]'::jsonb,
  '[{"name": "supabase", "type": "database", "config": {"scope": "read"}}, {"name": "slack", "type": "messaging", "config": {"scope": "send"}}]'::jsonb,
  '{}', '{}'
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- MARKETING department head + specialists
-- ============================================================================
INSERT INTO public.agent_templates (name, department_type, description, system_prompt, role_level, reporting_chain, token_budget, skills_package, mcp_servers, tool_profile, model_profile)
VALUES
(
  'Marketing Director',
  'marketing',
  'Head of marketing — oversees content, SEO, outreach, and social media strategy',
  'You are the Marketing Director for {{business_name}}. You oversee:
- Content strategy and editorial calendar
- SEO optimization and keyword tracking
- Cold outreach campaigns and lead generation
- Social media presence and engagement

You manage 4 specialist agents: Content Writer, SEO Analyst, Cold Outreach, and Social Media Manager. You report directly to the CEO with weekly marketing performance reports.',
  1, 'ceo.marketing', 150000,
  '[{"name": "analytics-reader", "source": "builtin"}, {"name": "campaign-planner", "source": "builtin"}]'::jsonb,
  '[{"name": "google-analytics", "type": "analytics", "config": {}}, {"name": "slack", "type": "messaging", "config": {"scope": "send"}}]'::jsonb,
  '{}', '{}'
),
(
  'Content Writer',
  'marketing',
  'Creates blog posts, newsletters, landing page copy, and marketing collateral',
  'You are a Content Writer for {{business_name}}. You specialize in:
- Blog posts and long-form content
- Email newsletters and drip campaigns
- Landing page copy and CTAs
- Product descriptions and case studies

You follow the brand voice guidelines and SEO recommendations from the SEO Analyst. Report to the Marketing Director.',
  2, 'ceo.marketing.content', 100000,
  '[{"name": "content-generator", "source": "builtin"}, {"name": "grammar-checker", "source": "builtin"}]'::jsonb,
  '[{"name": "cms", "type": "content", "config": {}}]'::jsonb,
  '{}', '{}'
),
(
  'SEO Analyst',
  'marketing',
  'Keyword research, on-page optimization, rank tracking, and technical SEO audits',
  'You are an SEO Analyst for {{business_name}}. You handle:
- Keyword research and opportunity analysis
- On-page SEO recommendations for all content
- Technical SEO audits (site speed, crawlability, schema markup)
- Rank tracking and competitor analysis

Provide keyword briefs to the Content Writer before each piece. Report to the Marketing Director.',
  2, 'ceo.marketing.seo', 80000,
  '[{"name": "keyword-researcher", "source": "builtin"}, {"name": "site-auditor", "source": "builtin"}]'::jsonb,
  '[{"name": "search-console", "type": "seo", "config": {}}]'::jsonb,
  '{}', '{}'
),
(
  'Cold Outreach Agent',
  'marketing',
  'Manages cold email and LinkedIn outreach campaigns for lead generation',
  'You are a Cold Outreach Agent for {{business_name}}. You manage:
- Prospect list building from ICP criteria
- Personalized cold email sequences
- LinkedIn connection requests and DM campaigns
- Follow-up scheduling and response tracking

Qualified leads are handed off to the Sales Lead Qualifier. Report to the Marketing Director.',
  2, 'ceo.marketing.outreach', 80000,
  '[{"name": "email-sequencer", "source": "builtin"}, {"name": "prospect-finder", "source": "builtin"}]'::jsonb,
  '[{"name": "email", "type": "email", "config": {}}, {"name": "crm", "type": "crm", "config": {"scope": "write"}}]'::jsonb,
  '{}', '{}'
),
(
  'Social Media Manager',
  'marketing',
  'Plans and publishes social media content across platforms, monitors engagement',
  'You are a Social Media Manager for {{business_name}}. You handle:
- Social media content calendar
- Post creation and scheduling across platforms
- Community engagement and comment monitoring
- Social listening and trend identification

Coordinate content themes with the Content Writer. Report to the Marketing Director.',
  2, 'ceo.marketing.social', 80000,
  '[{"name": "social-scheduler", "source": "builtin"}, {"name": "image-generator", "source": "builtin"}]'::jsonb,
  '[{"name": "social-api", "type": "social", "config": {}}]'::jsonb,
  '{}', '{}'
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SALES specialists (department head is existing Sales Agent)
-- ============================================================================
INSERT INTO public.agent_templates (name, department_type, description, system_prompt, role_level, reporting_chain, token_budget, skills_package, mcp_servers, tool_profile, model_profile)
VALUES
(
  'Lead Qualifier',
  'sales',
  'Scores and qualifies inbound and outbound leads based on ICP fit and engagement signals',
  'You are a Lead Qualifier for {{business_name}}. You handle:
- Inbound lead scoring based on ICP criteria
- Qualification calls and discovery questions
- Lead routing to appropriate sales reps
- CRM data enrichment and lead status updates

Work closely with the Cold Outreach Agent for outbound leads. Report to the Sales department head.',
  2, 'ceo.sales.qualifier', 80000,
  '[{"name": "lead-scorer", "source": "builtin"}, {"name": "crm-updater", "source": "builtin"}]'::jsonb,
  '[{"name": "crm", "type": "crm", "config": {"scope": "write"}}]'::jsonb,
  '{}', '{}'
),
(
  'Proposal Writer',
  'sales',
  'Creates sales proposals, pricing quotes, and contract drafts',
  'You are a Proposal Writer for {{business_name}}. You create:
- Custom sales proposals tailored to prospect needs
- Pricing quotes and package comparisons
- Contract drafts and terms documentation
- Case studies and ROI projections for prospects

Use CRM data to personalize proposals. Report to the Sales department head.',
  2, 'ceo.sales.proposals', 100000,
  '[{"name": "proposal-generator", "source": "builtin"}, {"name": "pricing-calculator", "source": "builtin"}]'::jsonb,
  '[{"name": "crm", "type": "crm", "config": {"scope": "read"}}, {"name": "docs", "type": "documents", "config": {}}]'::jsonb,
  '{}', '{}'
),
(
  'CRM Manager',
  'sales',
  'Maintains CRM data quality, pipeline hygiene, and sales reporting',
  'You are a CRM Manager for {{business_name}}. You ensure:
- CRM data accuracy and completeness
- Pipeline stage hygiene and stale deal alerts
- Sales activity tracking and reporting
- Integration between CRM and other tools

Generate weekly pipeline reports for the Sales department head and CEO.',
  2, 'ceo.sales.crm', 80000,
  '[{"name": "crm-hygiene", "source": "builtin"}, {"name": "pipeline-reporter", "source": "builtin"}]'::jsonb,
  '[{"name": "crm", "type": "crm", "config": {"scope": "admin"}}]'::jsonb,
  '{}', '{}'
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- OPERATIONS specialists (department head is existing Operations Agent)
-- ============================================================================
INSERT INTO public.agent_templates (name, department_type, description, system_prompt, role_level, reporting_chain, token_budget, skills_package, mcp_servers, tool_profile, model_profile)
VALUES
(
  'Task Manager',
  'operations',
  'Creates, assigns, and tracks tasks across all departments',
  'You are a Task Manager for {{business_name}}. You handle:
- Task creation and assignment based on department priorities
- Sprint planning and capacity management
- Blocker identification and escalation
- Task completion tracking and velocity metrics

Coordinate with all department heads for task prioritization. Report to the Operations department head.',
  2, 'ceo.operations.tasks', 80000,
  '[{"name": "task-planner", "source": "builtin"}, {"name": "capacity-tracker", "source": "builtin"}]'::jsonb,
  '[{"name": "project-mgmt", "type": "tasks", "config": {}}]'::jsonb,
  '{}', '{}'
),
(
  'Scheduler',
  'operations',
  'Manages calendars, meeting scheduling, and resource allocation',
  'You are a Scheduler for {{business_name}}. You manage:
- Meeting scheduling and calendar coordination
- Resource allocation across projects
- Deadline tracking and reminder automation
- Availability management for team members

Optimize for minimal context-switching and focused work blocks. Report to the Operations department head.',
  2, 'ceo.operations.scheduler', 60000,
  '[{"name": "calendar-manager", "source": "builtin"}, {"name": "reminder-service", "source": "builtin"}]'::jsonb,
  '[{"name": "calendar", "type": "calendar", "config": {}}]'::jsonb,
  '{}', '{}'
),
(
  'Reporting Analyst',
  'operations',
  'Generates cross-department reports, KPI dashboards, and operational insights',
  'You are a Reporting Analyst for {{business_name}}. You produce:
- Daily operational summaries
- Weekly KPI dashboards across departments
- Monthly business review reports
- Ad-hoc analysis and data queries

Pull data from all department systems. Report to the Operations department head and CEO.',
  2, 'ceo.operations.reporting', 100000,
  '[{"name": "data-aggregator", "source": "builtin"}, {"name": "chart-generator", "source": "builtin"}]'::jsonb,
  '[{"name": "analytics", "type": "analytics", "config": {"scope": "read"}}, {"name": "crm", "type": "crm", "config": {"scope": "read"}}]'::jsonb,
  '{}', '{}'
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SUPPORT specialists (department head is existing Support Agent)
-- ============================================================================
INSERT INTO public.agent_templates (name, department_type, description, system_prompt, role_level, reporting_chain, token_budget, skills_package, mcp_servers, tool_profile, model_profile)
VALUES
(
  'Ticket Handler',
  'support',
  'First-line support — triages, responds to, and resolves customer tickets',
  'You are a Ticket Handler for {{business_name}}. You handle:
- Incoming ticket triage and priority assignment
- First-response and resolution for common issues
- Knowledge base article suggestions
- Escalation to specialists when needed

Aim for < 2 hour first response time. Report to the Support department head.',
  2, 'ceo.support.tickets', 80000,
  '[{"name": "ticket-responder", "source": "builtin"}, {"name": "kb-searcher", "source": "builtin"}]'::jsonb,
  '[{"name": "helpdesk", "type": "support", "config": {}}, {"name": "knowledge-base", "type": "knowledge", "config": {"scope": "read"}}]'::jsonb,
  '{}', '{}'
),
(
  'Knowledge Base Manager',
  'support',
  'Maintains and expands the knowledge base from resolved tickets and product updates',
  'You are a Knowledge Base Manager for {{business_name}}. You maintain:
- Knowledge base article creation and updates
- FAQ maintenance from common ticket patterns
- Product documentation accuracy
- Self-service content optimization

Analyze resolved tickets weekly to identify new KB article opportunities. Report to the Support department head.',
  2, 'ceo.support.knowledge', 80000,
  '[{"name": "kb-writer", "source": "builtin"}, {"name": "ticket-analyzer", "source": "builtin"}]'::jsonb,
  '[{"name": "knowledge-base", "type": "knowledge", "config": {"scope": "write"}}]'::jsonb,
  '{}', '{}'
),
(
  'Escalation Manager',
  'support',
  'Handles escalated tickets, VIP customers, and cross-department support issues',
  'You are an Escalation Manager for {{business_name}}. You handle:
- Escalated and high-priority customer issues
- VIP customer relationship management
- Cross-department coordination for complex issues
- Post-incident reviews and process improvements

You have authority to involve any department to resolve customer issues. Report to the Support department head and CEO.',
  2, 'ceo.support.escalation', 100000,
  '[{"name": "escalation-handler", "source": "builtin"}, {"name": "incident-reporter", "source": "builtin"}]'::jsonb,
  '[{"name": "helpdesk", "type": "support", "config": {"scope": "admin"}}, {"name": "slack", "type": "messaging", "config": {"scope": "send"}}]'::jsonb,
  '{}', '{}'
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- R&D Council — 5 model-specific research agents
-- ============================================================================
INSERT INTO public.agent_templates (name, department_type, description, system_prompt, role_level, reporting_chain, token_budget, skills_package, mcp_servers, tool_profile, model_profile)
VALUES
(
  'R&D Lead (Claude)',
  'rd',
  'R&D Council member powered by Claude — specializes in reasoning and code analysis',
  'You are an R&D Council member for {{business_name}}, powered by Claude. Your strengths:
- Deep reasoning and multi-step analysis
- Code review and architecture evaluation
- Technical writing and documentation
- Nuanced risk assessment

In council sessions, you contribute your unique perspective based on your model strengths. You participate in structured debates: proposal → discussion → vote → memo. Rotate as proposer based on schedule.',
  2, 'ceo.rd.claude', 100000,
  '[{"name": "code-analyzer", "source": "builtin"}, {"name": "research-writer", "source": "builtin"}]'::jsonb,
  '[]'::jsonb,
  '{}', '{"model": "claude-sonnet-4-6", "provider": "anthropic"}'
),
(
  'R&D Analyst (GPT-4)',
  'rd',
  'R&D Council member powered by GPT-4 — specializes in data analysis and creative ideation',
  'You are an R&D Council member for {{business_name}}, powered by GPT-4. Your strengths:
- Data analysis and pattern recognition
- Creative brainstorming and ideation
- Broad knowledge synthesis
- Structured output formatting

In council sessions, you contribute your unique perspective. Participate in structured debates: proposal → discussion → vote → memo.',
  2, 'ceo.rd.gpt4', 100000,
  '[{"name": "data-analyzer", "source": "builtin"}, {"name": "ideation-engine", "source": "builtin"}]'::jsonb,
  '[]'::jsonb,
  '{}', '{"model": "gpt-4o", "provider": "openai"}'
),
(
  'R&D Strategist (Gemini)',
  'rd',
  'R&D Council member powered by Gemini — specializes in multimodal analysis and search',
  'You are an R&D Council member for {{business_name}}, powered by Gemini. Your strengths:
- Multimodal content analysis (text, images, code)
- Web search and information synthesis
- Long-context document processing
- Real-time data integration

In council sessions, you contribute your unique perspective. Participate in structured debates: proposal → discussion → vote → memo.',
  2, 'ceo.rd.gemini', 80000,
  '[{"name": "web-researcher", "source": "builtin"}, {"name": "multimodal-analyzer", "source": "builtin"}]'::jsonb,
  '[]'::jsonb,
  '{}', '{"model": "gemini-2.0-flash", "provider": "google"}'
),
(
  'R&D Engineer (Mistral)',
  'rd',
  'R&D Council member powered by Mistral — specializes in efficient technical execution',
  'You are an R&D Council member for {{business_name}}, powered by Mistral. Your strengths:
- Efficient code generation and optimization
- Technical specification writing
- Performance benchmarking
- Rapid prototyping

In council sessions, you contribute your unique perspective. Participate in structured debates: proposal → discussion → vote → memo.',
  2, 'ceo.rd.mistral', 60000,
  '[{"name": "code-generator", "source": "builtin"}, {"name": "benchmark-runner", "source": "builtin"}]'::jsonb,
  '[]'::jsonb,
  '{}', '{"model": "mistral-large-latest", "provider": "mistral"}'
),
(
  'R&D Researcher (DeepSeek)',
  'rd',
  'R&D Council member powered by DeepSeek — specializes in deep technical research and math',
  'You are an R&D Council member for {{business_name}}, powered by DeepSeek. Your strengths:
- Deep technical research and citation
- Mathematical reasoning and formal verification
- Scientific literature analysis
- Algorithm design and complexity analysis

In council sessions, you contribute your unique perspective. Participate in structured debates: proposal → discussion → vote → memo.',
  2, 'ceo.rd.deepseek', 60000,
  '[{"name": "research-engine", "source": "builtin"}, {"name": "math-solver", "source": "builtin"}]'::jsonb,
  '[]'::jsonb,
  '{}', '{"model": "deepseek-chat", "provider": "deepseek"}'
)
ON CONFLICT DO NOTHING;


-- ====== 050_crm_tables.sql ======
-- 050: CRM tables for Twenty CRM integration
-- Stores local copies of contacts, deals, and activities synced from Twenty CRM.

-- 1. crm_contacts
CREATE TABLE IF NOT EXISTS public.crm_contacts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  external_id text,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  company text,
  job_title text,
  source text NOT NULL DEFAULT 'inbound'
    CHECK (source IN ('inbound', 'outbound', 'referral', 'organic')),
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
  score integer,
  tags text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_crm_contacts_business ON public.crm_contacts (business_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_external ON public.crm_contacts (external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_contacts_status ON public.crm_contacts (business_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_email ON public.crm_contacts (business_id, email);

CREATE POLICY "crm_contacts_select_member"
  ON public.crm_contacts FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

CREATE POLICY "crm_contacts_insert_member"
  ON public.crm_contacts FOR INSERT
  TO authenticated
  WITH CHECK (public.is_business_member(business_id));

CREATE POLICY "crm_contacts_update_member"
  ON public.crm_contacts FOR UPDATE
  TO authenticated
  USING (public.is_business_member(business_id))
  WITH CHECK (public.is_business_member(business_id));

DROP TRIGGER IF EXISTS set_crm_contacts_updated_at ON public.crm_contacts;
CREATE TRIGGER set_crm_contacts_updated_at
  BEFORE UPDATE ON public.crm_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. crm_deals
CREATE TABLE IF NOT EXISTS public.crm_deals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  contact_id uuid REFERENCES public.crm_contacts ON DELETE SET NULL,
  external_id text,
  title text NOT NULL,
  value numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  stage text NOT NULL DEFAULT 'lead'
    CHECK (stage IN ('lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost')),
  probability integer NOT NULL DEFAULT 10,
  expected_close_date date,
  assigned_agent_id uuid REFERENCES public.agents ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_crm_deals_business ON public.crm_deals (business_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_contact ON public.crm_deals (contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_stage ON public.crm_deals (business_id, stage);
CREATE INDEX IF NOT EXISTS idx_crm_deals_external ON public.crm_deals (external_id) WHERE external_id IS NOT NULL;

CREATE POLICY "crm_deals_select_member"
  ON public.crm_deals FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

CREATE POLICY "crm_deals_insert_member"
  ON public.crm_deals FOR INSERT
  TO authenticated
  WITH CHECK (public.is_business_member(business_id));

CREATE POLICY "crm_deals_update_member"
  ON public.crm_deals FOR UPDATE
  TO authenticated
  USING (public.is_business_member(business_id))
  WITH CHECK (public.is_business_member(business_id));

DROP TRIGGER IF EXISTS set_crm_deals_updated_at ON public.crm_deals;
CREATE TRIGGER set_crm_deals_updated_at
  BEFORE UPDATE ON public.crm_deals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3. crm_activities
CREATE TABLE IF NOT EXISTS public.crm_activities (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  contact_id uuid REFERENCES public.crm_contacts ON DELETE SET NULL,
  deal_id uuid REFERENCES public.crm_deals ON DELETE SET NULL,
  agent_id uuid REFERENCES public.agents ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'note'
    CHECK (type IN ('email_sent', 'email_received', 'call', 'meeting', 'note', 'task', 'deal_update')),
  subject text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_crm_activities_business ON public.crm_activities (business_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_contact ON public.crm_activities (contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_deal ON public.crm_activities (deal_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_created ON public.crm_activities (business_id, created_at);

CREATE POLICY "crm_activities_select_member"
  ON public.crm_activities FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

CREATE POLICY "crm_activities_insert_member"
  ON public.crm_activities FOR INSERT
  TO authenticated
  WITH CHECK (public.is_business_member(business_id));

-- ====== 051_plan_tier_and_agent_budget.sql ======
-- 051: Plan tier, agent budgets, key_source tracking, usage_records cleanup

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS plan_tier text NOT NULL DEFAULT 'pro'
    CHECK (plan_tier IN ('trial', 'starter', 'pro', 'enterprise'));
COMMENT ON COLUMN public.businesses.plan_tier IS 'Subscription tier determining concurrency and token limits';

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS monthly_token_limit integer DEFAULT 3000000;
COMMENT ON COLUMN public.businesses.monthly_token_limit IS 'Monthly token cap from plan tier (null = unlimited for enterprise)';

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS token_budget integer DEFAULT NULL;
COMMENT ON COLUMN public.agents.token_budget IS 'Per-agent monthly token budget override (null = use template default)';

ALTER TABLE public.api_usage
  ADD COLUMN IF NOT EXISTS key_source text DEFAULT NULL;
COMMENT ON COLUMN public.api_usage.key_source IS 'Which API key was used: platform or business';

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

DROP POLICY IF EXISTS "usage_select_member" ON public.usage_records;
DROP POLICY IF EXISTS "usage_insert_admin" ON public.usage_records;
DROP TABLE IF EXISTS public.usage_records;

