import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { Decimal } from "decimal.js";

/**
 * GET /api/savings - Get all savings goals for the user
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const savingsGoals = await db.savingsGoal.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(savingsGoals);
  } catch (error) {
    console.error("Get savings goals error:", error);
    return NextResponse.json(
      { error: "Failed to get savings goals" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/savings - Create a new savings goal
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, targetAmount, currentAmount, type, deadline } = body;

    if (!name || !targetAmount || !type) {
      return NextResponse.json(
        { error: "name, targetAmount, and type are required" },
        { status: 400 }
      );
    }

    // Create savings goal
    const goal = await db.savingsGoal.create({
      data: {
        userId: session.user.id,
        name,
        targetAmount: new Decimal(targetAmount),
        currentAmount: new Decimal(currentAmount || 0),
        type,
        deadline: deadline ? new Date(deadline) : null,
        isCompleted: false,
      },
    });

    return NextResponse.json(goal, { status: 201 });
  } catch (error) {
    console.error("Create savings goal error:", error);
    return NextResponse.json(
      { error: "Failed to create savings goal" },
      { status: 500 }
    );
  }
}
