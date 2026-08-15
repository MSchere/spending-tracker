import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { Decimal } from "decimal.js";
import { RecurringType } from "@prisma/client";

/**
 * PUT /api/recurring/[id] - Update a recurring item
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, type, amount, frequency, nextDueDate, categoryId, isActive } = body;

    const recurring = await db.recurringExpense.findUnique({
      where: { id },
    });

    if (!recurring) {
      return NextResponse.json({ error: "Recurring item not found" }, { status: 404 });
    }

    const validTypes: RecurringType[] = ["EXPENSE", "INCOME"];
    const validFrequencies = ["WEEKLY", "BIWEEKLY", "MONTHLY", "BIMONTHLY", "QUARTERLY", "YEARLY"];

    if (type !== undefined && !validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }
    if (frequency !== undefined && !validFrequencies.includes(frequency)) {
      return NextResponse.json({ error: "Invalid frequency" }, { status: 400 });
    }

    const updateData: {
      name?: string;
      type?: RecurringType;
      amount?: typeof recurring.amount;
      frequency?: typeof recurring.frequency;
      nextDueDate?: Date;
      categoryId?: string | null;
      isActive?: boolean;
    } = {};
    if (name !== undefined) {
      if (!name) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
      updateData.name = name;
    }
    if (type !== undefined) updateData.type = type;
    if (amount !== undefined) updateData.amount = new Decimal(amount);
    if (frequency !== undefined) updateData.frequency = frequency;
    if (nextDueDate !== undefined) updateData.nextDueDate = new Date(nextDueDate);
    if (categoryId !== undefined) updateData.categoryId = categoryId || null;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updated = await db.recurringExpense.update({
      where: { id },
      data: updateData,
      include: { category: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update recurring item error:", error);
    return NextResponse.json({ error: "Failed to update recurring item" }, { status: 500 });
  }
}

/**
 * DELETE /api/recurring/[id] - Delete a recurring expense
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

    const expense = await db.recurringExpense.findUnique({
      where: { id },
    });

    if (!expense) {
      return NextResponse.json({ error: "Recurring expense not found" }, { status: 404 });
    }

    await db.recurringExpense.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete recurring expense error:", error);
    return NextResponse.json({ error: "Failed to delete recurring expense" }, { status: 500 });
  }
}
