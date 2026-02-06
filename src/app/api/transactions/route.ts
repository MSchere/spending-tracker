import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { TransactionType } from "@prisma/client";

/**
 * POST /api/transactions - Create a manual transaction
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { type, amount, currency, description, date, categoryId } = body as {
      type: string;
      amount: number;
      currency?: string;
      description: string;
      date: string;
      categoryId?: string | null;
    };

    // Validate required fields
    if (!type || amount === undefined || !description || !date) {
      return NextResponse.json(
        { error: "type, amount, description, and date are required" },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes: TransactionType[] = ["INCOME", "EXPENSE", "TRANSFER", "INVESTMENT"];
    if (!validTypes.includes(type as TransactionType)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate category if provided
    if (categoryId) {
      const category = await db.category.findUnique({
        where: { id: categoryId },
      });
      if (!category) {
        return NextResponse.json({ error: "Category not found" }, { status: 400 });
      }
    }

    // For manual transactions, use EUR as default and same value for amountEur
    const txCurrency = currency || "EUR";
    const amountValue = Math.abs(amount);

    const transaction = await db.transaction.create({
      data: {
        userId: session.user.id,
        type: type as TransactionType,
        amount: amountValue,
        currency: txCurrency,
        amountEur: amountValue, // For manual transactions, assume EUR or user converts
        description,
        date: new Date(date),
        categoryId: categoryId || null,
      },
    });

    // Fetch category name if exists
    let categoryName: string | null = null;
    if (transaction.categoryId) {
      const category = await db.category.findUnique({
        where: { id: transaction.categoryId },
      });
      categoryName = category?.name || null;
    }

    return NextResponse.json(
      {
        id: transaction.id,
        type: transaction.type,
        amount: transaction.amount.toNumber(),
        currency: transaction.currency,
        amountEur: transaction.amountEur.toNumber(),
        description: transaction.description,
        date: transaction.date.toISOString(),
        categoryId: transaction.categoryId,
        categoryName,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create transaction error:", error);
    return NextResponse.json({ error: "Failed to create transaction" }, { status: 500 });
  }
}
