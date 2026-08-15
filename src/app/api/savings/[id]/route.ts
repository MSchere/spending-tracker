import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { Decimal } from "decimal.js";

/**
 * PATCH /api/savings/[id] - Update a savings goal
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, targetAmount, currentAmount, type, deadline, isCompleted } = body;

    const goal = await db.savingsGoal.findUnique({
      where: { id },
    });

    if (!goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    if (goal.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const VALID_TYPES = ["EMERGENCY_FUND", "SAVINGS", "INDEX_FUND", "ETF", "STOCK", "CRYPTO"];
    if (type !== undefined && !VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    const updateData: {
      name?: string;
      targetAmount?: typeof goal.targetAmount;
      currentAmount?: typeof goal.currentAmount;
      type?: typeof goal.type;
      deadline?: Date | null;
      isCompleted?: boolean;
    } = {};
    if (name !== undefined) {
      if (!name) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
      updateData.name = name;
    }
    if (targetAmount !== undefined) {
      updateData.targetAmount = new Decimal(targetAmount);
    }
    if (currentAmount !== undefined) {
      updateData.currentAmount = new Decimal(currentAmount);
    }
    if (type !== undefined) {
      updateData.type = type;
    }
    if (deadline !== undefined) {
      updateData.deadline = deadline ? new Date(deadline) : null;
    }
    if (isCompleted !== undefined) {
      updateData.isCompleted = isCompleted;
    }

    const updated = await db.savingsGoal.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update savings goal error:", error);
    return NextResponse.json({ error: "Failed to update savings goal" }, { status: 500 });
  }
}

/**
 * DELETE /api/savings/[id] - Delete a savings goal
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const goal = await db.savingsGoal.findUnique({
      where: { id },
    });

    if (!goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    if (goal.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await db.savingsGoal.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete savings goal error:", error);
    return NextResponse.json({ error: "Failed to delete savings goal" }, { status: 500 });
  }
}
