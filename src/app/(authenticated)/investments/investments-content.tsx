"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SummaryCard } from "@/components/ui/summary-card";
import { PortfolioEvolutionChart } from "@/components/charts/portfolio-evolution-chart";
import { HoldingsChart } from "@/components/charts/holdings-chart";
import { TrendingUp, TrendingDown, Wallet, PiggyBank } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrivateMode } from "@/components/providers/private-mode-provider";
import { usePreferences } from "@/components/providers/preferences-provider";

interface PortfolioSummary {
  totalValue: number;
  totalInvested: number;
  totalReturns: number;
  totalReturnsPercent: number;
  accounts: Array<{
    accountNumber: string;
    accountType: string;
    status: string;
    currentValue: number;
    returns: number;
    returnsPercent: number;
    lastSyncAt: string | null;
  }>;
}

interface PortfolioHistoryPoint {
  date: string;
  totalValue: number;
  totalInvested: number;
  returns: number;
  returnsPercent: number;
}

interface Holding {
  instrumentName: string;
  instrumentType: string;
  isin: string | null;
  totalShares: number;
  totalValue: number;
  weight: number;
}

interface InvestmentsContentProps {
  summary: PortfolioSummary | null;
  history: PortfolioHistoryPoint[];
  holdings: Holding[];
}

function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function InvestmentsContent({ summary, history, holdings }: InvestmentsContentProps) {
  const { isPrivate } = usePrivateMode();
  const { formatCurrency } = usePreferences();

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
        <h2 className="text-xl font-semibold mb-2">No Investment Data</h2>
        <p className="text-muted-foreground max-w-md">
          No investment accounts found. Try syncing your data first.
        </p>
      </div>
    );
  }

  const isPositiveReturn = summary.totalReturns >= 0;

  // Convert history dates for chart
  const chartHistory = history.map((point) => ({
    ...point,
    date: new Date(point.date),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Investments</h1>
        <p className="text-muted-foreground">Track your investment portfolio from Indexa Capital</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <SummaryCard
          title="Portfolio Value"
          value={isPrivate ? "••••" : formatCurrency(summary.totalValue)}
          description="Current market value"
          icon={Wallet}
        />

        <SummaryCard
          title="Amount Invested"
          value={isPrivate ? "••••" : formatCurrency(summary.totalInvested)}
          description="Total contributions"
          icon={PiggyBank}
        />

        <SummaryCard
          title="Total Returns"
          value={
            <>
              {isPrivate ? "••••" : formatCurrency(summary.totalReturns)}
              <span
                className={cn(
                  "text-xs font-normal ml-2",
                  isPositiveReturn ? "text-green-600" : "text-red-600"
                )}
              >
                {formatPercent(summary.totalReturnsPercent)}
              </span>
            </>
          }
          description="Overall performance"
          icon={isPositiveReturn ? TrendingUp : TrendingDown}
          iconColor={isPositiveReturn ? "text-green-500" : "text-red-500"}
          valueColor={isPositiveReturn ? "text-green-600" : "text-red-600"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Portfolio Evolution</CardTitle>
            <CardDescription>Value vs invested amount over the past year</CardDescription>
          </CardHeader>
          <CardContent>
            <PortfolioEvolutionChart data={chartHistory} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Holdings Breakdown</CardTitle>
            <CardDescription>Current asset allocation by instrument</CardDescription>
          </CardHeader>
          <CardContent>
            <HoldingsChart data={holdings} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Holdings Details</CardTitle>
          <CardDescription>Individual positions in your portfolio</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-muted/50">
                <tr>
                  <th className="px-4 py-3">Instrument</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Shares</th>
                  <th className="px-4 py-3 text-right">Value</th>
                  <th className="px-4 py-3 text-right">Weight</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((holding, index) => (
                  <tr key={index} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3 font-medium">{holding.instrumentName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{holding.instrumentType}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {isPrivate ? "••••" : holding.totalShares.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {isPrivate ? "••••" : formatCurrency(holding.totalValue)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{holding.weight.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
