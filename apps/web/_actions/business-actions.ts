"use server";

import { createServerClient } from "@/_lib/supabase/server";
import { redirect } from "next/navigation";
import {
  createBusinessSchema,
  provisionBusinessTenant,
} from "@fleet-factory/core";
import {
  saveProviderCredentials,
  allocatePortBlock,
} from "@fleet-factory/core/server";

// ---------------------------------------------------------------------------
// VPS SSH connection test
// ---------------------------------------------------------------------------

/**
 * Test SSH connectivity for a given VPS config.
 * Used in the wizard Deployment Target step.
 */
export async function testVpsSshConnection(params: {
  host: string;
  sshUser: string;
  sshPassword: string;
  sshPort: number;
}): Promise<{ ok: boolean; message: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Not authenticated" };
  }

  try {
    const { getConnection, disconnect } = await import(
      "@fleet-factory/core/vps/ssh-client"
    );
    const ssh = await getConnection({
      host: params.host,
      port: params.sshPort || 22,
      username: params.sshUser || "root",
      password: params.sshPassword || undefined,
    });
    // Run a simple test command
    const result = await ssh.execCommand("echo ok");
    disconnect();
    if (result.stdout.trim() === "ok") {
      return { ok: true, message: "Connected successfully" };
    }
    return { ok: false, message: "Connected but test command failed" };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Connection failed",
    };
  }
}

// ---------------------------------------------------------------------------
// Subdomain availability check
// ---------------------------------------------------------------------------

/**
 * Checks if a subdomain is available for a new business.
 * Validates format and queries the businesses table for uniqueness.
 */
export async function checkSubdomainAvailability(
  subdomain: string,
): Promise<{ available: boolean; error?: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { available: false, error: "Not authenticated" };
  }

  // Validate format: lowercase alphanumeric + hyphens, 3-63 chars, no leading/trailing hyphens
  const subdomainRegex = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/;
  if (!subdomainRegex.test(subdomain)) {
    return {
      available: false,
      error:
        "Subdomain must be 3-63 characters, lowercase letters, numbers, and hyphens only. No leading or trailing hyphens.",
    };
  }

  if (subdomain.length < 3) {
    return { available: false, error: "Subdomain must be at least 3 characters" };
  }

  try {
    const { data, error } = await supabase
      .from("businesses")
      .select("id")
      .eq("subdomain", subdomain)
      .limit(1)
      .maybeSingle();

    if (error) {
      return { available: false, error: "Failed to check availability" };
    }

    return { available: data === null };
  } catch {
    return { available: false, error: "Failed to check availability" };
  }
}

// ---------------------------------------------------------------------------
// API key validation
// ---------------------------------------------------------------------------

/**
 * Validates an API key by making a real test call to the provider.
 * Returns { valid: true } on success, { valid: false, error } on failure.
 */
export async function validateApiKey(
  provider: string,
  apiKey: string,
): Promise<{ valid: boolean; error?: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { valid: false, error: "Not authenticated" };
  }

  if (!apiKey || apiKey.length < 5) {
    return { valid: false, error: "API key is too short" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    switch (provider) {
      case "anthropic": {
        // OAuth tokens (sk-ant-oat01-...) work with Claude Code/OpenClaw but
        // NOT with the raw Anthropic Messages API. Validate format only.
        if (apiKey.startsWith("sk-ant-oat01-")) {
          if (apiKey.length < 40) {
            return { valid: false, error: "OAuth token looks too short" };
          }
          return { valid: true };
        }
        // Standard API keys — test against the Messages API
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-20250514",
            max_tokens: 1,
            messages: [{ role: "user", content: "hi" }],
          }),
          signal: controller.signal,
        });
        if (res.status === 401 || res.status === 403) {
          return { valid: false, error: "Invalid API key" };
        }
        return { valid: true };
      }

      case "openai": {
        const res = await fetch("https://api.openai.com/v1/models", {
          method: "GET",
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: controller.signal,
        });
        if (res.status === 401 || res.status === 403) {
          return { valid: false, error: "Invalid API key" };
        }
        return { valid: true };
      }

      case "google": {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
          { method: "GET", signal: controller.signal },
        );
        if (res.status === 400 || res.status === 403) {
          return { valid: false, error: "Invalid API key" };
        }
        return { valid: true };
      }

      case "mistral": {
        const res = await fetch("https://api.mistral.ai/v1/models", {
          method: "GET",
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: controller.signal,
        });
        if (res.status === 401 || res.status === 403) {
          return { valid: false, error: "Invalid API key" };
        }
        return { valid: true };
      }

      case "deepseek": {
        const res = await fetch("https://api.deepseek.com/v1/models", {
          method: "GET",
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: controller.signal,
        });
        if (res.status === 401 || res.status === 403) {
          return { valid: false, error: "Invalid API key" };
        }
        return { valid: true };
      }

      default:
        return { valid: false, error: `Unknown provider: ${provider}` };
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { valid: false, error: "Request timed out" };
    }
    return { valid: false, error: "Could not reach provider" };
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Business creation
// ---------------------------------------------------------------------------

