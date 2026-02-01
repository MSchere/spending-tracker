"use client";

import {
  BudgetProgressChart,
  CashFlowChart,
  CategorySpendingChart,
  type BudgetProgressData,
  type CashFlowData,
  type CategorySpendingData,
} from "@/components/charts";
import { usePreferences } from "@/components/providers/preferences-provider";
import { usePrivateMode } from "@/components/providers/private-mode-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DetailCard } from "@/components/ui/detail-card";
import { SummaryCard } from "@/components/ui/summary-card";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarClock,
  Coins,
  Landmark,
  LineChart,
  Package,
  PiggyBank,
  Target,
  TrendingUp,
} from "lucide-react";

interface DashboardStats {
  income: number;
  expenses: number;
  netFlow: number;
  totalBalance: number;
  budgetsCount: number;
  totalMonthlyBudget: number;
  // This month's actual recurring (based on nextDueDate)
  thisMonthRecurringExpenses: number;
  thisMonthRecurringIncome: number;
  // Monthly averages (for reference)
  avgMonthlyRecurringExpenses: number;
  avgMonthlyRecurringIncome: number;
  savingsGoals: {
    count: number;
    target: number;
    current: number;
  };
  recentTransactions: Array<{
    id: string;
    type: string;
    description: string | null;
    date: string;
    amountEur: number;
    category: {
      name: string;
      color: string | null;
    } | null;
  }>;
  upcomingRecurring: Array<{
    id: string;
    name: string;
    type: string;
    amount: number;
    currency: string;
    frequency: string;
    nextDueDate: string;
    category: {
      name: string;
      color: string | null;
    } | null;
  }>;
}

interface DashboardContentProps {
  stats: DashboardStats;
  cashFlowData: CashFlowData[];
  categoryData: CategorySpendingData[];
  budgetProgressData: BudgetProgressData[];
  monthName: string;
  userName: string;
  investmentSummary: {
    totalValue: number;
    totalReturns: number;
    totalReturnsPercent: number;
  } | null;
  financialAssetsSummary: {
    totalValue: number;
    totalCost: number;
    totalGainLoss: number;
    totalGainLossPercent: number;
    assetCount: number;
  } | null;
  tangibleAssetsSummary: {
    totalCurrentValue: number;
    totalPurchasePrice: number;
    totalDepreciation: number;
    depreciationPercent: number;
    assetCount: number;
  } | null;
  netWorth: {
    cash: number;
    indexa: number;
    financialAssets: number;
    tangibleAssets: number;
    total: number;
  };
}

function PrivateValue({ children, className }: { children: React.ReactNode; className?: string }) {
  const { isPrivate } = usePrivateMode();

  if (isPrivate) {
    return <span className={className}>••••••</span>;
  }

  return <span className={className}>{children}</span>;
}

