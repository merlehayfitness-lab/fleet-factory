import { notFound } from "next/navigation";
import { createServerClient } from "@/_lib/supabase/server";

/**
 * Business overview — test #2: HealthDashboard with NO core/server import.
 */
export default async function BusinessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, name, slug, industry, status, created_at, plan_tier")
    .eq("id", id)
    .single();

  if (businessError || !business) {
    notFound();
  }

  // Test: dynamically import to see if it crashes
  let healthError = "";
  try {
    const { getSystemHealth } = await import("@fleet-factory/core/server");
    healthError = "import OK";
    const health = await getSystemHealth(supabase, id);
    healthError = `health OK: ${health.agentHealth.departments.length} depts`;
  } catch (e) {
    healthError = `CRASH: ${(e as Error).message}\n${(e as Error).stack?.split("\n").slice(0, 5).join("\n")}`;
  }

  return (
    <div style={{ padding: "2rem", fontFamily: "monospace" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
        {business.name} ({business.status})
      </h1>
      <h2>Import + Health Test:</h2>
      <pre style={{ background: "#f5f5f5", padding: "1rem", borderRadius: "8px", whiteSpace: "pre-wrap" }}>
        {healthError}
      </pre>
    </div>
  );
}
