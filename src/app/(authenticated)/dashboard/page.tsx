import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
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

// Color palette for category chart
const CATEGORY_COLORS = [
  "hsl(221, 83%, 53%)", // blue
  "hsl(262, 83%, 58%)", // purple
  "hsl(142, 76%, 36%)", // green
  "hsl(38, 92%, 50%)",  // orange
  "hsl(0, 84%, 60%)",   // red
  "hsl(199, 89%, 48%)", // cyan
  "hsl(340, 82%, 52%)", // pink
  "hsl(45, 93%, 47%)",  // yellow
  "hsl(172, 66%, 50%)", // teal
  "hsl(292, 84%, 61%)", // magenta
];

async function getDashboardData(userId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Get user's Wise profiles
  const userProfiles = await db.wiseProfile.findMany({
    where: { userId },
    select: { id: true },
  });
  const profileIds = userProfiles.map((p) => p.id);

  // Get transactions for this month from user's profiles
  const transactions = await db.transaction.findMany({
    where: {
      profileId: { in: profileIds },
      date: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
    include: {
      category: true,
    },
    orderBy: {
      date: "desc",
    },
  });

  // Calculate income and expenses
  const income = transactions
    .filter((t) => t.type === "INCOME")
    .reduce((sum, t) => sum + t.amountEur.toNumber(), 0);

  const expenses = transactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((sum, t) => sum + Math.abs(t.amountEur.toNumber()), 0);

  // Get Wise balances for user's profiles
  const wiseBalances = await db.wiseBalance.findMany({
    where: {
      profileId: { in: profileIds },
    },
  });

  const totalBalance = wiseBalances.reduce(
    (sum, b) => sum + b.amount.toNumber(),
    0
  );

  // Get active budgets
  const budgets = await db.budget.findMany({
    where: {
      userId,
      isActive: true,
    },
    include: {
      category: true,
    },
  });

  // Get savings goals
  const savingsGoals = await db.savingsGoal.findMany({
    where: {
      userId,
      isCompleted: false,
    },
  });

  const totalSavingsTarget = savingsGoals.reduce(
    (sum, g) => sum + g.targetAmount.toNumber(),
    0
  );
  const totalSavingsCurrent = savingsGoals.reduce(
    (sum, g) => sum + g.currentAmount.toNumber(),
    0
  );

  return {
    income,
    expenses,
    netFlow: income - expenses,
    totalBalance,
    budgetsCount: budgets.length,
    savingsGoals: {
      count: savingsGoals.length,
      target: totalSavingsTarget,
      current: totalSavingsCurrent,
    },
    recentTransactions: transactions.slice(0, 5),
  };
}

async function getCashFlowData(profileIds: string[]): Promise<CashFlowData[]> {
  const now = new Date();
  const months: CashFlowData[] = [];

  // Get last 6 months of data
  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const startOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const endOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

    const transactions = await db.transaction.findMany({
      where: {
        profileId: { in: profileIds },
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    });

    const income = transactions
      .filter((t) => t.type === "INCOME")
      .reduce((sum, t) => sum + t.amountEur.toNumber(), 0);

    const expenses = transactions
      .filter((t) => t.type === "EXPENSE")
      .reduce((sum, t) => sum + Math.abs(t.amountEur.toNumber()), 0);

    months.push({
      month: monthDate.toLocaleString("default", { month: "short" }),
      income,
      expenses,
    });
  }

  return months;
}

async function getCategorySpendingData(
  profileIds: string[]
): Promise<CategorySpendingData[]> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Get all expense transactions for this month with categories
  const transactions = await db.transaction.findMany({
    where: {
      profileId: { in: profileIds },
      type: "EXPENSE",
      date: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
    include: {
      category: true,
    },
  });

  // Group by category
  const categoryTotals = new Map<string, { name: string; value: number }>();

  for (const tx of transactions) {
    const categoryName = tx.category?.name || "Uncategorized";
    const current = categoryTotals.get(categoryName) || { name: categoryName, value: 0 };
    current.value += Math.abs(tx.amountEur.toNumber());
    categoryTotals.set(categoryName, current);
  }

  // Convert to array and sort by value (descending), limit to top 8
  const sortedData = Array.from(categoryTotals.values())
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
    .map((item, index) => ({
      ...item,
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    }));

  return sortedData;
}

async function getBudgetProgressData(
  userId: string,
  profileIds: string[]
): Promise<BudgetProgressData[]> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Get active budgets
  const budgets = await db.budget.findMany({
    where: {
      userId,
      isActive: true,
    },
    include: {
      category: true,
    },
  });

  const budgetData: BudgetProgressData[] = [];

  for (const budget of budgets) {
    // Get spending for this category this month
    const transactions = await db.transaction.findMany({
      where: {
        profileId: { in: profileIds },
        categoryId: budget.categoryId,
        type: "EXPENSE",
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    });

    const spent = transactions.reduce(
      (sum, t) => sum + Math.abs(t.amountEur.toNumber()),
      0
    );

    const budgetAmount = budget.amount.toNumber();
    const percentage = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;

    budgetData.push({
      name: budget.category.name,
      spent,
      budget: budgetAmount,
      percentage,
    });
  }

  return budgetData;
}

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  // Get user's Wise profiles for chart data
  const userProfiles = await db.wiseProfile.findMany({
    where: { userId: session.user.id },
    select: { id: true },
  });
  const profileIds = userProfiles.map((p) => p.id);

  // Fetch all data in parallel
  const [data, cashFlowData, categoryData, budgetProgressData] = await Promise.all([
    getDashboardData(session.user.id),
    getCashFlowData(profileIds),
    getCategorySpendingData(profileIds),
    getBudgetProgressData(session.user.id, profileIds),
  ]);

  const monthName = new Date().toLocaleString("default", { month: "long" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {session.user.name || session.user.email}
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
              {data.totalBalance.toLocaleString("de-DE", {
                style: "currency",
                currency: "EUR",
              })}
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
              +
              {data.income.toLocaleString("de-DE", {
                style: "currency",
                currency: "EUR",
              })}
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
              -
              {data.expenses.toLocaleString("de-DE", {
                style: "currency",
                currency: "EUR",
              })}
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
                data.netFlow >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {data.netFlow >= 0 ? "+" : ""}
              {data.netFlow.toLocaleString("de-DE", {
                style: "currency",
                currency: "EUR",
              })}
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
            <CashFlowChart data={cashFlowData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
            <CardDescription>{monthName} breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <CategorySpendingChart data={categoryData} />
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
          <BudgetProgressChart data={budgetProgressData} />
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
              You have {data.budgetsCount} active budget
              {data.budgetsCount !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.budgetsCount === 0 ? (
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
              {data.savingsGoals.count} active goal
              {data.savingsGoals.count !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.savingsGoals.count === 0 ? (
              <p className="text-sm text-muted-foreground">
                No savings goals yet. Set one up to track your progress.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Total Progress</span>
                  <span>
                    {data.savingsGoals.current.toLocaleString("de-DE", {
                      style: "currency",
                      currency: "EUR",
                    })}{" "}
                    /{" "}
                    {data.savingsGoals.target.toLocaleString("de-DE", {
                      style: "currency",
                      currency: "EUR",
                    })}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        (data.savingsGoals.current / data.savingsGoals.target) *
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
          {data.recentTransactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No transactions yet. Sync with Wise to import your transactions.
            </p>
          ) : (
            <div className="space-y-4">
              {data.recentTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        transaction.type === "INCOME"
                          ? "bg-green-500"
                          : "bg-red-500"
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium">
                        {transaction.description || transaction.merchant || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {transaction.date.toLocaleDateString("de-DE")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {transaction.category && (
                      <Badge variant="outline">
                        {transaction.category.name}
                      </Badge>
                    )}
                    <span
                      className={`font-medium ${
                        transaction.type === "INCOME"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {transaction.type === "INCOME" ? "+" : "-"}
                      {Math.abs(transaction.amountEur.toNumber()).toLocaleString(
                        "de-DE",
                        {
                          style: "currency",
                          currency: "EUR",
                        }
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
