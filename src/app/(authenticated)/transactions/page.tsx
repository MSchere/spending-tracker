import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { TransactionsList } from "./transactions-list";

async function getTransactionsData(userId: string) {
  // Get user's Wise profiles
  const userProfiles = await db.wiseProfile.findMany({
    where: { userId },
    select: { id: true },
  });
  const profileIds = userProfiles.map((p) => p.id);

  // Get all transactions
  const transactions = await db.transaction.findMany({
    where: {
      profileId: { in: profileIds },
    },
    include: {
      category: true,
    },
    orderBy: {
      date: "desc",
    },
  });

  // Get all categories for the filter
  const categories = await db.category.findMany({
    orderBy: { name: "asc" },
  });

  return { transactions, categories };
}

export default async function TransactionsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const { transactions, categories } = await getTransactionsData(
    session.user.id
  );

  // Serialize for client component
  const serializedTransactions = transactions.map((t) => ({
    id: t.id,
    date: t.date.toISOString(),
    description: t.description || t.merchant || "Unknown",
    merchant: t.merchant,
    amount: t.amount.toNumber(),
    currency: t.currency,
    amountEur: t.amountEur.toNumber(),
    type: t.type,
    categoryId: t.categoryId,
    categoryName: t.category?.name || null,
    categoryColor: t.category?.color || null,
  }));

  const serializedCategories = categories.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    color: c.color,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
        <p className="text-muted-foreground">
          View and manage your transactions
        </p>
      </div>

      <TransactionsList
        transactions={serializedTransactions}
        categories={serializedCategories}
      />
    </div>
  );
}
