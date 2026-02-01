import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import {
  type CashFlowData,
  type CategorySpendingData,
  type BudgetProgressData,
} from "@/components/charts";
import { DashboardContent } from "./dashboard-content";
import { getIndexaPortfolioSummary, isIndexaConfigured } from "@/lib/server/indexa";
import { getFinancialAssetsTotals } from "@/lib/server/alphavantage";
import { getTangibleAssetsTotals } from "@/lib/server/assets";

// Color palette for category chart
const CATEGORY_COLORS = [
  "hsl(221, 83%, 53%)", // blue
  "hsl(262, 83%, 58%)", // purple
  "hsl(142, 76%, 36%)", // green
  "hsl(38, 92%, 50%)", // orange
  "hsl(0, 84%, 60%)", // red
  "hsl(199, 89%, 48%)", // cyan
  "hsl(340, 82%, 52%)", // pink
  "hsl(45, 93%, 47%)", // yellow
  "hsl(172, 66%, 50%)", // teal
  "hsl(292, 84%, 61%)", // magenta
];

/**
 * Fetch all dashboard data in a single optimized function
 * This consolidates multiple queries and avoids N+1 problems
 */
async function getAllDashboardData(userId: string) {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Get start of 6 months ago for cash flow chart
  const sixMonthsAgoStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  // Single query for user's Wise profiles
  const userProfiles = await db.wiseProfile.findMany({
    where: { userId },
    select: { id: true },
  });
  const profileIds = userProfiles.map((p) => p.id);

  // If no profiles, return empty data
  if (profileIds.length === 0) {
    return {
      profileIds: [],
      currentMonthTransactions: [],
      sixMonthTransactions: [],
      wiseBalances: [],
      budgets: [],
      savingsGoals: [],
      recurringExpenses: [],
    };
  }

  // Fetch all data in parallel with consolidated queries
  const [
    // All transactions from last 6 months (for cash flow + current month)
    sixMonthTransactions,
    // Wise balances
    wiseBalances,
    // Active budgets with categories
    budgets,
    // Savings goals
    savingsGoals,
    // Upcoming recurring expenses
    recurringExpenses,
  ] = await Promise.all([
    db.transaction.findMany({
      where: {
        profileId: { in: profileIds },
        date: {
          gte: sixMonthsAgoStart,
          lte: currentMonthEnd,
        },
      },
      include: {
        category: true,
      },
      orderBy: {
        date: "desc",
      },
    }),
    db.wiseBalance.findMany({
      where: {
        profileId: { in: profileIds },
      },
    }),
    db.budget.findMany({
      where: {
        userId,
        isActive: true,
      },
      include: {
        category: true,
      },
    }),
    db.savingsGoal.findMany({
      where: {
        userId,
        isCompleted: false,
      },
    }),
    db.recurringExpense.findMany({
      where: {
        isActive: true,
      },
      include: {
        category: true,
      },
      orderBy: {
        nextDueDate: "asc",
      },
    }),
  ]);

  // Filter current month transactions from the 6-month data
  const currentMonthTransactions = sixMonthTransactions.filter(
    (t) => t.date >= currentMonthStart && t.date <= currentMonthEnd
  );

  return {
    profileIds,
    currentMonthTransactions,
    sixMonthTransactions,
    wiseBalances,
    budgets,
    savingsGoals,
    recurringExpenses,
  };
}

/**
 * Process fetched data into dashboard stats
 */
