import { syncWiseData, type SyncResult as WiseSyncResult } from "../wise";
import { syncIndexaData, isIndexaConfigured, type IndexaSyncResult } from "../indexa";
import {
  isAlphaVantageConfigured,
  getAlphaVantageClient,
  syncFinancialAssetPrices,
  type FinancialAssetsSyncResult,
} from "../alphavantage";

/**
 * Sync mode
 */
export type SyncMode = "light" | "full";

/**
 * Unified sync result
 */
export interface UnifiedSyncResult {
  success: boolean;
  wise: WiseSyncResult | null;
  indexa: IndexaSyncResult | null;
  financialAssets: FinancialAssetsSyncResult | null;
  error?: string;
}

/**
 * Sync all data sources for a user
 *
 * @param userId - The user ID to sync data for
 * @param mode - "light" (incremental, from last sync) or "full" (complete history)
 */
export async function syncAllData(
  userId: string,
  mode: SyncMode = "light"
): Promise<UnifiedSyncResult> {
  let wiseResult: WiseSyncResult | null = null;
  let indexaResult: IndexaSyncResult | null = null;
  let financialAssetsResult: FinancialAssetsSyncResult | null = null;
  const errors: string[] = [];

  // Sync Wise data
  try {
    wiseResult = await syncWiseData(userId, mode);
    if (!wiseResult.success && wiseResult.error) {
      errors.push(`Wise: ${wiseResult.error}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    errors.push(`Wise: ${message}`);
    wiseResult = {
      success: false,
      profilesSynced: 0,
      transactionsAdded: 0,
      balancesUpdated: 0,
      error: message,
    };
  }

  // Sync Indexa data (if configured)
  if (isIndexaConfigured()) {
    try {
      indexaResult = await syncIndexaData(userId, mode);
      if (!indexaResult.success && indexaResult.error) {
        errors.push(`Indexa: ${indexaResult.error}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push(`Indexa: ${message}`);
      indexaResult = {
        success: false,
        accountsSynced: 0,
        snapshotsAdded: 0,
        error: message,
      };
    }
  }

  // Sync Financial Asset prices (if configured)
  // This is non-critical - errors don't fail the overall sync
  if (isAlphaVantageConfigured()) {
    try {
      const client = getAlphaVantageClient();
      financialAssetsResult = await syncFinancialAssetPrices(userId, client);

      // Only add to errors if nothing was updated and there were issues
      if (!financialAssetsResult.success && financialAssetsResult.updated === 0) {
        if (financialAssetsResult.errors?.length) {
          // Don't add individual errors to main error list, just note it failed
          errors.push(`Prices: sync failed`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      financialAssetsResult = {
        success: false,
        updated: 0,
        total: 0,
        errors: [message],
      };
    }
  }

  // Determine overall success (financial assets failures don't affect this)
  const wiseSuccess = wiseResult?.success ?? true;
  const indexaSuccess = indexaResult?.success ?? true;
  const success = wiseSuccess && indexaSuccess;

  return {
    success,
    wise: wiseResult,
    indexa: indexaResult,
    financialAssets: financialAssetsResult,
    error: errors.length > 0 ? errors.join("; ") : undefined,
  };
}

/**
 * Get sync summary for display
 */
export function formatSyncSummary(result: UnifiedSyncResult): string {
  const parts: string[] = [];

  if (result.wise) {
    parts.push(
      `Wise: ${result.wise.transactionsAdded} transactions, ${result.wise.balancesUpdated} balances`
    );
  }

  if (result.indexa) {
    parts.push(
      `Indexa: ${result.indexa.accountsSynced} accounts, ${result.indexa.snapshotsAdded} snapshots`
    );
  }

  if (result.financialAssets) {
    if (result.financialAssets.updated > 0) {
      parts.push(
        `Prices: ${result.financialAssets.updated}/${result.financialAssets.total} updated`
      );
    } else if (result.financialAssets.total > 0 && result.financialAssets.errors?.length) {
      parts.push(`Prices: sync failed`);
    }
  }

  if (parts.length === 0) {
    return "No data synced";
  }

  return parts.join(" | ");
}
