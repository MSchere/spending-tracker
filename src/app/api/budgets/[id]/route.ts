import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { Decimal } from "decimal.js";

/**
 * PUT /api/budgets/[id] - Update a budget
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { categoryId, amount, period, isActive } = body;

    const budget = await db.budget.findUnique({
      where: { id },
    });

    if (!budget) {
      return NextResponse.json({ error: "Budget not found" }, { status: 404 });
    }

    if (budget.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const validPeriods = ["WEEKLY", "MONTHLY", "YEARLY"];
    if (period !== undefined && !validPeriods.includes(period)) {
      return NextResponse.json({ error: "Invalid period" }, { status: 400 });
    }

    if (categoryId !== undefined && categoryId !== budget.categoryId) {
      const existing = await db.budget.findFirst({
        where: {
          userId: session.user.id,
          categoryId,
          id: { not: id },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "A budget for this category already exists" },
          { status: 409 }
        );
      }

      const category = await db.category.findUnique({ where: { id: categoryId } });
      if (!category) {
        return NextResponse.json({ error: "Category not found" }, { status: 400 });
      }
    }

    const updateData: {
      categoryId?: string;
      amount?: typeof budget.amount;
      period?: typeof budget.period;
      isActive?: boolean;
    } = {};
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (amount !== undefined) updateData.amount = new Decimal(amount);
    if (period !== undefined) updateData.period = period;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updated = await db.budget.update({
      where: { id },
      data: updateData,
      include: { category: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update budget error:", error);
    return NextResponse.json({ error: "Failed to update budget" }, { status: 500 });
  }
}

/**
 * DELETE /api/budgets/[id] - Delete a budget
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

    const budget = await db.budget.findUnique({
      where: { id },
    });

    if (!budget) {
      return NextResponse.json({ error: "Budget not found" }, { status: 404 });
    }

    if (budget.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await db.budget.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete budget error:", error);
    return NextResponse.json({ error: "Failed to delete budget" }, { status: 500 });
  }
}
