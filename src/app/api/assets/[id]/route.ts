import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/server/auth";
import {
  getTangibleAssetById,
  updateTangibleAsset,
  deleteTangibleAsset,
  generateDepreciationSchedule,
} from "@/lib/server/assets";
import { TangibleAssetCategory, DepreciationMethod } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/assets/[id] - Get a single tangible asset with depreciation schedule
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const asset = await getTangibleAssetById(id, session.user.id);

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Generate depreciation schedule for charting
    const depreciationSchedule = generateDepreciationSchedule({
      purchaseDate: asset.purchaseDate,
      purchasePrice: asset.purchasePrice,
      depreciationMethod: asset.depreciationMethod,
      usefulLifeYears: asset.usefulLifeYears,
      salvageValue: asset.salvageValue,
    });

    return NextResponse.json({
      asset: {
        ...asset,
        purchaseDate: asset.purchaseDate.toISOString(),
        purchasePrice: asset.purchasePrice.toNumber(),
        salvageValue: asset.salvageValue?.toNumber() ?? null,
        valuations: asset.valuations.map((v) => ({
          id: v.id,
          date: v.date.toISOString(),
          value: v.value.toNumber(),
          note: v.note,
        })),
      },
      depreciationSchedule: depreciationSchedule.map((point) => ({
        date: point.date.toISOString(),
        value: point.value,
      })),
    });
  } catch (error) {
    console.error("Get tangible asset error:", error);
    return NextResponse.json({ error: "Failed to get tangible asset" }, { status: 500 });
  }
}

/**
 * PUT /api/assets/[id] - Update a tangible asset
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
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

    const asset = await updateTangibleAsset(id, session.user.id, {
      name,
      description,
      category: category as TangibleAssetCategory | undefined,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
      purchasePrice: purchasePrice !== undefined ? Number(purchasePrice) : undefined,
      currency,
      depreciationMethod: depreciationMethod as DepreciationMethod | undefined,
      usefulLifeYears: usefulLifeYears !== undefined ? Number(usefulLifeYears) : undefined,
      salvageValue: salvageValue !== undefined ? Number(salvageValue) : undefined,
    });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    return NextResponse.json(asset);
  } catch (error) {
    console.error("Update tangible asset error:", error);
    return NextResponse.json({ error: "Failed to update tangible asset" }, { status: 500 });
  }
}

/**
 * DELETE /api/assets/[id] - Delete a tangible asset
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const deleted = await deleteTangibleAsset(id, session.user.id);

    if (!deleted) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete tangible asset error:", error);
    return NextResponse.json({ error: "Failed to delete tangible asset" }, { status: 500 });
  }
}
