import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import {
  type CashFlowData,
  type CategorySpendingData,
  type BudgetProgressData,
} from "@/components/charts";
import { DashboardContent } from "./dashboard-content";
import { getFinancialAssetsTotals } from "@/lib/server/alphavantage";
import { getTangibleAssetsTotals } from "@/lib/server/assets";
import { subWeeks, subMonths, subQuarters, subYears } from "date-fns";

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

  const sixMonthsAgoStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const userProfiles = await db.wiseProfile.findMany({
    where: { userId },
    select: { id: true },
  });
  const profileIds = userProfiles.map((p) => p.id);

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

  const [
    // All transactions from last 6 months (for cash flow + current month)
    sixMonthTransactions,
    wiseBalances,
    budgets,
    savingsGoals,
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

  const income = currentMonthTransactions
    .filter((t) => t.type === "INCOME")
    .reduce((sum, t) => sum + t.amountEur.toNumber(), 0);

  const expenses = currentMonthTransactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((sum, t) => sum + Math.abs(t.amountEur.toNumber()), 0);

  const totalBalance = wiseBalances.reduce((sum, b) => sum + b.amount.toNumber(), 0);

  const totalSavingsTarget = savingsGoals.reduce((sum, g) => sum + g.targetAmount.toNumber(), 0);
  const totalSavingsCurrent = savingsGoals.reduce((sum, g) => sum + g.currentAmount.toNumber(), 0);

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

  const avgMonthlyRecurringExpenses = recurringExpenses
    .filter((r) => r.type === "EXPENSE")
    .reduce((sum, r) => sum + calculateMonthlyAmount(r.amount.toNumber(), r.frequency), 0);

  const avgMonthlyRecurringIncome = recurringExpenses
    .filter((r) => r.type === "INCOME")
    .reduce((sum, r) => sum + calculateMonthlyAmount(r.amount.toNumber(), r.frequency), 0);

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // Determine if a recurring item has an occurrence in the given month.
  // After advanceRecurringDueDates() runs, nextDueDate is always >= today,
  // which means items whose due day already passed this month have been
  // pushed to next month. We step back one frequency period to catch those.
  function hasOccurrenceInMonth(frequency: string, nextDueDate: Date): boolean {
    if (nextDueDate >= currentMonthStart && nextDueDate <= currentMonthEnd) return true;
    if (nextDueDate > currentMonthEnd) {
      let prev: Date;
      switch (frequency) {
        case "WEEKLY":
          prev = subWeeks(nextDueDate, 1);
          break;
        case "BIWEEKLY":
          prev = subWeeks(nextDueDate, 2);
          break;
        case "MONTHLY":
          prev = subMonths(nextDueDate, 1);
          break;
        case "BIMONTHLY":
          prev = subMonths(nextDueDate, 2);
          break;
        case "QUARTERLY":
          prev = subQuarters(nextDueDate, 1);
          break;
        case "YEARLY":
          prev = subYears(nextDueDate, 1);
          break;
        default:
          prev = subMonths(nextDueDate, 1);
      }
      return prev >= currentMonthStart && prev <= currentMonthEnd;
    }
    return false;
  }

  const thisMonthRecurringExpenses = recurringExpenses
    .filter((r) => r.type === "EXPENSE" && hasOccurrenceInMonth(r.frequency, r.nextDueDate))
    .reduce((sum, r) => sum + r.amount.toNumber(), 0);

  const thisMonthRecurringIncome = recurringExpenses
    .filter((r) => r.type === "INCOME" && hasOccurrenceInMonth(r.frequency, r.nextDueDate))
    .reduce((sum, r) => sum + r.amount.toNumber(), 0);

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
    thisMonthRecurringExpenses,
    thisMonthRecurringIncome,
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

  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const startOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const endOfMonth = new Date(
      monthDate.getFullYear(),
      monthDate.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );

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
  const relevantTransactions = transactions.filter(
    (t) => (t.type === "EXPENSE" || t.type === "INCOME") && t.category?.type !== "TRANSFER"
  );

  const categoryTotals = new Map<string, { name: string; value: number }>();

  for (const tx of relevantTransactions) {
    const categoryName = tx.category?.name || "Uncategorized";
    const current = categoryTotals.get(categoryName) || { name: categoryName, value: 0 };
    const amount = Math.abs(tx.amountEur.toNumber());
    current.value = tx.type === "EXPENSE" ? current.value + amount : current.value - amount;
    categoryTotals.set(categoryName, current);
  }

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
  const spendingByCategory = new Map<string, number>();

  for (const tx of transactions) {
    if ((tx.type === "EXPENSE" || tx.type === "INCOME") && tx.categoryId) {
      const current = spendingByCategory.get(tx.categoryId) || 0;
      const amount = Math.abs(tx.amountEur.toNumber());
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

  const allData = await getAllDashboardData(session.user.id);

  const stats = calculateDashboardStats(allData);
  const cashFlowData = calculateCashFlowData(allData.sixMonthTransactions);
  const categoryData = calculateCategorySpendingData(allData.currentMonthTransactions);
  const budgetProgressData = calculateBudgetProgressData(
    allData.budgets,
    allData.currentMonthTransactions
  );

  const [financialAssetsTotals, tangibleAssetsTotals] = await Promise.all([
    getFinancialAssetsTotals(session.user.id),
    getTangibleAssetsTotals(session.user.id),
  ]);

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

  // Indexa fund positions are stored as FinancialAssets (source = INDEXA), so
  // they are already included in financialAssetsSummary — no separate term.
  const netWorth = {
    cash: stats.totalBalance,
    investments: financialAssetsSummary?.totalValue ?? 0,
    tangibleAssets: tangibleAssetsSummary?.totalCurrentValue ?? 0,
    total:
      stats.totalBalance +
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
      financialAssetsSummary={financialAssetsSummary}
      tangibleAssetsSummary={tangibleAssetsSummary}
      netWorth={netWorth}
    />
  );
}