/**
 * Creates a new business tenant via the atomic provisioning RPC.
 *
 * Validates input with Zod, verifies authentication, then delegates
 * all provisioning logic to the Postgres RPC function.
 */
export async function createBusiness(formData: FormData) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const parsed = createBusinessSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    industry: formData.get("industry"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  let businessId: string;
  try {
    businessId = await provisionBusinessTenant(supabase, parsed.data);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Provisioning failed",
    };
  }

  redirect(`/businesses/${businessId}`);
}

/**
 * V2: Creates a business with department tree selection, API keys,
 * subdomain, port allocation, and template-aware agent provisioning.
 */
export async function createBusinessV2(formData: FormData) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // 1. Validate business details
  const parsed = createBusinessSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    industry: formData.get("industry"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const subdomain = (formData.get("subdomain") as string) || parsed.data.slug;
  const selectedTemplateIds: string[] = JSON.parse(
    (formData.get("selectedTemplates") as string) || "[]",
  );
  const apiKeys: Array<{ provider: string; key: string }> = JSON.parse(
    (formData.get("apiKeys") as string) || "[]",
  );
  const slackTokens: { botToken?: string; appToken?: string; teamId?: string } =
    JSON.parse((formData.get("slackTokens") as string) || "{}");
  const vpsConfigRaw = formData.get("vpsConfig") as string | null;
  const vpsConfigInput: {
    host: string;
    sshUser: string;
    sshPassword: string;
    proxyApiKey: string;
    sshPort: string;
    proxyPort: string;
  } | null = vpsConfigRaw ? JSON.parse(vpsConfigRaw) : null;
  const mcpConfigRaw = formData.get("mcpConfig") as string | null;
  const mcpConfigEntries: Array<{
    name: string;
    enabled: boolean;
    isUniversal: boolean;
    isCustom?: boolean;
    npmPackage?: string;
  }> = mcpConfigRaw ? JSON.parse(mcpConfigRaw) : [];

  // 2. Provision business (atomic RPC — creates business, membership, 4 default departments, default agents, deployment)
  let businessId: string;
  try {
    businessId = await provisionBusinessTenant(supabase, parsed.data);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Provisioning failed",
    };
  }

  // 3. Save subdomain
  try {
    await supabase
      .from("businesses")
      .update({ subdomain })
      .eq("id", businessId);
  } catch {
    // Non-critical: subdomain is optional
  }

  // 4. Save API keys (encrypted)
  try {
    for (const key of apiKeys) {
      if (key.key.length > 0) {
        await saveProviderCredentials(supabase, businessId, key.provider, {
          api_key: key.key,
        });
      }
    }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to save API keys",
    };
  }

  // 5. Save per-business VPS config (if provided) + MCP server config
  const mcpServerNames = mcpConfigEntries.filter((m) => m.enabled).map((m) => ({
    name: m.name,
    isCustom: m.isCustom ?? false,
    npmPackage: m.npmPackage,
  }));
  if (vpsConfigInput?.host || mcpServerNames.length > 0) {
    try {
      // Non-sensitive config stored in businesses.vps_config
      const vpsConfigData: Record<string, unknown> = {};
      if (vpsConfigInput?.host) {
        vpsConfigData.host = vpsConfigInput.host;
        vpsConfigData.ssh_user = vpsConfigInput.sshUser || "root";
        vpsConfigData.ssh_port = Number(vpsConfigInput.sshPort) || 22;
        vpsConfigData.proxy_port = Number(vpsConfigInput.proxyPort) || 3100;
      }
      if (mcpServerNames.length > 0) {
        vpsConfigData.mcp_servers = mcpServerNames;
      }
      await supabase
        .from("businesses")
        .update({ vps_config: vpsConfigData })
        .eq("id", businessId);

      // Sensitive credentials stored encrypted in secrets table
      if (vpsConfigInput?.host) {
        const vpsSecrets: Record<string, string> = {};
        if (vpsConfigInput.sshPassword) vpsSecrets.ssh_password = vpsConfigInput.sshPassword;
        if (vpsConfigInput.proxyApiKey) vpsSecrets.proxy_api_key = vpsConfigInput.proxyApiKey;
        if (Object.keys(vpsSecrets).length > 0) {
          await saveProviderCredentials(supabase, businessId, "vps", vpsSecrets);
        }
      }
    } catch {
      // Non-critical: VPS config can be set later in settings
    }
  }

  // 6. Port allocation (now handled dynamically during Docker deploy on VPS)
  // Legacy DB-side port allocation kept for backward compat
  try {
    await allocatePortBlock(supabase, businessId);
  } catch {
    // Non-critical: Docker deploy allocates ports on VPS
  }

  // 7. Template-aware provisioning: create V2 departments and agents
  try {
    await provisionV2Agents(supabase, businessId, selectedTemplateIds);
  } catch (err) {
    // Non-critical: business exists from RPC, V2 agents can be fixed from settings
    console.error("V2 agent provisioning error:", err);
  }

  // 8. SSH Deploy (if configured) — dynamic import to avoid native node-ssh/ssh2 in webpack bundle
  const { isSshConfigured } = await import(
    "@fleet-factory/core/vps/ssh-client"
  );
  // Resolve per-business SSH config for this deploy
  const { getVpsConfigForBusiness } = await import(
    "@fleet-factory/core/vps/vps-config"
  );
  const perBusinessVps = await getVpsConfigForBusiness(supabase, businessId).catch(() => null);

  if (isSshConfigured(perBusinessVps?.sshConfig)) {
    try {
      const { sshDeployBusiness } = await import(
        "@fleet-factory/core/vps/ssh-deploy"
      );
      const { generateOpenClawWorkspace } = await import(
        "@fleet-factory/core/server"
      );
      const { getMcpNpmPackages } = await import(
        "@fleet-factory/core/agent/mcp-service"
      );

      // Fetch real agents for SSH deploy (with template data for MCP resolution)
      const { data: allAgents } = await supabase
        .from("agents")
        .select("id, name, department_id, parent_agent_id, template_id, system_prompt, tool_profile, model_profile, status, skill_definition, token_budget, role_level, reporting_chain")
        .eq("business_id", businessId);

      const { data: allDepts } = await supabase
        .from("departments")
        .select("id, type, name, department_skill")
        .eq("business_id", businessId);

      // Fetch template MCP servers for each agent
      const templateIds = [...new Set((allAgents ?? []).map((a: { template_id: string }) => a.template_id).filter(Boolean))];
      const { data: templates } = templateIds.length > 0
        ? await supabase
            .from("agent_templates")
            .select("id, mcp_servers")
            .in("id", templateIds)
        : { data: [] };
      const templateMcpMap = new Map(
        (templates ?? []).map((t: { id: string; mcp_servers: unknown }) => [t.id, t.mcp_servers]),
      );

      const deptMap = new Map(
        (allDepts ?? []).map((d: { id: string; type: string }) => [d.id, d.type]),
      );

      // Convert MCP config entries to McpServerDef[] for workspace generation
      const businessMcpDefs = mcpConfigEntries
        .filter((m) => m.enabled)
        .map((m) => ({
          name: m.name,
          type: m.isCustom ? "custom" : "standard",
          config: m.npmPackage ? { npmPackage: m.npmPackage } : {},
        }));

      // Generate workspace files + OpenClaw config with MCPs
      const agentsForWorkspace = (allAgents ?? []).map(
        (a: {
          id: string;
          name: string;
          department_id: string;
          system_prompt: string;
          tool_profile: Record<string, unknown>;
          model_profile: Record<string, unknown>;
          status: string;
          skill_definition: string | null;
          template_id: string;
          token_budget: number | null;
          role_level: number | null;
          reporting_chain: string | null;
        }) => ({
          ...a,
          token_budget: a.token_budget ?? undefined,
          role_level: a.role_level ?? undefined,
          mcp_servers: (templateMcpMap.get(a.template_id) ?? []) as Array<{ name: string; type: string; config: Record<string, unknown> }>,
        }),
      );

      const { files: workspaceFiles, config: openclawConfig } = generateOpenClawWorkspace(
        { id: businessId, name: parsed.data.name, slug: parsed.data.slug, industry: parsed.data.industry },
        agentsForWorkspace,
        (allDepts ?? []).map((d: { id: string; type: string; name: string; department_skill: string | null }) => ({
          id: d.id,
          type: d.type,
          name: d.name,
          department_skill: d.department_skill,
        })),
        {},
        businessMcpDefs,
      );

      // Collect all MCP npm packages to install on VPS
      const allMcpNames = [
        ...mcpConfigEntries.filter((m) => m.enabled).map((m) => m.name),
        ...(allAgents ?? []).flatMap((a: { template_id: string }) => {
          const mcps = templateMcpMap.get(a.template_id) as Array<{ name: string }> | undefined;
          return (mcps ?? []).map((m) => m.name);
        }),
      ];
      const mcpNpmPackages = getMcpNpmPackages([...new Set(allMcpNames)]);

      // Extract Anthropic API key for per-tenant Docker containers
      const anthropicKey = apiKeys.find((k) => k.provider === "anthropic")?.key;

      await sshDeployBusiness(supabase, {
        businessId,
        businessSlug: parsed.data.slug,
        deploymentId: "",
        subdomain,
        agents: (allAgents ?? []).map(
          (agent: {
            id: string;
            name: string;
            department_id: string;
            parent_agent_id: string | null;
          }) => ({
            agentId: agent.id,
            vpsAgentId: `${parsed.data.slug}-${deptMap.get(agent.department_id) ?? "general"}-${agent.id.replace(/-/g, "").slice(0, 8)}`,
            departmentType: deptMap.get(agent.department_id) ?? "general",
            model: "claude-sonnet-4-6",
            isCeo: agent.parent_agent_id === null,
            templateName: agent.name,
            tokenBudget: 100000,
          }),
        ),
        workspaceFiles,
        openclawConfig,
        sshConfig: perBusinessVps?.sshConfig,
        mcpNpmPackages,
        anthropicApiKey: anthropicKey,
        slackBotToken: slackTokens.botToken,
        slackAppToken: slackTokens.appToken,
        slackTeamId: slackTokens.teamId,
      });
    } catch (sshErr) {
      console.error("[createBusinessV2] SSH deploy failed:", sshErr);
      // Continue — business was created, deploy can be retried
    }
  }

  redirect(`/businesses/${businessId}/deployments`);
}

