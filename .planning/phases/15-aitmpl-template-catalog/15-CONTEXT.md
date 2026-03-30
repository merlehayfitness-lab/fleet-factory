# Phase 15 Context: AITMPL Template Catalog

## Catalog Browsing

### Where it lives
- **Dialog overlay** — opens as a large modal over the current page (matches existing Skill Template Browser and GitHub Import dialog patterns)
- No standalone page — all browsing happens in the dialog

### Organization
- **Tabs per type** — tab bar at top: Skills, Agents, Commands, MCPs, Settings, Hooks, Plugins
- Each tab shows its own grid of components

### Card style
- **Rich cards** — name + description (2-3 lines) + category badge + download count + "Add" button directly on card
- Download count displayed as popularity signal (e.g., "463 installs")

### Search & filtering
- **Search box** at top of dialog for text filtering (name, description, category)
- **Category dropdown filter** to narrow by AITMPL category (e.g., "business-marketing", "security")
- **Sort dropdown** — Most Popular (default), A-Z, Newest

---

## Wizard Integration

### Wizard flow
- **Wizard stays 3 steps** — no new step added
- After business creation and redirect to dashboard, show a **dismissible banner**: "Enhance your agents with AITMPL templates" with a "Browse Catalog" button
- Banner behavior: Claude decides — lean toward dismissible after one catalog browse or explicit dismiss

### Other access points
- **Agent config page** — "Browse AITMPL" button on agent detail (Skills tab, Tool Profile section). Context-aware: pre-filtered to relevant type for that section.
- **Skill Template Library** — AITMPL as a new source alongside existing local templates. "Browse AITMPL" button in the library UI.
- These two entry points are the primary ways to access the catalog beyond the dashboard banner.

---

## Import Behavior

### Selection flow
1. User clicks "Add" on a card → **detail panel opens** showing full content/description
2. User reads preview, then clicks "Import" to confirm
3. **Target picker dialog** asks: "Assign to which agent or department?" with a dropdown
4. Import executes, success toast shown

### Entity mapping on import
| AITMPL Type | Our Entity | Behavior |
|-------------|------------|----------|
| Skill | `skills` table | Content → `skills.content`, assigned to selected agent/dept |
| Command | `skills` table | Treated as a skill — content stored as skill document |
| Agent | Agent `system_prompt` | Content extracted as system prompt for selected agent |
| MCP | `tool_profile.mcp_servers[]` | **Auto-merge with confirmation** — show what will be added, user confirms, JSON merged into selected agent's tool_profile |
| Setting | `skills` table | Imported as a skill document (content describes configuration) |
| Hook | `skills` table | Imported as a skill document (content describes hook config) |
| Plugin | Decomposed | Constituent agents/commands/MCPs imported individually |

### Key rules
- Settings, Hooks, and Plugins are **imported as skills** — the content is stored as a skill document that describes the configuration
- MCP imports show a confirmation preview of what will be merged into tool_profile before applying

---

## Suggestion Logic

### Recommendation approach
- **Static mapping** — hardcoded lookup table: AITMPL category → our department_type
- Example: Sales → ["business-marketing", "marketing", "enterprise-communication"]
- No AI/embeddings — simple, reliable, fast

### Recommendation display
- **"Recommended" badge** shown on components matching current department/agent context
- **Pre-filtered** — when catalog opens from an agent/department context, default view shows recommended items first
- **Top 10 per tab** shown by default before user starts searching
- Sorted by download count (Most Popular) as default sort

### Download counts
- **Displayed on cards** as popularity signal (e.g., "463 installs")
- Used as default sort order

---

## Deferred Ideas

None captured during discussion.
