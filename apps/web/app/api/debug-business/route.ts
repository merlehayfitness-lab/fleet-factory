import { NextResponse } from "next/server";
import { createServerClient } from "@/_lib/supabase/server";
import { getSystemHealth, checkBudget } from "@fleet-factory/core/server";

export async function GET() {
  const id = "178fefda-edce-4adf-a246-dd23897191fc";
  const errors: string[] = [];

  try {
    const supabase = await createServerClient();
    errors.push("supabase: OK");

    const { data: { user } } = await supabase.auth.getUser();
    errors.push(`user: ${user ? user.email : "NOT AUTHENTICATED"}`);

    const { data: business, error: bizErr } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", id)
      .single();
    errors.push(`business: ${bizErr ? "ERROR: " + bizErr.message : "OK: " + (business as { name: string })?.name}`);

    if (!business) {
      return NextResponse.json({ errors, final: "Business not found - RLS blocking?" });
    }

    try {
      const health = await getSystemHealth(supabase, id);
      errors.push(`health: OK (${health.agentHealth.departments.length} depts)`);
    } catch (e) {
      errors.push(`health: CRASH: ${(e as Error).message}`);
      errors.push(`health stack: ${(e as Error).stack?.split("\n").slice(0, 3).join(" | ")}`);
    }

    try {
      const budget = await checkBudget(supabase, id);
      errors.push(`budget: OK (${budget.warningLevel})`);
    } catch (e) {
      errors.push(`budget: CRASH: ${(e as Error).message}`);
    }

    const { data: agents, error: agentErr } = await supabase
      .from("agents")
      .select("id, name, departments(name)")
      .eq("business_id", id)
      .eq("status", "active");
    errors.push(`agents: ${agentErr ? "ERROR: " + agentErr.message : "OK: " + (agents || []).length}`);

    const { data: usage, error: usageErr } = await supabase
      .from("api_usage")
      .select("agent_id, prompt_tokens, completion_tokens, cost_cents")
      .eq("business_id", id);
    errors.push(`usage: ${usageErr ? "ERROR: " + usageErr.message : "OK: " + (usage || []).length}`);

    return NextResponse.json({ errors, final: "ALL OK" });
  } catch (e) {
    errors.push(`FATAL: ${(e as Error).message}`);
    errors.push(`stack: ${(e as Error).stack?.split("\n").slice(0, 5).join(" | ")}`);
    return NextResponse.json({ errors, final: "CRASHED" }, { status: 500 });
  }
}
