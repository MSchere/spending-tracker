import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/server/auth";
import {
  getTangibleAssets,
  getTangibleAssetsTotals,
  createTangibleAsset,
  CATEGORY_DEFAULTS,
} from "@/lib/server/assets";
import { TangibleAssetCategory, DepreciationMethod } from "@prisma/client";

/**
 * GET /api/assets - Get all tangible assets for the user
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [assets, totals] = await Promise.all([
      getTangibleAssets(session.user.id),
      getTangibleAssetsTotals(session.user.id),
    ]);

    return NextResponse.json({ assets, totals });
  } catch (error) {
    console.error("Get tangible assets error:", error);
    return NextResponse.json({ error: "Failed to get tangible assets" }, { status: 500 });
  }
}

/**
 * POST /api/assets - Create a new tangible asset
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      description,
      category,
      purchaseDate,
      purchasePrice,
      currency,
      depreciationMethod,
      usefulLifeYears,
      salvageValue,
    } = body;

    // Validate required fields
    if (!name || !category || !purchaseDate || purchasePrice === undefined) {
      return NextResponse.json(
        { error: "name, category, purchaseDate, and purchasePrice are required" },
        { status: 400 }
      );
    }

    // Validate category
    if (!Object.keys(CATEGORY_DEFAULTS).includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${Object.keys(CATEGORY_DEFAULTS).join(", ")}` },
        { status: 400 }
      );
    }

    // Validate depreciation method if provided
    const validMethods: DepreciationMethod[] = [
      "STRAIGHT_LINE",
      "DECLINING_BALANCE",
      "NONE",
      "MANUAL",
    ];
    if (depreciationMethod && !validMethods.includes(depreciationMethod)) {
      return NextResponse.json(
        { error: `Invalid depreciation method. Must be one of: ${validMethods.join(", ")}` },
        { status: 400 }
      );
    }

    const asset = await createTangibleAsset(session.user.id, {
      name,
      description,
      category: category as TangibleAssetCategory,
      purchaseDate: new Date(purchaseDate),
      purchasePrice: Number(purchasePrice),
      currency,
      depreciationMethod: depreciationMethod as DepreciationMethod | undefined,
      usefulLifeYears: usefulLifeYears !== undefined ? Number(usefulLifeYears) : undefined,
      salvageValue: salvageValue !== undefined ? Number(salvageValue) : undefined,
    });

    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    console.error("Create tangible asset error:", error);
    return NextResponse.json({ error: "Failed to create tangible asset" }, { status: 500 });
  }
}
