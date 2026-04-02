"use server";

import { createServerClient } from "@/_lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  searchComponents,
  getComponentDetail,
  importFromAitmpl,
  getCatalogStats,
} from "@fleet-factory/core/server";
import type {
  CatalogSearchResult,
  AitmplComponentType,
  AitmplImportResult,
} from "@fleet-factory/core";

/**
 * Search the AITMPL catalog server-side and return lightweight results.
 * Never exposes full catalog content to the client.
 */
export async function searchAitmplAction(
  query: string,
  options?: {
    type?: AitmplComponentType;
    department?: string;
    limit?: number;
    sort?: "downloads" | "name" | "newest";
  },
): Promise<{ results: CatalogSearchResult[] } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  try {
    const results = await searchComponents(query, options);
    return { results };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to search AITMPL catalog",
    };
  }
}

/**
 * Get full AITMPL component detail for preview.
 * Strips security/author/repo fields before returning to client.
 */
export async function getAitmplDetailAction(
  path: string,
  type: AitmplComponentType,
): Promise<
  | {
      component: {
        name: string;
        path: string;
        category: string;
        type: string;
        content: string;
        description: string;
        downloads: number;
      };
    }
  | { error: string }
> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  try {
    const component = await getComponentDetail(path, type);

    if (!component) {
      return { error: "Component not found" };
    }

    // Strip unnecessary fields before returning to client
    return {
      component: {
        name: component.name,
        path: component.path,
        category: component.category,
        type: component.type,
        content: component.content,
        description: component.description,
        downloads: component.downloads,
      },
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to fetch component detail",
    };
  }
}

/**
 * Import an AITMPL component into Fleet Factory.
 * Routes by type: skill/command/setting/hook -> skill, agent -> system_prompt, mcp -> tool_profile merge.
 */
export async function importAitmplAction(options: {
  businessId: string;
  componentPath: string;
  componentType: AitmplComponentType;
  targetAgentId?: string;
  targetDepartmentId?: string;
}): Promise<AitmplImportResult> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const result = await importFromAitmpl(supabase, options);

    if (result.success) {
      revalidatePath(`/businesses/${options.businessId}`);
    }

    return result;
  } catch (err) {
    return {
      success: false,
      entityType: "skill",
      name: options.componentPath,
      error: err instanceof Error ? err.message : "Failed to import component",
    };
  }
}

/**
 * Get catalog stats (count per component type).
 */
export async function getAitmplStatsAction(): Promise<
  { stats: Record<string, number> } | { error: string }
> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  try {
    const stats = await getCatalogStats();
    return { stats };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to fetch catalog stats",
    };
  }
}