function calculateDashboardStats(data: Awaited<ReturnType<typeof getAllDashboardData>>) {
  const { currentMonthTransactions, wiseBalances, budgets, savingsGoals, recurringExpenses } = data;

  // Calculate income and expenses for current month
  const income = currentMonthTransactions
    .filter((t) => t.type === "INCOME")
    .reduce((sum, t) => sum + t.amountEur.toNumber(), 0);

  const expenses = currentMonthTransactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((sum, t) => sum + Math.abs(t.amountEur.toNumber()), 0);

  // Total balance across all Wise accounts
  const totalBalance = wiseBalances.reduce((sum, b) => sum + b.amount.toNumber(), 0);

  // Savings goals summary
  const totalSavingsTarget = savingsGoals.reduce((sum, g) => sum + g.targetAmount.toNumber(), 0);
  const totalSavingsCurrent = savingsGoals.reduce((sum, g) => sum + g.currentAmount.toNumber(), 0);

  // Serialize recent transactions for client component
  const recentTransactions = currentMonthTransactions.slice(0, 5).map((t) => ({
    id: t.id,
    type: t.type,
    description: t.description,
    date: t.date.toISOString(),
    amountEur: t.amountEur.toNumber(),
    category: t.category
      ? {
          name: t.category.name,
          color: t.category.color,
        }
      : null,
  }));

  // Calculate monthly recurring totals (normalized to monthly amount) by type
  const calculateMonthlyAmount = (amount: number, frequency: string): number => {
    switch (frequency) {
      case "WEEKLY":
        return amount * 4.33;
      case "BIWEEKLY":
        return amount * 2.17;
      case "MONTHLY":
        return amount;
      case "BIMONTHLY":
        return amount / 2;
      case "QUARTERLY":
        return amount / 3;
      case "YEARLY":
        return amount / 12;
      default:
        return amount;
    }
  };

  // Monthly AVERAGES (for reference/comparison)
  const avgMonthlyRecurringExpenses = recurringExpenses
    .filter((r) => r.type === "EXPENSE")
    .reduce((sum, r) => sum + calculateMonthlyAmount(r.amount.toNumber(), r.frequency), 0);

  const avgMonthlyRecurringIncome = recurringExpenses
    .filter((r) => r.type === "INCOME")
    .reduce((sum, r) => sum + calculateMonthlyAmount(r.amount.toNumber(), r.frequency), 0);

  // Calculate ACTUAL recurring items due THIS month (based on nextDueDate)
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const thisMonthRecurringExpenses = recurringExpenses
    .filter(
      (r) =>
        r.type === "EXPENSE" &&
        r.nextDueDate >= currentMonthStart &&
        r.nextDueDate <= currentMonthEnd
    )
    .reduce((sum, r) => sum + r.amount.toNumber(), 0);

  const thisMonthRecurringIncome = recurringExpenses
    .filter(
      (r) =>
        r.type === "INCOME" &&
        r.nextDueDate >= currentMonthStart &&
        r.nextDueDate <= currentMonthEnd
    )
    .reduce((sum, r) => sum + r.amount.toNumber(), 0);

  // Calculate total monthly budget (normalize all budgets to monthly)
  const totalMonthlyBudget = budgets.reduce((sum, b) => {
    const amount = b.amount.toNumber();
    switch (b.period) {
      case "WEEKLY":
        return sum + amount * 4.33;
      case "MONTHLY":
        return sum + amount;
      case "YEARLY":
        return sum + amount / 12;
      default:
        return sum + amount;
    }
  }, 0);

  // Serialize upcoming recurring items for client component (only first 5)
  const upcomingRecurring = recurringExpenses.slice(0, 5).map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    amount: r.amount.toNumber(),
    currency: r.currency,
    frequency: r.frequency,
    nextDueDate: r.nextDueDate.toISOString(),
    category: r.category
      ? {
          name: r.category.name,
          color: r.category.color,
        }
      : null,
  }));

  return {
    income,
    expenses,
    netFlow: income - expenses,
    totalBalance,
    budgetsCount: budgets.length,
    totalMonthlyBudget,
    savingsGoals: {
      count: savingsGoals.length,
      target: totalSavingsTarget,
      current: totalSavingsCurrent,
    },
    recentTransactions,
    upcomingRecurring,
    // This month's actual recurring (based on nextDueDate)
    thisMonthRecurringExpenses,
    thisMonthRecurringIncome,
    // Monthly averages (for reference)
    avgMonthlyRecurringExpenses,
    avgMonthlyRecurringIncome,
  };
}

/**
 * Calculate cash flow data from pre-fetched transactions
 */
