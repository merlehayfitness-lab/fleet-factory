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
