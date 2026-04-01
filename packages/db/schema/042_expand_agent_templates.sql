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