function calculateCashFlowData(
  transactions: Awaited<ReturnType<typeof getAllDashboardData>>["sixMonthTransactions"]
): CashFlowData[] {
  const now = new Date();
  const months: CashFlowData[] = [];

  // Process last 6 months
  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const startOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const endOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

    // Filter transactions for this month
    const monthTransactions = transactions.filter(
      (t) => t.date >= startOfMonth && t.date <= endOfMonth
    );

    const income = monthTransactions
      .filter((t) => t.type === "INCOME")
      .reduce((sum, t) => sum + t.amountEur.toNumber(), 0);

    const expenses = monthTransactions
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

/**
 * Calculate category spending from pre-fetched transactions
 */
function calculateCategorySpendingData(
  transactions: Awaited<ReturnType<typeof getAllDashboardData>>["currentMonthTransactions"]
): CategorySpendingData[] {
  // Filter to expenses and refunds, excluding TRANSFER type transactions
  // Also exclude transactions with TRANSFER category type
  const relevantTransactions = transactions.filter(
    (t) => (t.type === "EXPENSE" || t.type === "INCOME") && t.category?.type !== "TRANSFER"
  );

  // Group by category and calculate net spending (expenses minus refunds)
  const categoryTotals = new Map<string, { name: string; value: number }>();

  for (const tx of relevantTransactions) {
    const categoryName = tx.category?.name || "Uncategorized";
    const current = categoryTotals.get(categoryName) || { name: categoryName, value: 0 };
    const amount = Math.abs(tx.amountEur.toNumber());
    // Subtract refunds (INCOME) from the total
    current.value = tx.type === "EXPENSE" ? current.value + amount : current.value - amount;
    categoryTotals.set(categoryName, current);
  }

  // Convert to array, filter out zero/negative values, sort by value (descending), limit to top 8
  const sortedData = Array.from(categoryTotals.values())
    .filter((item) => item.value > 0) // Only show categories with net positive spending
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
    .map((item, index) => ({
      ...item,
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    }));

  return sortedData;
}

/**
 * Calculate budget progress from pre-fetched data
 */
function calculateBudgetProgressData(
  budgets: Awaited<ReturnType<typeof getAllDashboardData>>["budgets"],
  transactions: Awaited<ReturnType<typeof getAllDashboardData>>["currentMonthTransactions"]
): BudgetProgressData[] {
  // Pre-calculate net spending by category (expenses minus refunds)
  const spendingByCategory = new Map<string, number>();

  for (const tx of transactions) {
    if ((tx.type === "EXPENSE" || tx.type === "INCOME") && tx.categoryId) {
      const current = spendingByCategory.get(tx.categoryId) || 0;
      const amount = Math.abs(tx.amountEur.toNumber());
      // Subtract refunds (INCOME) from the total
      const newValue = tx.type === "EXPENSE" ? current + amount : current - amount;
      spendingByCategory.set(tx.categoryId, newValue);
    }
  }

  return budgets.map((budget) => {
    const spent = Math.max(0, spendingByCategory.get(budget.categoryId) || 0);
    const budgetAmount = budget.amount.toNumber();
    const percentage = budgetAmount > 0 ? Math.round((spent / budgetAmount) * 100) : 0;

    return {
      name: budget.category.name,
      spent,
      budget: budgetAmount,
      percentage,
    };
  });
}

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  // Fetch all data in one optimized call
  const allData = await getAllDashboardData(session.user.id);

  // Process data (no additional DB calls)
  const stats = calculateDashboardStats(allData);
  const cashFlowData = calculateCashFlowData(allData.sixMonthTransactions);
  const categoryData = calculateCategorySpendingData(allData.currentMonthTransactions);
  const budgetProgressData = calculateBudgetProgressData(
    allData.budgets,
    allData.currentMonthTransactions
  );

  // Fetch all asset summaries in parallel
  const [indexaPortfolio, financialAssetsTotals, tangibleAssetsTotals] = await Promise.all([
    isIndexaConfigured() ? getIndexaPortfolioSummary(session.user.id) : null,
    getFinancialAssetsTotals(session.user.id),
    getTangibleAssetsTotals(session.user.id),
  ]);

  // Build investment summary (Indexa)
  const investmentSummary = indexaPortfolio
    ? {
        totalValue: indexaPortfolio.totalValue,
        totalReturns: indexaPortfolio.totalReturns,
        totalReturnsPercent: indexaPortfolio.totalReturnsPercent,
      }
    : null;

  // Build financial assets summary (Stocks/Crypto)
  const financialAssetsSummary =
    financialAssetsTotals.assetCount > 0
      ? {
          totalValue: financialAssetsTotals.totalValue,
          totalCost: financialAssetsTotals.totalCost,
          totalGainLoss: financialAssetsTotals.totalGainLoss,
          totalGainLossPercent: financialAssetsTotals.totalGainLossPercent,
          assetCount: financialAssetsTotals.assetCount,
        }
      : null;

  // Build tangible assets summary
  const tangibleAssetsSummary =
    tangibleAssetsTotals.assetCount > 0
      ? {
          totalCurrentValue: tangibleAssetsTotals.totalCurrentValue,
          totalPurchasePrice: tangibleAssetsTotals.totalPurchasePrice,
          totalDepreciation: tangibleAssetsTotals.totalDepreciation,
          depreciationPercent: tangibleAssetsTotals.depreciationPercent,
          assetCount: tangibleAssetsTotals.assetCount,
        }
      : null;

  // Calculate total net worth
  const netWorth = {
    cash: stats.totalBalance,
    indexa: investmentSummary?.totalValue ?? 0,
    financialAssets: financialAssetsSummary?.totalValue ?? 0,
    tangibleAssets: tangibleAssetsSummary?.totalCurrentValue ?? 0,
    total:
      stats.totalBalance +
      (investmentSummary?.totalValue ?? 0) +
      (financialAssetsSummary?.totalValue ?? 0) +
      (tangibleAssetsSummary?.totalCurrentValue ?? 0),
  };

  const monthName = new Date().toLocaleString("default", { month: "long" });

  return (
    <DashboardContent
      stats={stats}
      cashFlowData={cashFlowData}
      categoryData={categoryData}
      budgetProgressData={budgetProgressData}
      monthName={monthName}
      userName={session.user.name || session.user.email || "User"}
      investmentSummary={investmentSummary}
      financialAssetsSummary={financialAssetsSummary}
      tangibleAssetsSummary={tangibleAssetsSummary}
      netWorth={netWorth}
    />
  );
}
