import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/server/auth";
import { addAssetValuation } from "@/lib/server/assets";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/assets/[id]/valuations - Add a manual valuation to an asset
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { date, value, note } = body;

    if (!date || value === undefined) {
      return NextResponse.json({ error: "date and value are required" }, { status: 400 });
    }

    const valuation = await addAssetValuation(id, session.user.id, {
      date: new Date(date),
      value: Number(value),
      note,
    });

    if (!valuation) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        id: valuation.id,
        date: valuation.date.toISOString(),
        value: valuation.value.toNumber(),
        note: valuation.note,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Add valuation error:", error);
    return NextResponse.json({ error: "Failed to add valuation" }, { status: 500 });
  }
}
