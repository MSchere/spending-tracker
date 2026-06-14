import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { TransactionsList } from "./transactions-list";

const PAGE_SIZE = 50;

async function getTransactionsData(
  userId: string,
  page: number,
  typeFilter?: string,
  categoryFilter?: string,
  search?: string
) {
  const userProfiles = await db.wiseProfile.findMany({
    where: { userId },
    select: { id: true },
  });
  const profileIds = userProfiles.map((p) => p.id);

  type WhereClause = {
    OR: Array<{ profileId: { in: string[] } } | { userId: string }>;
    type?: "INCOME" | "EXPENSE" | "TRANSFER" | "INVESTMENT";
    categoryId?: string | null;
    description?: { contains: string };
  };

  const where: WhereClause = {
    OR: [{ profileId: { in: profileIds } }, { userId }],
  };

  if (typeFilter && typeFilter !== "all") {
    where.type = typeFilter as "INCOME" | "EXPENSE" | "TRANSFER" | "INVESTMENT";
  }

  if (categoryFilter && categoryFilter !== "all") {
    where.categoryId = categoryFilter === "uncategorized" ? null : categoryFilter;
  }

  if (search && search.trim()) {
    where.description = { contains: search.trim() };
  }

  // Get total count for pagination
  const totalCount = await db.transaction.count({ where });

  // Get paginated transactions
  const transactions = await db.transaction.findMany({
    where,
    include: {
      category: true,
    },
    orderBy: {
      date: "desc",
    },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  // Get all categories for the filter
  const categories = await db.category.findMany({
    orderBy: { name: "asc" },
  });

  return {
    transactions,
    categories,
    totalCount,
    totalPages: Math.ceil(totalCount / PAGE_SIZE),
    currentPage: page,
  };
}

interface PageProps {
  searchParams: Promise<{
    page?: string;
    type?: string;
    category?: string;
    search?: string;
  }>;
}

export default async function TransactionsPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const typeFilter = params.type;
  const categoryFilter = params.category;
  const search = params.search;

  const { transactions, categories, totalCount, totalPages, currentPage } =
    await getTransactionsData(session.user.id, page, typeFilter, categoryFilter, search);

  // Serialize for client component
  const serializedTransactions = transactions.map((t) => ({
    id: t.id,
    date: t.date.toISOString(),
    description: t.description || "Unknown",
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
          View and manage your transactions ({totalCount.toLocaleString()} total)
        </p>
      </div>

      <TransactionsList
        transactions={serializedTransactions}
        categories={serializedCategories}
        pagination={{
          currentPage,
          totalPages,
          totalCount,
          pageSize: PAGE_SIZE,
        }}
        initialFilters={{
          type: typeFilter || "all",
          category: categoryFilter || "all",
          search: search || "",
        }}
      />
    </div>
  );
}
