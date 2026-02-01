import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { RecurringList } from "./recurring-list";

async function getRecurringData(userId: string) {
  // Get user's profiles
  const profiles = await db.wiseProfile.findMany({
    where: { userId },
    select: { id: true },
  });

  // Get all recurring items (expenses and income)
  const recurringItems = await db.recurringExpense.findMany({
    include: { category: true },
    orderBy: { nextDueDate: "asc" },
  });

  // Get all categories (for both expenses and income)
  const categories = await db.category.findMany({
    where: { type: { in: ["FIXED_EXPENSE", "VARIABLE_EXPENSE", "INCOME"] } },
    orderBy: { name: "asc" },
  });

  return {
    recurring: recurringItems.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
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
        <h1 className="text-3xl font-bold tracking-tight">Recurring</h1>
        <p className="text-muted-foreground">Track your recurring expenses and income</p>
      </div>

      <RecurringList recurring={recurring} categories={categories} />
    </div>
  );
}
