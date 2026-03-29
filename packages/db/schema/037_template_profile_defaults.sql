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
