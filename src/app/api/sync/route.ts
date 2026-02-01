import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/server/auth";
import { getLastSyncInfo } from "@/lib/server/wise";
import { syncAllData, formatSyncSummary, type SyncMode } from "@/lib/server/sync";
import { isIndexaConfigured } from "@/lib/server/indexa";
import { isAlphaVantageConfigured } from "@/lib/server/alphavantage";

/**
 * POST /api/sync - Trigger a manual sync with all data sources
 *
 * Query params:
 * - mode: "light" (default) or "full"
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if at least one data source is configured
    const wiseConfigured = !!process.env.WISE_API_TOKEN;
    const indexaConfigured = isIndexaConfigured();
    const alphaVantageConfigured = isAlphaVantageConfigured();

    if (!wiseConfigured && !indexaConfigured && !alphaVantageConfigured) {
      return NextResponse.json({ error: "No data sources configured" }, { status: 500 });
    }

    // Get sync mode from query params
    const searchParams = request.nextUrl.searchParams;
    const mode = (searchParams.get("mode") as SyncMode) || "light";

    // Validate mode
    if (mode !== "light" && mode !== "full") {
      return NextResponse.json({ error: "Invalid mode. Use 'light' or 'full'" }, { status: 400 });
    }

    // Perform unified sync
    const result = await syncAllData(session.user.id, mode);

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || "Sync failed",
          wise: result.wise,
          indexa: result.indexa,
          financialAssets: result.financialAssets,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Sync completed successfully",
      summary: formatSyncSummary(result),
      mode,
      wise: result.wise
        ? {
            profilesSynced: result.wise.profilesSynced,
            transactionsAdded: result.wise.transactionsAdded,
            balancesUpdated: result.wise.balancesUpdated,
          }
        : null,
      indexa: result.indexa
        ? {
            accountsSynced: result.indexa.accountsSynced,
            snapshotsAdded: result.indexa.snapshotsAdded,
          }
        : null,
      financialAssets: result.financialAssets
        ? {
            updated: result.financialAssets.updated,
            total: result.financialAssets.total,
            errors: result.financialAssets.errors,
          }
        : null,
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
      indexaConfigured: isIndexaConfigured(),
      alphaVantageConfigured: isAlphaVantageConfigured(),
    });
  } catch (error) {
    console.error("Get sync status error:", error);
    return NextResponse.json({ error: "Failed to get sync status" }, { status: 500 });
  }
}
