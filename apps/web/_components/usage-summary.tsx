"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Coins } from "lucide-react";

interface AgentUsage {
  agentId: string;
  agentName: string;
  promptTokens: number;
  completionTokens: number;
  costCents: number;
}

export interface UsageSummaryData {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalCostCents: number;
  byAgent: AgentUsage[];
}

interface UsageSummaryProps {
  usageSummary: UsageSummaryData;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function formatCost(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Dashboard card displaying usage stats:
 * total tokens (prompt + completion), total cost, and per-agent breakdown.
 */
export function UsageSummary({ usageSummary }: UsageSummaryProps) {
  const totalTokens =
    usageSummary.totalPromptTokens + usageSummary.totalCompletionTokens;

  if (totalTokens === 0) {
    return (
      <Card>
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5">
            <Coins className="size-3.5" />
            Usage
          </CardDescription>
          <CardTitle className="text-sm font-normal text-muted-foreground">
            No usage recorded yet
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-1.5">
          <Coins className="size-3.5" />
          Usage
        </CardDescription>
        <CardTitle className="flex items-baseline gap-2">
          <span>{formatNumber(totalTokens)} tokens</span>
          <span className="text-sm font-normal text-muted-foreground">
            {formatCost(usageSummary.totalCostCents)}
          </span>
        </CardTitle>
      </CardHeader>
      {usageSummary.byAgent.length > 0 && (
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Agent</TableHead>
                <TableHead className="text-xs text-right">Tokens</TableHead>
                <TableHead className="text-xs text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usageSummary.byAgent.map((agent) => (
                <TableRow key={agent.agentId}>
                  <TableCell className="text-xs py-1.5">
                    {agent.agentName}
                  </TableCell>
                  <TableCell className="text-xs text-right py-1.5">
                    {formatNumber(agent.promptTokens + agent.completionTokens)}
                  </TableCell>
                  <TableCell className="text-xs text-right py-1.5">
                    {formatCost(agent.costCents)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      )}
    </Card>
  );
}
