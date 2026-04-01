import { createServerClient } from "@/_lib/supabase/server";
import { getUsageAnalytics } from "@agency-factory/core/server";
import { UsageCharts } from "@/_components/usage-charts";

const VALID_PERIODS = new Set(["24h", "7d", "30d", "mtd", "ytd"]);

export default async function UsagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const rawPeriod = typeof sp.period === "string" ? sp.period : "30d";
  const period = VALID_PERIODS.has(rawPeriod)
    ? (rawPeriod as "24h" | "7d" | "30d" | "mtd" | "ytd")
    : "30d";

  const supabase = await createServerClient();

  // Fetch business name for header
  const { data: biz } = await supabase
    .from("businesses")
    .select("name")
    .eq("id", id)
    .single();

  const analytics = await getUsageAnalytics(supabase, id, period);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">API Usage Analytics</h1>
        <p className="text-sm text-muted-foreground">
          {biz?.name ?? "Business"} — detailed API usage and cost breakdown
        </p>
      </div>

      <UsageCharts analytics={analytics} period={period} />
    </div>
  );
}
