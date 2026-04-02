-- 055: Add department-recommended MCP servers to templates
-- Updates existing templates with tool assignments that match their roles.
-- Only touches templates that are currently missing MCPs or need additions.

-- ============================================================================
-- CEO Agent: add sequential-thinking + github
-- ============================================================================
UPDATE public.agent_templates
SET mcp_servers = mcp_servers || '[
  {"name": "sequential-thinking", "type": "reasoning", "config": {}},
  {"name": "github", "type": "code", "config": {}}
]'::jsonb
WHERE name = 'CEO Agent' AND department_type = 'executive';

-- ============================================================================
-- Sales Agent (department head): add crm, email, docs
-- ============================================================================
UPDATE public.agent_templates
SET mcp_servers = '[
  {"name": "crm", "type": "crm", "config": {}},
  {"name": "email", "type": "email", "config": {}},
  {"name": "docs", "type": "documents", "config": {}}
]'::jsonb
WHERE name = 'Sales Agent' AND department_type = 'sales'
  AND (mcp_servers IS NULL OR mcp_servers = '[]'::jsonb);

-- ============================================================================
-- Support Agent (department head): add helpdesk, knowledge-base
-- ============================================================================
UPDATE public.agent_templates
SET mcp_servers = '[
  {"name": "helpdesk", "type": "support", "config": {}},
  {"name": "knowledge-base", "type": "knowledge", "config": {"scope": "read"}}
]'::jsonb
WHERE name = 'Support Agent' AND department_type = 'support'
  AND (mcp_servers IS NULL OR mcp_servers = '[]'::jsonb);

-- ============================================================================
-- Operations Agent (department head): add project-mgmt, calendar
-- ============================================================================
UPDATE public.agent_templates
SET mcp_servers = '[
  {"name": "project-mgmt", "type": "tasks", "config": {}},
  {"name": "calendar", "type": "calendar", "config": {}}
]'::jsonb
WHERE name = 'Operations Agent' AND department_type = 'operations'
  AND (mcp_servers IS NULL OR mcp_servers = '[]'::jsonb);

-- ============================================================================
-- Marketing Director: add social-api, cms
-- ============================================================================
UPDATE public.agent_templates
SET mcp_servers = mcp_servers || '[
  {"name": "social-api", "type": "social", "config": {}},
  {"name": "cms", "type": "content", "config": {}}
]'::jsonb
WHERE name = 'Marketing Director' AND department_type = 'marketing';

-- ============================================================================
-- R&D agents (all 5): add puppeteer + postgres
-- ============================================================================
UPDATE public.agent_templates
SET mcp_servers = '[
  {"name": "puppeteer", "type": "browser", "config": {}},
  {"name": "postgres", "type": "database", "config": {}}
]'::jsonb
WHERE department_type = 'rd'
  AND (mcp_servers IS NULL OR mcp_servers = '[]'::jsonb);
