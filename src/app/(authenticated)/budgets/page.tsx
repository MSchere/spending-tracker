import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { BudgetsList } from "./budgets-list";
import { startOfMonth, endOfMonth } from "date-fns";

async function getBudgetsData(userId: string) {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  // Get user's Wise profiles for transaction lookup
  const userProfiles = await db.wiseProfile.findMany({
    where: { userId },
    select: { id: true },
  });
  const profileIds = userProfiles.map((p) => p.id);

  // Get all budgets for the user
  const budgets = await db.budget.findMany({
    where: { userId },
    include: {
      category: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Calculate spending for each budget category this month
  const budgetsWithSpending = await Promise.all(
    budgets.map(async (budget) => {
      const transactions = await db.transaction.findMany({
        where: {
          profileId: { in: profileIds },
          categoryId: budget.categoryId,
          type: "EXPENSE",
          date: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      });

      const spent = transactions.reduce(
        (sum, t) => sum + Math.abs(t.amountEur.toNumber()),
        0
      );

      return {
        id: budget.id,
        categoryId: budget.categoryId,
        categoryName: budget.category.name,
        categoryColor: budget.category.color,
        amount: budget.amount.toNumber(),
        spent,
        period: budget.period,
        isActive: budget.isActive,
      };
    })
  );

  // Get all categories for creating new budgets
  const categories = await db.category.findMany({
    where: {
      type: { in: ["FIXED_EXPENSE", "VARIABLE_EXPENSE"] },
    },
    orderBy: { name: "asc" },
  });

  return {
    budgets: budgetsWithSpending,
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
    })),
  };
}

export default async function BudgetsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const { budgets, categories } = await getBudgetsData(session.user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Budgets</h1>
        <p className="text-muted-foreground">
          Set spending limits for your categories
        </p>
      </div>

      <BudgetsList budgets={budgets} categories={categories} />
    </div>
  );
}
