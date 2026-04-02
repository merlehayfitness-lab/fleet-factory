-- 054: Add universal MCP servers to CEO template
-- CEO gets all 6 universal MCPs so sub-agents inherit them via copy-based deploy.

UPDATE public.agent_templates
SET mcp_servers = '[
  {"name": "filesystem", "type": "filesystem", "config": {}},
  {"name": "memory", "type": "knowledge", "config": {}},
  {"name": "brave-search", "type": "search", "config": {}},
  {"name": "fetch", "type": "http", "config": {}},
  {"name": "supabase", "type": "database", "config": {"scope": "read"}},
  {"name": "slack", "type": "messaging", "config": {"scope": "send"}}
]'::jsonb
WHERE name = 'CEO Agent' AND department_type = 'executive';
