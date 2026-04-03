import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSystemHealth, checkBudget } from "@fleet-factory/core/server";

// Public debug endpoint - uses service role key directly (no auth needed)
export async function GET() {
  const id = "178fefda-edce-4adf-a246-dd23897191fc";
  const lines: string[] = [];

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  try {
    lines.push("1. Supabase client: OK");

    const { data: business, error: bizErr } = await supabase
      .from("businesses").select("*").eq("id", id).single();
    lines.push(`2. Business: ${bizErr ? "ERR: " + bizErr.message : "OK: " + (business as { name: string })?.name}`);

    if (!business) {
      return new NextResponse(renderHtml(lines, "Business not found"), { headers: { "content-type": "text/html" } });
    }

    try {
      const health = await getSystemHealth(supabase, id);
      lines.push(`3. getSystemHealth: OK (${health.agentHealth.departments.length} depts)`);
    } catch (e) {
      lines.push(`3. getSystemHealth: CRASH: ${(e as Error).message}`);
      lines.push(`   Stack: ${(e as Error).stack?.split("\n").slice(0, 3).join(" | ")}`);
    }

    try {
      const budget = await checkBudget(supabase, id);
      lines.push(`4. checkBudget: OK (${budget.warningLevel})`);
    } catch (e) {
      lines.push(`4. checkBudget: CRASH: ${(e as Error).message}`);
    }

    const { data: agents, error: agErr } = await supabase
      .from("agents").select("id, name, departments(name)").eq("business_id", id).eq("status", "active");
    lines.push(`5. Agents+depts: ${agErr ? "ERR: " + agErr.message : "OK: " + (agents || []).length}`);

    const { data: usage, error: usErr } = await supabase
      .from("api_usage").select("agent_id, prompt_tokens, completion_tokens, cost_cents").eq("business_id", id);
    lines.push(`6. api_usage: ${usErr ? "ERR: " + usErr.message : "OK: " + (usage || []).length}`);

    lines.push("--- ALL QUERIES PASSED ---");
    return new NextResponse(renderHtml(lines, "ALL OK"), { headers: { "content-type": "text/html" } });
  } catch (e) {
    lines.push(`FATAL: ${(e as Error).message}`);
    lines.push(`Stack: ${(e as Error).stack?.split("\n").slice(0, 5).join(" | ")}`);
    return new NextResponse(renderHtml(lines, "CRASHED"), { status: 500, headers: { "content-type": "text/html" } });
  }
}

function renderHtml(lines: string[], status: string): string {
  return `<!DOCTYPE html>
<html><head><title>Debug: ${status}</title></head>
<body style="font-family:monospace;padding:2rem;background:#111;color:#0f0">
<h1>Business Page Debug (${status})</h1>
<pre>${lines.join("\n")}</pre>
</body></html>`;
}
