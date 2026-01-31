import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { RecurringList } from "./recurring-list";

async function getRecurringData(userId: string) {
  // Get user's profiles
  const profiles = await db.wiseProfile.findMany({
    where: { userId },
    select: { id: true },
  });

  // For now, get recurring expenses based on pattern detection
  // This is a placeholder - in production we'd analyze transaction patterns
  const recurringExpenses = await db.recurringExpense.findMany({
    include: { category: true },
    orderBy: { nextDueDate: "asc" },
  });

  const categories = await db.category.findMany({
    where: { type: { in: ["FIXED_EXPENSE", "VARIABLE_EXPENSE"] } },
    orderBy: { name: "asc" },
  });

  return {
    recurring: recurringExpenses.map((r) => ({
      id: r.id,
      name: r.name,
      amount: r.amount.toNumber(),
      frequency: r.frequency,
      nextDueDate: r.nextDueDate.toISOString(),
      categoryId: r.categoryId,
      categoryName: r.category?.name || null,
      isActive: r.isActive,
    })),
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
    })),
    // Suppress unused variable warning
    _profileCount: profiles.length,
  };
}

export default async function RecurringPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const { recurring, categories } = await getRecurringData(session.user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Recurring Expenses
        </h1>
        <p className="text-muted-foreground">
          Track your subscriptions and regular bills
        </p>
      </div>

      <RecurringList recurring={recurring} categories={categories} />
    </div>
  );
}
