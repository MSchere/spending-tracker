import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { Decimal } from "decimal.js";

/**
 * GET /api/budgets - Get all budgets for the user
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const budgets = await db.budget.findMany({
      where: { userId: session.user.id },
      include: { category: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(budgets);
  } catch (error) {
    console.error("Get budgets error:", error);
    return NextResponse.json(
      { error: "Failed to get budgets" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/budgets - Create a new budget
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { categoryId, amount, period } = body;

    if (!categoryId || !amount || !period) {
      return NextResponse.json(
        { error: "categoryId, amount, and period are required" },
        { status: 400 }
      );
    }

    // Check if budget already exists for this category
    const existing = await db.budget.findFirst({
      where: {
        userId: session.user.id,
        categoryId,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A budget for this category already exists" },
        { status: 409 }
      );
    }

    // Verify category exists
    const category = await db.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 400 }
      );
    }

    // Create budget
    const budget = await db.budget.create({
      data: {
        userId: session.user.id,
        categoryId,
        amount: new Decimal(amount),
        period,
        startDate: new Date(),
        isActive: true,
      },
      include: { category: true },
    });

    return NextResponse.json(budget, { status: 201 });
  } catch (error) {
    console.error("Create budget error:", error);
    return NextResponse.json(
      { error: "Failed to create budget" },
      { status: 500 }
    );
  }
}
