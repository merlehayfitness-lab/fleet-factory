# Phase 15 Research: AITMPL Template Catalog

## Research Summary

**Confidence: HIGH** — AITMPL is a real, well-documented open-source platform with a public JSON API. The integration path is clear.

### What is AITMPL?

AITMPL (aitmpl.com) is an open-source marketplace for Claude Code components maintained by Daniel Avila (davila7). It provides 1,600+ pre-built templates across 7 categories:

| Category | Count | Format | Description |
|----------|-------|--------|-------------|
| **Skills** | 704 | Markdown (.md) | Reusable capabilities with trigger descriptions |
| **Agents** | 417 | Markdown (.md) | Specialized AI personas with system prompts |
| **Commands** | 280 | Markdown (.md) | Slash commands for Claude Code |
| **MCPs** | 68 | JSON (.json) | Model Context Protocol server configs |
| **Settings** | 67 | JSON (.json) | Claude Code configuration presets |
| **Hooks** | 54 | JSON (.json) | Event-triggered automation rules |
| **Plugins** | 10 | JSON manifest | Bundles of agents + commands + MCPs |

### Data Source

**Single JSON endpoint:** `https://www.aitmpl.com/components.json`
- ~10MB+ file containing ALL components with full content inline
- No authentication required
- No rate limits documented
- MIT licensed

### Component Schema (Universal)

```typescript
interface AitmplComponent {
  name: string;           // "ai-ethics-advisor"
  path: string;           // "ai-specialists/ai-ethics-advisor.md"
  category: string;       // "ai-specialists"
  type: string;           // "agent" | "skill" | "command" | "mcp" | "setting" | "hook"
  content: string;        // Full markdown/JSON content
  description: string;    // Brief description
  author: string;         // Usually empty
  repo: string;           // Usually empty
  version: string;        // Usually empty
  license: string;        // Usually empty
  keywords: string[];     // Usually empty
  downloads: number;      // Download count from CLI usage
  security: {
    validated: boolean;
    valid: boolean | null;
    score: number | null;
    errorCount: number;
    warningCount: number;
    lastValidated: string | null;
  };
}
```

**Plugin schema differs:**
```typescript
interface AitmplPlugin {
  name: string;
  id: string;
  type: "plugin";
  description: string;
  version: string;
  keywords: string[];
  author: string;
  commands: number;
  agents: number;
  mcpServers: number;
  commandsList: string[];
  agentsList: string[];      // paths like "data-ai/ai-engineer"
  mcpServersList: string[];
  installCommand: string;
  downloads: number;
}
```

**Template schema (project scaffolds) differs:**
```typescript
interface AitmplTemplate {
  name: string;
  id: string;
  type: "template";
  subtype: string;          // "framework"
  category: string;         // "frameworks"
  language: string;         // "javascript-typescript"
  description: string;
  files: string[];           // [".claude/commands/components.md", ...]
  installCommand: string;
  downloads: number;
}
```

### Category Breakdown (Agent Categories → Our Departments)

AITMPL agent categories with relevance to our department types:

| AITMPL Category | Our Department | Relevance |
|----------------|----------------|-----------|
| business-marketing | Sales, Owner | High |
| finance | Owner, Operations | High |
| expert-advisors | Owner | Medium |
| security | Operations | Medium |
| development-team | Operations | Medium |
| data-ai | Operations | Medium |
| devops-infrastructure | Operations | Medium |
| documentation | Support | Medium |

AITMPL skill categories:
| AITMPL Category | Our Department | Relevance |
|----------------|----------------|-----------|
| business-marketing, marketing | Sales | High |
| enterprise-communication | Support | High |
| productivity, workflow-automation | Operations | High |
| analytics | Owner | Medium |
| development, web-development | Operations | Medium |

### How CLI Installation Works

```bash
# Single component
npx claude-code-templates@latest --skill development/mcp-builder

# Multiple
npx claude-code-templates@latest --agent development-team/frontend-developer --command testing/unit-tests --yes

# Dry run
npx claude-code-templates@latest --agent your-agent --dry-run
```

The CLI writes files to `.claude/` directory structure. We don't need the CLI — we'll consume the JSON API directly.

---

## Standard Stack

### Data Fetching
- **Fetch `components.json` server-side** with Next.js `fetch()` and `next: { revalidate: 86400 }` (24h cache)
- Store as cached JSON in a service module — do NOT import into client bundles (10MB+)
- Server Actions filter and return only relevant slices to the client

