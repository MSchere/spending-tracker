import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { Decimal } from "decimal.js";

/**
 * GET /api/recurring - Get all recurring expenses
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const recurring = await db.recurringExpense.findMany({
      include: { category: true },
      orderBy: { nextDueDate: "asc" },
    });

    return NextResponse.json(recurring);
  } catch (error) {
    console.error("Get recurring expenses error:", error);
    return NextResponse.json(
      { error: "Failed to get recurring expenses" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/recurring - Create a new recurring expense
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, amount, frequency, nextDueDate, categoryId } = body;

    if (!name || !amount || !frequency || !nextDueDate) {
      return NextResponse.json(
        { error: "name, amount, frequency, and nextDueDate are required" },
        { status: 400 }
      );
    }

    const expense = await db.recurringExpense.create({
      data: {
        name,
        amount: new Decimal(amount),
        frequency,
        nextDueDate: new Date(nextDueDate),
        categoryId: categoryId || null,
        isActive: true,
      },
      include: { category: true },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error("Create recurring expense error:", error);
    return NextResponse.json(
      { error: "Failed to create recurring expense" },
      { status: 500 }
    );
  }
}
