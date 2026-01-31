import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

/**
 * PATCH /api/transactions/[id] - Update a transaction
 * Supports bulk recategorization of similar transactions
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { categoryId, applyToSimilar, keyword } = body as {
      categoryId: string | null;
      applyToSimilar?: boolean;
      keyword?: string;
    };

    // Verify the transaction belongs to the user
    const transaction = await db.transaction.findUnique({
      where: { id },
      include: {
        profile: true,
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    if (transaction.profile?.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Validate category if provided
    if (categoryId) {
      const category = await db.category.findUnique({
        where: { id: categoryId },
      });

      if (!category) {
        return NextResponse.json(
          { error: "Category not found" },
          { status: 400 }
        );
      }
    }

    // Get user's profile IDs for scoping bulk updates
    const userProfiles = await db.wiseProfile.findMany({
      where: { userId: session.user.id },
      select: { id: true },
    });
    const profileIds = userProfiles.map((p) => p.id);

    let updatedCount = 1;

    if (applyToSimilar && keyword && keyword.trim()) {
      // Bulk update all transactions matching the keyword
      const keywordLower = keyword.toLowerCase().trim();

      const result = await db.transaction.updateMany({
        where: {
          profileId: { in: profileIds },
          description: {
            contains: keywordLower,
            mode: "insensitive",
          },
        },
        data: {
          categoryId: categoryId || null,
        },
      });

      updatedCount = result.count;

      // Save the keyword for future auto-categorization
      if (categoryId) {
        await db.categoryKeyword.upsert({
          where: {
            categoryId_keyword: {
              categoryId,
              keyword: keywordLower,
            },
          },
          create: {
            categoryId,
            keyword: keywordLower,
          },
          update: {}, // No update needed, just ensure it exists
        });
      }
    } else {
      // Update only this transaction
      await db.transaction.update({
        where: { id },
        data: {
          categoryId: categoryId || null,
        },
      });
    }

    return NextResponse.json({
      id: transaction.id,
      categoryId: categoryId || null,
      updatedCount,
    });
  } catch (error) {
    console.error("Update transaction error:", error);
    return NextResponse.json(
      { error: "Failed to update transaction" },
      { status: 500 }
    );
  }
}