// ---------------------------------------------------------------------------
// V2 template-aware provisioning helper
// ---------------------------------------------------------------------------

interface V2Template {
  id: string;
  name: string;
  department_type: string;
  system_prompt: string;
  tool_profile: Record<string, unknown>;
  model_profile: Record<string, unknown>;
  role_level: number;
  reporting_chain: string | null;
  token_budget: number;
  parent_template_id: string | null;
}

/**
 * Creates V2 departments and agents from selected template IDs.
 * This runs after the base RPC which already creates owner, sales, support, operations
 * departments and their default agents.
 *
 * Steps:
 * 1. Fetch selected templates from agent_templates
 * 2. Determine which new departments need creating (executive, marketing, rd, hr)
 * 3. Create agents sorted by role_level (CEO first, then heads, then specialists)
 * 4. Resolve parent_agent_id via template hierarchy
 * 5. Skip agents already created by the base RPC
 */
async function provisionV2Agents(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  businessId: string,
  selectedTemplateIds: string[],
) {
  if (selectedTemplateIds.length === 0) return;

  // 1. Fetch V2 templates from DB matching selected IDs
  // The wizard uses short string IDs (e.g., "ceo", "mkt-dir") which are static template names.
  // The DB uses UUID IDs. We need to match by name from the static DEPARTMENT_TEMPLATES list.
  // However, since the wizard selectedTemplateIds are the static shorthand IDs and the DB templates
  // have UUID IDs, we fetch ALL active V2 templates and match by name pattern.
  const { data: dbTemplates, error: templateError } = await supabase
    .from("agent_templates")
    .select(
      "id, name, department_type, system_prompt, tool_profile, model_profile, role_level, reporting_chain, token_budget, parent_template_id",
    )
    .eq("is_active", true)
    .order("role_level", { ascending: true });

  if (templateError || !dbTemplates || dbTemplates.length === 0) {
    return;
  }

  // Build a name-to-template map for matching wizard shorthand IDs
  // The wizard uses IDs like "ceo", "mkt-dir", "sales-head" etc. which map to template names.
  // We need to match these to DB templates.
  const shortIdToTemplateName: Record<string, string> = {
    ceo: "CEO Agent",
    "mkt-dir": "Marketing Director",
    "mkt-content": "Content Writer",
    "mkt-seo": "SEO Analyst",
    "mkt-outreach": "Cold Outreach Agent",
    "mkt-social": "Social Media Manager",
    "sales-head": "Sales Agent",
    "sales-qualifier": "Lead Qualifier",
    "sales-proposal": "Proposal Writer",
    "sales-crm": "CRM Manager",
    "ops-head": "Operations Agent",
    "ops-tasks": "Task Manager",
    "ops-scheduler": "Scheduler",
    "ops-reporting": "Reporting Analyst",
    "support-head": "Support Agent",
    "support-tickets": "Ticket Handler",
    "support-kb": "Knowledge Base Manager",
    "support-escalation": "Escalation Manager",
    "rd-claude": "R&D Lead (Claude)",
    "rd-gpt4": "R&D Analyst (GPT-4)",
    "rd-gemini": "R&D Strategist (Gemini)",
    "rd-mistral": "R&D Engineer (Mistral)",
    "rd-deepseek": "R&D Researcher (DeepSeek)",
  };

  // Map DB templates by name for fast lookup
  const templatesByName = new Map<string, V2Template>();
  for (const t of dbTemplates) {
    templatesByName.set(t.name, t as V2Template);
  }

  // Resolve selected templates: match wizard short IDs to DB templates
  const selectedTemplates: V2Template[] = [];
  for (const shortId of selectedTemplateIds) {
    const templateName = shortIdToTemplateName[shortId];
    if (templateName) {
      const dbTemplate = templatesByName.get(templateName);
      if (dbTemplate) {
        selectedTemplates.push(dbTemplate);
      }
    }
  }

  if (selectedTemplates.length === 0) return;

  // 2. Get existing departments created by the base RPC
  const { data: existingDepts } = await supabase
    .from("departments")
    .select("id, type, name")
    .eq("business_id", businessId);

  const deptByType = new Map<string, string>();
  for (const d of existingDepts ?? []) {
    deptByType.set(d.type, d.id);
  }

  // 3. Get existing agents created by the base RPC (to skip duplicates)
  const { data: existingAgents } = await supabase
    .from("agents")
    .select("id, template_id, name")
    .eq("business_id", businessId);

  const existingTemplateIds = new Set(
    (existingAgents ?? []).map((a: { template_id: string }) => a.template_id),
  );

  // 4. Determine new departments to create
  const uniqueDeptTypes = new Set(selectedTemplates.map((t) => t.department_type));
  for (const deptType of uniqueDeptTypes) {
    if (!deptByType.has(deptType)) {
      const deptName =
        deptType === "rd"
          ? "R&D"
          : deptType === "hr"
            ? "HR"
            : deptType.charAt(0).toUpperCase() + deptType.slice(1);

      const { data: newDept } = await supabase
        .from("departments")
        .insert({
          business_id: businessId,
          name: deptName,
          type: deptType,
        })
        .select("id")
        .single();

      if (newDept) {
        deptByType.set(deptType, newDept.id);
      }
    }
  }

  // 5. Create agents in hierarchy order (role_level 0 first, then 1, then 2)
  // Track templateId -> agentId for parent resolution
  const templateToAgentId = new Map<string, string>();

  // Also populate map with existing agents (from base RPC)
  for (const agent of existingAgents ?? []) {
    const a = agent as { id: string; template_id: string };
    templateToAgentId.set(a.template_id, a.id);
  }

  // Sort by role_level ascending
  const sortedTemplates = [...selectedTemplates].sort(
    (a, b) => a.role_level - b.role_level,
  );

  for (const template of sortedTemplates) {
    // Skip if agent already created by base RPC for this template
    if (existingTemplateIds.has(template.id)) {
      continue;
    }

    const departmentId = deptByType.get(template.department_type);
    if (!departmentId) continue;

    // Resolve parent_agent_id from parent_template_id
    let parentAgentId: string | null = null;
    if (template.parent_template_id) {
      parentAgentId = templateToAgentId.get(template.parent_template_id) ?? null;
    } else if (template.role_level === 1) {
      // Department heads report to CEO — find the CEO agent
      // CEO has role_level 0 and department_type 'executive'
      const ceoTemplate = sortedTemplates.find(
        (t) => t.role_level === 0 && t.department_type === "executive",
      );
      if (ceoTemplate) {
        parentAgentId = templateToAgentId.get(ceoTemplate.id) ?? null;
      }
    } else if (template.role_level === 2 && !template.parent_template_id) {
      // Specialists without explicit parent — find their department head
      const deptHead = sortedTemplates.find(
        (t) =>
          t.department_type === template.department_type && t.role_level === 1,
      );
      if (deptHead) {
        parentAgentId = templateToAgentId.get(deptHead.id) ?? null;
      }
    }

    const { data: newAgent } = await supabase
      .from("agents")
      .insert({
        business_id: businessId,
        department_id: departmentId,
        template_id: template.id,
        name: template.name,
        system_prompt: template.system_prompt,
        tool_profile: template.tool_profile,
        model_profile: template.model_profile,
        status: "active",
        parent_agent_id: parentAgentId,
      })
      .select("id")
      .single();

    if (newAgent) {
      templateToAgentId.set(template.id, newAgent.id);
    }
  }
}
