import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { SavingsGoalsList } from "./savings-list";

async function getSavingsData(userId: string) {
  const savingsGoals = await db.savingsGoal.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return {
    savingsGoals: savingsGoals.map((g) => ({
      id: g.id,
      name: g.name,
      targetAmount: g.targetAmount.toNumber(),
      currentAmount: g.currentAmount.toNumber(),
      deadline: g.deadline?.toISOString() || null,
      type: g.type,
      isCompleted: g.isCompleted,
    })),
  };
}

export default async function SavingsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const { savingsGoals } = await getSavingsData(session.user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Savings Goals</h1>
        <p className="text-muted-foreground">
          Track your progress towards financial goals
        </p>
      </div>

      <SavingsGoalsList savingsGoals={savingsGoals} />
    </div>
  );
}
