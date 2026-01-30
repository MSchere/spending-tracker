import { NextResponse } from "next/server";
import { auth } from "@/lib/server/auth";
import { syncWiseData, getLastSyncInfo } from "@/lib/server/wise";

/**
 * POST /api/sync - Trigger a manual sync with Wise
 */
export async function POST() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if Wise API token is configured
    if (!process.env.WISE_API_TOKEN) {
      return NextResponse.json(
        { error: "Wise API token not configured" },
        { status: 500 }
      );
    }

    // Perform sync
    const result = await syncWiseData(session.user.id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Sync failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Sync completed successfully",
      profilesSynced: result.profilesSynced,
      transactionsAdded: result.transactionsAdded,
      balancesUpdated: result.balancesUpdated,
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sync - Get last sync status
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const syncInfo = await getLastSyncInfo();

    return NextResponse.json({
      lastSyncAt: syncInfo.lastSyncAt?.toISOString() || null,
      lastSyncStatus: syncInfo.lastSyncStatus,
      wiseConfigured: !!process.env.WISE_API_TOKEN,
    });
  } catch (error) {
    console.error("Get sync status error:", error);
    return NextResponse.json(
      { error: "Failed to get sync status" },
      { status: 500 }
    );
  }
}