### Search & Suggestions
- **Client-side text search** with `String.includes()` on name + description + category fields
- **Department-based filtering** using a static mapping table (AITMPL category → our department_type)
- No embeddings needed — the catalog has good category structure and descriptions
- Sort by `downloads` descending as default relevance signal

### UI Components
- Reuse existing patterns: `SkillTemplateBrowser` dialog pattern from Phase 9
- Card grid with category filters, search box, type tabs
- Detail panel showing description, content preview, install button

### Import Mechanism
- **Skills**: Copy `content` field directly into our `skills` table with `source_type: "imported"`, `source_url: "aitmpl://{type}/{path}"`
- **Agents**: Extract `content` (system prompt) into agent template or agent record
- **MCPs**: Parse JSON `content` and merge into agent `tool_profile.mcp_servers[]`
- **Commands**: Store as skills (commands are conceptually similar to our skill system)
- **Settings/Hooks**: Store as agent config metadata or display as recommended configurations
- **Plugins**: Decompose into constituent agents + commands + MCPs and import individually

---

## Architecture Patterns

### 1. Catalog Service (packages/core/aitmpl/)

```
packages/core/aitmpl/
  catalog-service.ts     -- fetch, cache, filter components.json
  catalog-types.ts       -- TypeScript types for AITMPL schema
  category-mapping.ts    -- AITMPL category → our department_type mapping
  import-service.ts      -- convert AITMPL component → our entity (skill, agent, tool_profile)
```

### 2. Server-Side Caching Pattern

Fetch `components.json` once per 24h, cache in memory (module-level variable with timestamp). The file is large but compresses well. Server Actions call the catalog service — never expose the full catalog to the client.

```typescript
// Catalog service pattern
let cachedData: AitmplCatalog | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

export async function getCatalog(): Promise<AitmplCatalog> {
  if (cachedData && Date.now() - cacheTimestamp < CACHE_TTL) return cachedData;
  const res = await fetch('https://www.aitmpl.com/components.json');
  cachedData = await res.json();
  cacheTimestamp = Date.now();
  return cachedData;
}

export async function searchComponents(query: string, type?: string, department?: string) {
  const catalog = await getCatalog();
  // Filter and return lightweight results (no content field)
  // Content fetched on-demand when user selects a component
}
```

### 3. Import Flow

1. User browses catalog in dialog (filtered by type + department)
2. User selects component → sees preview (description + content)
3. User clicks "Import" → Server Action:
   - Skills/Commands: `createSkill()` with content from AITMPL
   - Agents: Create/update agent system_prompt or create new sub-agent
   - MCPs: Merge into target agent's `tool_profile.mcp_servers`
   - Settings: Apply to agent `model_profile` or display as recommendation
   - Hooks: Store as agent metadata or display as recommendation

### 4. Wizard Integration

Add optional step to business setup wizard (between Departments and Review):
- "Enhance with Templates" step
- Shows recommended components per department based on category mapping
- User can skip or select components to pre-install
- Selected components queued for import after provisioning completes

### 5. Entity Mapping

| AITMPL Type | Our Entity | Field Mapping |
|-------------|------------|---------------|
| skill | skills | content → skills.content, name → skills.name, description → skills.description |
| agent | agent_templates or agents | content → system_prompt (extract from frontmatter) |
| command | skills | content → skills.content (commands ≈ skills in our model) |
| mcp | agents.tool_profile | Parse JSON → merge into tool_profile.mcp_servers[] |
| setting | agents.model_profile | Parse JSON → merge into model_profile |
| hook | (display only) | Show as recommended config, not stored |
| plugin | (decompose) | Import constituent agents/commands/MCPs individually |

---

## Don't Hand-Roll

1. **JSON caching** — Use module-level cache with TTL, not a database table for the catalog. The source is a single HTTP endpoint.
2. **Full-text search engine** — Don't add Fuse.js or Lunr. Simple `includes()` on name+description+category is sufficient for 1,600 items.
3. **Category mapping** — Don't use AI/embeddings to match AITMPL categories to departments. Use a static lookup table — there are only ~27 agent categories and 4 department types.
4. **Content transformation** — Don't parse/restructure AITMPL markdown. Store it as-is in our skills/agent system_prompt. Our existing skill compiler handles the rest.
5. **Authentication** — The API is public, no auth needed. Don't build an OAuth flow or API key management.

---

## Common Pitfalls

