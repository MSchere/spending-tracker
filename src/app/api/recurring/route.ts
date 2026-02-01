import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { Decimal } from "decimal.js";
import { RecurringType } from "@prisma/client";

/**
 * GET /api/recurring - Get all recurring items (expenses and income)
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
    console.error("Get recurring items error:", error);
    return NextResponse.json({ error: "Failed to get recurring items" }, { status: 500 });
  }
}

/**
 * POST /api/recurring - Create a new recurring item (expense or income)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, type, amount, frequency, nextDueDate, categoryId } = body;

    if (!name || !amount || !frequency || !nextDueDate) {
      return NextResponse.json(
        { error: "name, amount, frequency, and nextDueDate are required" },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes: RecurringType[] = ["EXPENSE", "INCOME"];
    const recurringType = type && validTypes.includes(type) ? type : "EXPENSE";

    const recurring = await db.recurringExpense.create({
      data: {
        name,
        type: recurringType,
        amount: new Decimal(amount),
        frequency,
        nextDueDate: new Date(nextDueDate),
        categoryId: categoryId || null,
        isActive: true,
      },
      include: { category: true },
    });

    return NextResponse.json(recurring, { status: 201 });
  } catch (error) {
    console.error("Create recurring item error:", error);
    return NextResponse.json({ error: "Failed to create recurring item" }, { status: 500 });
  }
}
