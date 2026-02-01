"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SummaryCard } from "@/components/ui/summary-card";
import { PortfolioEvolutionChart } from "@/components/charts/portfolio-evolution-chart";
import { HoldingsChart } from "@/components/charts/holdings-chart";
import { TrendingUp, TrendingDown, Wallet, PiggyBank } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrivateMode } from "@/components/providers/private-mode-provider";

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

function formatCurrency(value: number, mask = false): string {
  if (mask) return "••••";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function InvestmentsContent({ summary, history, holdings }: InvestmentsContentProps) {
  const { isPrivate } = usePrivateMode();

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
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Investments</h1>
        <p className="text-muted-foreground">Track your investment portfolio from Indexa Capital</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <SummaryCard
          title="Portfolio Value"
          value={formatCurrency(summary.totalValue, isPrivate)}
          description="Current market value"
          icon={Wallet}
        />

        <SummaryCard
          title="Amount Invested"
          value={formatCurrency(summary.totalInvested, isPrivate)}
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

      {/* Charts */}
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

      {/* Holdings Table */}
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
                      {formatCurrency(holding.totalValue, isPrivate)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{holding.weight.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Account Details */}
      <Card>
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
          <CardDescription>Individual Indexa Capital accounts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {summary.accounts.map((account) => (
              <div key={account.accountNumber} className="p-4 border rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium capitalize">{account.accountType} Account</span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {account.accountNumber}
                  </span>
                </div>
                <div className="text-2xl font-bold">
                  {formatCurrency(account.currentValue, isPrivate)}
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Returns</span>
                  <span className={cn(account.returns >= 0 ? "text-green-500" : "text-red-500")}>
                    {isPrivate ? "••••" : formatCurrency(account.returns)} (
                    {formatPercent(account.returnsPercent)})
                  </span>
                </div>
                {account.lastSyncAt && (
                  <div className="text-xs text-muted-foreground">
                    Last synced: {new Date(account.lastSyncAt).toLocaleString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
