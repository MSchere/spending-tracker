"use client";

import { usePrivateMode } from "@/components/providers/private-mode-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowDownIcon, 
  ArrowUpIcon, 
  TrendingUp, 
  Wallet,
  Target,
  PiggyBank 
} from "lucide-react";
import {
  CashFlowChart,
  CategorySpendingChart,
  BudgetProgressChart,
  type CashFlowData,
  type CategorySpendingData,
  type BudgetProgressData,
} from "@/components/charts";

interface DashboardStats {
  income: number;
  expenses: number;
  netFlow: number;
  totalBalance: number;
  budgetsCount: number;
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
}

interface DashboardContentProps {
  stats: DashboardStats;
  cashFlowData: CashFlowData[];
  categoryData: CategorySpendingData[];
  budgetProgressData: BudgetProgressData[];
  monthName: string;
  userName: string;
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
}

function PrivateValue({ 
  children, 
  className 
}: { 
  children: React.ReactNode; 
  className?: string;
}) {
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
}: DashboardContentProps) {
  const { isPrivate } = usePrivateMode();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {userName}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <PrivateValue>{formatCurrency(stats.totalBalance)}</PrivateValue>
            </div>
            <p className="text-xs text-muted-foreground">
              Across all Wise accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {monthName} Income
            </CardTitle>
            <ArrowDownIcon className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              <PrivateValue>+{formatCurrency(stats.income)}</PrivateValue>
            </div>
            <p className="text-xs text-muted-foreground">Total incoming</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {monthName} Expenses
            </CardTitle>
            <ArrowUpIcon className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              <PrivateValue>-{formatCurrency(stats.expenses)}</PrivateValue>
            </div>
            <p className="text-xs text-muted-foreground">Total outgoing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Cash Flow</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                stats.netFlow >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              <PrivateValue>
                {stats.netFlow >= 0 ? "+" : ""}
                {formatCurrency(stats.netFlow)}
              </PrivateValue>
            </div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
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
      </div>

      {/* Budget Progress Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Budget Progress</CardTitle>
          <CardDescription>
            {monthName} spending vs budgets
          </CardDescription>
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

      {/* Secondary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <PiggyBank className="h-5 w-5" />
              <CardTitle>Active Budgets</CardTitle>
            </div>
            <CardDescription>
              You have {stats.budgetsCount} active budget
              {stats.budgetsCount !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.budgetsCount === 0 ? (
              <p className="text-sm text-muted-foreground">
                No budgets set up yet. Create one to start tracking your
                spending limits.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Track your spending against your budgets in the Budgets section.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              <CardTitle>Savings Goals</CardTitle>
            </div>
            <CardDescription>
              {stats.savingsGoals.count} active goal
              {stats.savingsGoals.count !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                      {formatCurrency(stats.savingsGoals.current)} / {formatCurrency(stats.savingsGoals.target)}
                    </PrivateValue>
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: isPrivate ? "0%" : `${Math.min(
                        100,
                        (stats.savingsGoals.current / stats.savingsGoals.target) *
                          100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>
            Your latest transactions from this month
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats.recentTransactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No transactions yet. Sync with Wise to import your transactions.
            </p>
          ) : (
            <div className="space-y-3">
              {stats.recentTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3"
                >
                  <div
                    className={`w-2 h-2 rounded-full ${
                      transaction.type === "INCOME"
                        ? "bg-green-500"
                        : "bg-red-500"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {transaction.description || "Unknown"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(transaction.date).toLocaleDateString("de-DE")}
                    </p>
                  </div>
                  <div className="w-32 text-right">
                    {transaction.category && (
                      <Badge 
                        variant="outline"
                        className="truncate max-w-full"
                        style={{
                          borderColor: transaction.category.color || undefined,
                          color: transaction.category.color || undefined,
                        }}
                      >
                        {transaction.category.name}
                      </Badge>
                    )}
                  </div>
                  <span
                    className={`font-medium w-28 text-right ${
                      transaction.type === "INCOME"
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    <PrivateValue>
                      {transaction.type === "INCOME" ? "+" : "-"}
                      {formatCurrency(Math.abs(transaction.amountEur))}
                    </PrivateValue>
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
