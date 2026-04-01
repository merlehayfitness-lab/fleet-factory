"use server";

import { createServerClient } from "@/_lib/supabase/server";
import { redirect } from "next/navigation";
import {
  createBusinessSchema,
  provisionBusinessTenant,
} from "@agency-factory/core";
import {
  saveProviderCredentials,
  allocatePortBlock,
} from "@agency-factory/core/server";

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
        // 200 = valid, 401 = invalid key, other = likely valid key but some other issue
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
 * subdomain, port allocation, and SSH deployment.
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

  // 2. Provision business (atomic RPC)
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

  // 5. Allocate port block
  try {
    await allocatePortBlock(supabase, businessId);
  } catch {
    // Non-critical: port allocation can be retried
  }

  // 6. SSH Deploy (if configured) — dynamic import to avoid native node-ssh/ssh2 in webpack bundle
  const { isSshConfigured } = await import("@agency-factory/core/vps/ssh-client");
  if (isSshConfigured()) {
    try {
      const portAllocation = await allocatePortBlock(supabase, businessId);
      const { sshDeployBusiness } = await import("@agency-factory/core/vps/ssh-deploy");

      await sshDeployBusiness(supabase, {
        businessId,
        businessSlug: parsed.data.slug,
        deploymentId: "", // Will be set by deployment service
        subdomain,
        portRangeStart: portAllocation.portRangeStart,
        agents: selectedTemplateIds.map((templateId, i) => ({
          agentId: templateId, // Will be resolved to real agent IDs
          vpsAgentId: `${parsed.data.slug}-${templateId}`,
          departmentType: templateId.split("-")[0] ?? "general",
          model: "claude-sonnet-4-6",
          isCeo: templateId === "ceo",
          templateName: templateId,
          tokenBudget: 100000,
        })),
        workspaceFiles: [],
        openclawConfig: "{}",
      });
    } catch {
      // Non-critical: SSH deploy can be retried from deployments page
    }
  }

  redirect(`/businesses/${businessId}`);
}
