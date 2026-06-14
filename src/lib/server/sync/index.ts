import { syncWiseData, type SyncResult as WiseSyncResult } from "../wise";
import { syncIndexaData, isIndexaConfigured, type IndexaSyncResult } from "../indexa";
import {
  isAlphaVantageConfigured,
  getAlphaVantageClient,
  syncFinancialAssetPrices,
  type FinancialAssetsSyncResult,
} from "../alphavantage";
import { db } from "../db";
import { addWeeks, addMonths, addQuarters, addYears, isBefore, startOfDay } from "date-fns";

/**
 * Advance the nextDueDate of past-due recurring expenses to the next future occurrence.
 * Called automatically during every sync.
 */
export async function advanceRecurringDueDates(): Promise<number> {
  const today = startOfDay(new Date());

  const overdueItems = await db.recurringExpense.findMany({
    where: { isActive: true, nextDueDate: { lt: today } },
  });

  if (overdueItems.length === 0) return 0;

  let advanced = 0;

  for (const item of overdueItems) {
    let next = new Date(item.nextDueDate);

    while (isBefore(next, today)) {
      switch (item.frequency) {
        case "WEEKLY":    next = addWeeks(next, 1);   break;
        case "BIWEEKLY":  next = addWeeks(next, 2);   break;
        case "MONTHLY":   next = addMonths(next, 1);  break;
        case "BIMONTHLY": next = addMonths(next, 2);  break;
        case "QUARTERLY": next = addQuarters(next, 1); break;
        case "YEARLY":    next = addYears(next, 1);   break;
        default:          next = addMonths(next, 1);
      }
    }

    await db.recurringExpense.update({ where: { id: item.id }, data: { nextDueDate: next } });
    advanced++;
  }

  return advanced;
}

export type SyncMode = "light" | "full";

export interface UnifiedSyncResult {
  success: boolean;
  wise: WiseSyncResult | null;
  indexa: IndexaSyncResult | null;
  financialAssets: FinancialAssetsSyncResult | null;
  error?: string;
}

export async function syncAllData(
  userId: string,
  mode: SyncMode = "light"
): Promise<UnifiedSyncResult> {
  let wiseResult: WiseSyncResult | null = null;
  let indexaResult: IndexaSyncResult | null = null;
  let financialAssetsResult: FinancialAssetsSyncResult | null = null;
  const errors: string[] = [];

  try {
    await advanceRecurringDueDates();
  } catch (error) {
    console.warn("Failed to advance recurring due dates:", error);
  }

  try {
    wiseResult = await syncWiseData(userId, mode);
    if (!wiseResult.success && wiseResult.error) errors.push(`Wise: ${wiseResult.error}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    errors.push(`Wise: ${message}`);
    wiseResult = { success: false, profilesSynced: 0, transactionsAdded: 0, balancesUpdated: 0, error: message };
  }

  if (isIndexaConfigured()) {
    try {
      indexaResult = await syncIndexaData(userId, mode);
      if (!indexaResult.success && indexaResult.error) errors.push(`Indexa: ${indexaResult.error}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push(`Indexa: ${message}`);
      indexaResult = { success: false, accountsSynced: 0, snapshotsAdded: 0, error: message };
    }
  }

  if (isAlphaVantageConfigured()) {
    try {
      const client = getAlphaVantageClient();
      financialAssetsResult = await syncFinancialAssetPrices(userId, client);
      if (!financialAssetsResult.success && financialAssetsResult.updated === 0) {
        if (financialAssetsResult.errors?.length) errors.push(`Prices: sync failed`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      financialAssetsResult = { success: false, updated: 0, total: 0, errors: [message] };
    }
  }

  const success = (wiseResult?.success ?? true) && (indexaResult?.success ?? true);

  return {
    success,
    wise: wiseResult,
    indexa: indexaResult,
    financialAssets: financialAssetsResult,
    error: errors.length > 0 ? errors.join("; ") : undefined,
  };
}

export function formatSyncSummary(result: UnifiedSyncResult): string {
  const parts: string[] = [];

  if (result.wise) {
    parts.push(`Wise: ${result.wise.transactionsAdded} transactions, ${result.wise.balancesUpdated} balances`);
  }
  if (result.indexa) {
    parts.push(`Indexa: ${result.indexa.accountsSynced} accounts, ${result.indexa.snapshotsAdded} snapshots`);
  }
  if (result.financialAssets) {
    if (result.financialAssets.updated > 0) {
      parts.push(`Prices: ${result.financialAssets.updated}/${result.financialAssets.total} updated`);
    } else if (result.financialAssets.total > 0 && result.financialAssets.errors?.length) {
      parts.push(`Prices: sync failed`);
    }
  }

  return parts.length === 0 ? "No data synced" : parts.join(" | ");
}