export function DashboardContent({
  stats,
  cashFlowData,
  categoryData,
  budgetProgressData,
  monthName,
  userName,
  investmentSummary,
  financialAssetsSummary,
  tangibleAssetsSummary,
  netWorth,
}: DashboardContentProps) {
  const { isPrivate } = usePrivateMode();
  const { formatCurrency, formatDate } = usePreferences();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {userName}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Net Worth"
          value={<PrivateValue>{formatCurrency(netWorth.total)}</PrivateValue>}
          description="All assets combined"
          icon={Landmark}
        />

        <SummaryCard
          title={`${monthName} Income`}
          value={<PrivateValue>+{formatCurrency(stats.income)}</PrivateValue>}
          description="Total incoming"
          icon={ArrowDownIcon}
          iconColor="text-green-500"
          valueColor="text-green-600"
        />

        <SummaryCard
          title={`${monthName} Expenses`}
          value={<PrivateValue>-{formatCurrency(stats.expenses)}</PrivateValue>}
          description="Total outgoing"
          icon={ArrowUpIcon}
          iconColor="text-red-500"
          valueColor="text-red-600"
        />

        <SummaryCard
          title="Net Cash Flow"
          value={
            <PrivateValue>
              {stats.netFlow >= 0 ? "+" : ""}
              {formatCurrency(stats.netFlow)}
            </PrivateValue>
          }
          description="This month"
          icon={TrendingUp}
          valueColor={stats.netFlow >= 0 ? "text-green-600" : "text-red-600"}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2">
            <CardTitle className="flex items-center gap-2">{monthName} Outlook</CardTitle>
            <CardDescription>
              Expected cash flow this month based on recurring items and budgets
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="flex flex-col gap-1 p-3 rounded-lg bg-green-50 dark:bg-green-950/30">
              <span className="text-xs text-muted-foreground">Expected Income</span>
              <span className="text-lg font-semibold text-green-600">
                <PrivateValue>+{formatCurrency(stats.thisMonthRecurringIncome)}</PrivateValue>
              </span>
              <span className="text-xs text-muted-foreground">
                Avg: {formatCurrency(stats.avgMonthlyRecurringIncome)}/mo
              </span>
            </div>

            {(() => {
              const income = stats.thisMonthRecurringIncome;
              const fixedExpenses = stats.thisMonthRecurringExpenses;
              const fixedPercent = income > 0 ? (fixedExpenses / income) * 100 : 0;
              const targetPercent = 50;
              const deviation = fixedPercent - targetPercent;
              const isOverBudget = deviation > 0;

              return (
                <div className="flex flex-col gap-1 p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Fixed Expenses</span>
                    <span
                      className={`text-xs font-medium ${isOverBudget ? "text-red-600" : "text-green-600"}`}
                    >
                      {fixedPercent.toFixed(0)}% / {targetPercent}%
                    </span>
                  </div>
                  <span className="text-lg font-semibold text-orange-600">
                    <PrivateValue>-{formatCurrency(fixedExpenses)}</PrivateValue>
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Avg: {formatCurrency(stats.avgMonthlyRecurringExpenses)}/mo
                    </span>
                    {income > 0 && (
                      <span
                        className={`text-xs font-medium ${isOverBudget ? "text-red-600" : "text-green-600"}`}
                      >
                        {isOverBudget ? "+" : ""}
                        {deviation.toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

            {(() => {
              const income = stats.thisMonthRecurringIncome;
              const variableBudget = stats.totalMonthlyBudget;
              const variablePercent = income > 0 ? (variableBudget / income) * 100 : 0;
              const targetPercent = 30;
              const deviation = variablePercent - targetPercent;
              const isOverBudget = deviation > 0;

              return (
                <div className="flex flex-col gap-1 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Variable Budget</span>
                    <span
                      className={`text-xs font-medium ${isOverBudget ? "text-red-600" : "text-green-600"}`}
                    >
                      {variablePercent.toFixed(0)}% / {targetPercent}%
                    </span>
                  </div>
                  <span className="text-lg font-semibold text-blue-600">
                    <PrivateValue>-{formatCurrency(variableBudget)}</PrivateValue>
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Planned spending</span>
                    {income > 0 && (
                      <span
                        className={`text-xs font-medium ${isOverBudget ? "text-red-600" : "text-green-600"}`}
                      >
                        {isOverBudget ? "+" : ""}
                        {deviation.toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}
            {(() => {
              const income = stats.thisMonthRecurringIncome;
              const fixedExpenses = stats.thisMonthRecurringExpenses;
              const variableBudget = stats.totalMonthlyBudget;
              const savings = income - fixedExpenses - variableBudget;
              const savingsPercent = income > 0 ? (savings / income) * 100 : 0;
              const targetPercent = 20;
              const deviation = savingsPercent - targetPercent;
              const isOnTrack = deviation >= 0;

              return (
                <div className="flex flex-col gap-1 p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Savings & Investments</span>
                    {income > 0 && (
                      <span
                        className={`text-xs font-medium ${isOnTrack ? "text-green-600" : "text-red-600"}`}
                      >
                        {savingsPercent.toFixed(0)}% / {targetPercent}%
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-lg font-semibold ${savings >= 0 ? "text-purple-600" : "text-red-600"}`}
                  >
                    <PrivateValue>
                      {savings >= 0 ? "+" : ""}
                      {formatCurrency(savings)}
                    </PrivateValue>
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Available to save</span>
                    {income > 0 && (
                      <span
                        className={`text-xs font-medium ${isOnTrack ? "text-green-600" : "text-red-600"}`}
                      >
                        {isOnTrack ? "+" : ""}
                        {deviation.toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cash Flow</CardTitle>
            <CardDescription>Income vs Expenses - Last 6 Months</CardDescription>
          </CardHeader>
          <CardContent>
            {isPrivate ? (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                Chart hidden in private mode
              </div>
            ) : (
              <CashFlowChart data={cashFlowData} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>Net Worth Breakdown</CardTitle>
            </div>
            <CardDescription>Assets by category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  Cash
                </span>
                <span className="font-medium">
                  <PrivateValue>{formatCurrency(netWorth.cash)}</PrivateValue>
                </span>
              </div>
              {netWorth.indexa > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    Investment Funds
                  </span>
                  <span className="font-medium">
                    <PrivateValue>{formatCurrency(netWorth.indexa)}</PrivateValue>
                  </span>
                </div>
              )}
              {netWorth.financialAssets > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    Stocks & Crypto
                  </span>
                  <span className="font-medium">
                    <PrivateValue>{formatCurrency(netWorth.financialAssets)}</PrivateValue>
                  </span>
                </div>
              )}
              {netWorth.tangibleAssets > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-500" />
                    Tangible Assets
                  </span>
                  <span className="font-medium">
                    <PrivateValue>{formatCurrency(netWorth.tangibleAssets)}</PrivateValue>
                  </span>
                </div>
              )}
              <div className="border-t pt-2 flex justify-between text-sm font-medium">
                <span>Total</span>
                <span>
                  <PrivateValue>{formatCurrency(netWorth.total)}</PrivateValue>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
            <CardDescription>{monthName} breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {isPrivate ? (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                Chart hidden in private mode
              </div>
            ) : (
              <CategorySpendingChart data={categoryData} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Budget Progress</CardTitle>
            <CardDescription>{monthName} spending vs budgets</CardDescription>
          </CardHeader>
          <CardContent>
            {isPrivate ? (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                Chart hidden in private mode
              </div>
            ) : (
              <BudgetProgressChart data={budgetProgressData} />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {investmentSummary && (
          <DetailCard
            title="Investment Funds"
            description="Long-term investments"
            icon={LineChart}
            href="/investments"
          >
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Portfolio Value</span>
                <span className="font-medium">
                  <PrivateValue>{formatCurrency(investmentSummary.totalValue)}</PrivateValue>
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Returns</span>
                <span
                  className={`font-medium ${
                    investmentSummary.totalReturns >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  <PrivateValue>
                    {investmentSummary.totalReturns >= 0 ? "+" : ""}
                    {formatCurrency(investmentSummary.totalReturns)} (
                    {investmentSummary.totalReturnsPercent >= 0 ? "+" : ""}
                    {investmentSummary.totalReturnsPercent.toFixed(2)}%)
                  </PrivateValue>
                </span>
              </div>
            </div>
          </DetailCard>
        )}

        {financialAssetsSummary && (
          <DetailCard
            title="Stocks & Crypto"
            description={`${financialAssetsSummary.assetCount} asset${financialAssetsSummary.assetCount !== 1 ? "s" : ""}`}
            icon={Coins}
            href="/financial-assets"
          >
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Total Value</span>
                <span className="font-medium">
                  <PrivateValue>{formatCurrency(financialAssetsSummary.totalValue)}</PrivateValue>
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Gain/Loss</span>
                <span
                  className={`font-medium ${
                    financialAssetsSummary.totalGainLoss >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  <PrivateValue>
                    {financialAssetsSummary.totalGainLoss >= 0 ? "+" : ""}
                    {formatCurrency(financialAssetsSummary.totalGainLoss)} (
                    {financialAssetsSummary.totalGainLossPercent >= 0 ? "+" : ""}
                    {financialAssetsSummary.totalGainLossPercent.toFixed(2)}%)
                  </PrivateValue>
                </span>
              </div>
            </div>
          </DetailCard>
        )}

        {tangibleAssetsSummary && (
          <DetailCard
            title="Tangible Assets"
            description={`${tangibleAssetsSummary.assetCount} asset${tangibleAssetsSummary.assetCount !== 1 ? "s" : ""}`}
            icon={Package}
            href="/assets"
          >
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Current Value</span>
                <span className="font-medium">
                  <PrivateValue>
                    {formatCurrency(tangibleAssetsSummary.totalCurrentValue)}
                  </PrivateValue>
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Depreciation</span>
                <span className="font-medium text-orange-600">
                  <PrivateValue>
                    -{formatCurrency(tangibleAssetsSummary.totalDepreciation)} (-
                    {tangibleAssetsSummary.depreciationPercent.toFixed(1)}%)
                  </PrivateValue>
                </span>
              </div>
            </div>
          </DetailCard>
        )}

        <DetailCard
          title="Active Budgets"
          description={`You have ${stats.budgetsCount} active budget${stats.budgetsCount !== 1 ? "s" : ""}`}
          icon={PiggyBank}
          href="/budgets"
        >
          {stats.budgetsCount === 0 ? (
            <p className="text-sm text-muted-foreground">
              No budgets set up yet. Create one to start tracking your spending limits.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Track your spending against your budgets in the Budgets section.
            </p>
          )}
        </DetailCard>

        <DetailCard
          title="Savings Goals"
          description={`${stats.savingsGoals.count} active goal${stats.savingsGoals.count !== 1 ? "s" : ""}`}
          icon={Target}
          href="/savings"
        >
          {stats.savingsGoals.count === 0 ? (
            <p className="text-sm text-muted-foreground">
              No savings goals yet. Set one up to track your progress.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Total Progress</span>
                <span>
                  <PrivateValue>
                    {formatCurrency(stats.savingsGoals.current)} /{" "}
                    {formatCurrency(stats.savingsGoals.target)}
                  </PrivateValue>
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: isPrivate
                      ? "0%"
                      : `${Math.min(
                          100,
                          (stats.savingsGoals.current / stats.savingsGoals.target) * 100
                        )}%`,
                  }}
                />
              </div>
            </div>
          )}
        </DetailCard>

        <DetailCard
          title="Upcoming Expenses"
          description="Next recurring payments due"
          icon={CalendarClock}
        >
          {stats.upcomingRecurring.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No recurring expenses set up yet. Add some to track upcoming payments.
            </p>
          ) : (
            <div className="max-h-20 overflow-y-auto space-y-3">
              {stats.upcomingRecurring.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between text-sm">
                  <div className="min-w-0 flex gap-2 items-end">
                    <p className="font-medium truncate">{expense.name}</p>
                    <p className="text-xs text-muted-foreground mb-0.5">
                      {formatDate(expense.nextDueDate)}
                    </p>
                  </div>
                  <span className="font-medium text-right">
                    <PrivateValue>{formatCurrency(expense.amount, expense.currency)}</PrivateValue>
                  </span>
                </div>
              ))}
            </div>
          )}
        </DetailCard>
      </div>
    </div>
  );
}
