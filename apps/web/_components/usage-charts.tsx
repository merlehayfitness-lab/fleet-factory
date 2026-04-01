"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { UsageAnalytics } from "@agency-factory/core";

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatCost(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

// ---------------------------------------------------------------------------
// Time filter tabs
// ---------------------------------------------------------------------------

const PERIODS = ["24h", "7d", "30d", "mtd", "ytd"] as const;
const PERIOD_LABELS: Record<string, string> = {
  "24h": "24h",
  "7d": "7d",
  "30d": "30d",
  mtd: "MTD",
  ytd: "YTD",
};

function TimeFilterTabs({ current }: { current: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handlePeriod(period: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", period);
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1">
      {PERIODS.map((p) => (
        <button
          key={p}
          onClick={() => handlePeriod(p)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            current === p
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {PERIOD_LABELS[p]}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border bg-background p-2 shadow-sm">
      <p className="text-xs font-medium">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-xs" style={{ color: entry.color }}>
          {entry.name}: {entry.name === "Cost" ? formatCost(entry.value) : formatTokens(entry.value)}
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface UsageChartsProps {
  analytics: UsageAnalytics;
  period: string;
}

export function UsageCharts({ analytics, period }: UsageChartsProps) {
  const { timeSeries, byModel, byProvider, byAgent, byKeySource, summary } =
    analytics;

  // Transform time series for chart (cost in dollars for display)
  const chartData = timeSeries.map((d) => ({
    ...d,
    costDollars: d.costCents / 100,
  }));

  return (
    <div className="space-y-6">
      {/* Time filter */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Usage Analytics</h2>
        <TimeFilterTabs current={period} />
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard label="Total Calls" value={summary.totalCalls.toLocaleString()} />
        <SummaryCard label="Total Tokens" value={formatTokens(summary.totalTokens)} />
        <SummaryCard label="Total Cost" value={formatCost(summary.totalCostCents)} />
        <SummaryCard label="Avg Latency" value={formatLatency(summary.avgLatencyMs)} />
        <SummaryCard
          label="Failed Calls"
          value={summary.failedCalls.toLocaleString()}
          alert={summary.failedCalls > 0}
        />
      </div>

      {/* Time series chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usage Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                  tickFormatter={(v: number) => formatTokens(v)}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                  tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="tokens"
                  name="Tokens"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.1}
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="costDollars"
                  name="Cost"
                  stroke="#8b5cf6"
                  fill="#8b5cf6"
                  fillOpacity={0.1}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No usage data for this period
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Model breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By Model</CardTitle>
          </CardHeader>
          <CardContent>
            {byModel.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={Math.max(120, byModel.length * 40)}>
                  <BarChart data={byModel} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: number) => formatCost(v)}
                    />
                    <YAxis
                      type="category"
                      dataKey="model"
                      tick={{ fontSize: 10 }}
                      width={120}
                    />
                    <Tooltip
                      formatter={(value) => formatCost(Number(value))}
                      labelFormatter={(label) => String(label)}
                    />
                    <Bar dataKey="costCents" name="Cost" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <Table className="mt-4">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Model</TableHead>
                      <TableHead className="text-xs text-right">Calls</TableHead>
                      <TableHead className="text-xs text-right">Tokens</TableHead>
                      <TableHead className="text-xs text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byModel.map((m) => (
                      <TableRow key={m.model}>
                        <TableCell className="text-xs py-1.5 truncate max-w-[140px]">{m.model}</TableCell>
                        <TableCell className="text-xs text-right py-1.5">{m.calls}</TableCell>
                        <TableCell className="text-xs text-right py-1.5">{formatTokens(m.tokens)}</TableCell>
                        <TableCell className="text-xs text-right py-1.5 font-mono">{formatCost(m.costCents)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No model data</p>
            )}
          </CardContent>
        </Card>

        {/* Provider breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By Provider</CardTitle>
          </CardHeader>
          <CardContent>
            {byProvider.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Provider</TableHead>
                    <TableHead className="text-xs text-right">Calls</TableHead>
                    <TableHead className="text-xs text-right">Tokens</TableHead>
                    <TableHead className="text-xs text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byProvider.map((p) => (
                    <TableRow key={p.provider}>
                      <TableCell className="text-xs py-1.5 capitalize">{p.provider}</TableCell>
                      <TableCell className="text-xs text-right py-1.5">{p.calls}</TableCell>
                      <TableCell className="text-xs text-right py-1.5">{formatTokens(p.tokens)}</TableCell>
                      <TableCell className="text-xs text-right py-1.5 font-mono">{formatCost(p.costCents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No provider data</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Agent breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By Agent</CardTitle>
          </CardHeader>
          <CardContent>
            {byAgent.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Agent</TableHead>
                    <TableHead className="text-xs text-right">Calls</TableHead>
                    <TableHead className="text-xs text-right">Tokens</TableHead>
                    <TableHead className="text-xs text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byAgent.map((a) => (
                    <TableRow key={a.agentId}>
                      <TableCell className="text-xs py-1.5">{a.agentName}</TableCell>
                      <TableCell className="text-xs text-right py-1.5">{a.calls}</TableCell>
                      <TableCell className="text-xs text-right py-1.5">{formatTokens(a.tokens)}</TableCell>
                      <TableCell className="text-xs text-right py-1.5 font-mono">{formatCost(a.costCents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No agent data</p>
            )}
          </CardContent>
        </Card>

        {/* Key source breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By API Key Source</CardTitle>
          </CardHeader>
          <CardContent>
            {byKeySource.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Source</TableHead>
                    <TableHead className="text-xs text-right">Calls</TableHead>
                    <TableHead className="text-xs text-right">Tokens</TableHead>
                    <TableHead className="text-xs text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byKeySource.map((k) => (
                    <TableRow key={k.source}>
                      <TableCell className="text-xs py-1.5 capitalize">
                        {k.source === "platform" ? "Platform Key" : "Business Key"}
                      </TableCell>
                      <TableCell className="text-xs text-right py-1.5">{k.calls}</TableCell>
                      <TableCell className="text-xs text-right py-1.5">{formatTokens(k.tokens)}</TableCell>
                      <TableCell className="text-xs text-right py-1.5 font-mono">{formatCost(k.costCents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No key source data</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  alert,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold ${alert ? "text-red-500" : ""}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
