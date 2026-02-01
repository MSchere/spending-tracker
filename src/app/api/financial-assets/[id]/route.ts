import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/server/auth";
import {
  getFinancialAssetById,
  updateFinancialAsset,
  deleteFinancialAsset,
} from "@/lib/server/alphavantage";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/financial-assets/[id] - Get a single financial asset
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const asset = await getFinancialAssetById(id, session.user.id);

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    return NextResponse.json(asset);
  } catch (error) {
    console.error("Get financial asset error:", error);
    return NextResponse.json({ error: "Failed to get financial asset" }, { status: 500 });
  }
}

/**
 * PUT /api/financial-assets/[id] - Update a financial asset
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { shares, avgCostBasis, name } = body;

    // At least one field must be provided
    if (shares === undefined && avgCostBasis === undefined && name === undefined) {
      return NextResponse.json(
        { error: "At least one of shares, avgCostBasis, or name is required" },
        { status: 400 }
      );
    }

    const asset = await updateFinancialAsset(id, session.user.id, {
      shares: shares !== undefined ? Number(shares) : undefined,
      avgCostBasis: avgCostBasis !== undefined ? Number(avgCostBasis) : undefined,
      name,
    });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    return NextResponse.json(asset);
  } catch (error) {
    console.error("Update financial asset error:", error);
    return NextResponse.json({ error: "Failed to update financial asset" }, { status: 500 });
  }
}

/**
 * DELETE /api/financial-assets/[id] - Delete a financial asset
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const deleted = await deleteFinancialAsset(id, session.user.id);

    if (!deleted) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete financial asset error:", error);
    return NextResponse.json({ error: "Failed to delete financial asset" }, { status: 500 });
  }
}