1. **Catalog size** — `components.json` is 10MB+. NEVER send the full catalog to the client. Always filter server-side and return lightweight results (name, description, category, downloads — no content).
2. **Stale cache in dev** — Module-level cache persists across hot reloads in Next.js dev mode. Add a `clearCatalogCache()` for development.
3. **Content format varies** — Skills/Agents are markdown with optional YAML frontmatter. MCPs/Settings/Hooks are JSON. Handle both formats.
4. **Empty fields** — Most components have empty `author`, `repo`, `version`, `license`, `keywords` fields. Don't rely on these for display.
5. **Plugin decomposition** — Plugins reference other components by path (e.g., "data-ai/ai-engineer"). Must resolve these paths against the catalog to get actual content.
6. **MCP content is JSON strings** — MCP `content` field contains JSON as a string, not parsed JSON. Must `JSON.parse(content)` before merging into tool_profile.
7. **Wizard step ordering** — Adding a step to the existing wizard (currently 3 steps) must not break the existing flow. Make the AITMPL step optional/skippable.
8. **Downloads as relevance** — Many components have 0 downloads. Use downloads for sorting but have a fallback (alphabetical or category match).

---

## Code Examples

### Fetching and Filtering

```typescript
// catalog-service.ts
export interface CatalogSearchResult {
  name: string;
  path: string;
  category: string;
  type: string;
  description: string;
  downloads: number;
}

export async function searchComponents(
  query: string,
  options?: { type?: string; department?: string; limit?: number }
): Promise<CatalogSearchResult[]> {
  const catalog = await getCatalog();
  const typeKey = options?.type ?? 'skills';
  const items = catalog[typeKey] ?? [];

  const lowerQuery = query.toLowerCase();
  const departmentCategories = options?.department
    ? DEPARTMENT_CATEGORY_MAP[options.department] ?? []
    : [];

  return items
    .filter(item => {
      const matchesQuery = !query ||
        item.name.toLowerCase().includes(lowerQuery) ||
        item.description.toLowerCase().includes(lowerQuery) ||
        item.category.toLowerCase().includes(lowerQuery);
      const matchesDept = !options?.department ||
        departmentCategories.includes(item.category);
      return matchesQuery && matchesDept;
    })
    .sort((a, b) => b.downloads - a.downloads)
    .slice(0, options?.limit ?? 50)
    .map(({ name, path, category, type, description, downloads }) => ({
      name, path, category, type, description, downloads
    }));
}
```

### Category Mapping

```typescript
// category-mapping.ts
export const DEPARTMENT_CATEGORY_MAP: Record<string, string[]> = {
  owner: ['business-marketing', 'finance', 'expert-advisors', 'analytics'],
  sales: ['business-marketing', 'marketing', 'enterprise-communication', 'web-data'],
  support: ['documentation', 'enterprise-communication', 'productivity'],
  operations: ['security', 'development-team', 'devops-infrastructure', 'data-ai', 'workflow-automation', 'database'],
};
```

### Importing a Skill from AITMPL

```typescript
// import-service.ts
export async function importFromAitmpl(
  supabase: SupabaseClient,
  businessId: string,
  componentPath: string,
  componentType: string,
  targetAgentId?: string,
  targetDepartmentId?: string
) {
  const catalog = await getCatalog();
  const items = catalog[componentType + 's'] ?? [];
  const component = items.find(i => i.path === componentPath);
  if (!component) throw new Error(`Component not found: ${componentPath}`);

  if (componentType === 'skill' || componentType === 'command') {
    return createSkill(supabase, {
      business_id: businessId,
      name: component.name,
      description: component.description,
      content: component.content,
      source_type: 'imported',
      source_url: `aitmpl://${componentType}/${componentPath}`,
    });
  }

  if (componentType === 'mcp') {
    const mcpConfig = JSON.parse(component.content);
    // Merge into target agent's tool_profile
    // ...
  }
}
```

---

## Open Questions (Low Risk)

1. **Catalog freshness** — 24h TTL is reasonable. Could add a manual "Refresh Catalog" button for admins.
2. **Content licensing** — AITMPL is MIT licensed. Components may have individual licenses (usually empty). Safe for commercial use.
3. **Offline fallback** — If aitmpl.com is down, the catalog browse won't work. Could bundle a snapshot for MVP, but the 10MB size makes this impractical. Graceful error message is sufficient.

---

## RESEARCH COMPLETE

**Key findings:**
- AITMPL has a clean public JSON API (`components.json`) — no auth, no SDK needed
- 1,600+ components across 7 types, all with inline content
- Direct mapping to our existing entities (skills, agent system_prompts, tool_profile MCPs)
- Existing patterns (SkillTemplateBrowser, GitHub import) provide the UI blueprint
- Main risk is catalog size (10MB+) — must filter server-side, never expose full catalog to client
