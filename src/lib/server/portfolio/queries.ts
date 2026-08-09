import { db } from "../db";
import { subDays, startOfDay } from "date-fns";
import type { AssetSource } from "@prisma/client";
import { getFinancialAssets, type FinancialAssetSummary } from "../alphavantage";

/**
 * Unified portfolio queries — power the fused /financial-assets page.
 *
 * All positions (manual stocks/crypto, Indexa funds, IBKR positions) live in
 * the FinancialAsset table. Indexa account-level history comes from
 * IndexaPortfolioSnapshot; everything else builds history from daily
 * FinancialAssetPrice rows (accumulated from the first sync onwards).
 */

export interface SourceBreakdown {
  source: AssetSource;
  totalValue: number;
  assetCount: number;
  weight: number;
}

export interface PortfolioOverview {
  assets: FinancialAssetSummary[];
  totalValue: number;
  /** Total cost basis; null if any source lacks one entirely */
  totalCost: number | null;
  totalGainLoss: number | null;
  totalGainLossPercent: number | null;
  bySource: SourceBreakdown[];
}

export interface PortfolioHistoryPoint {
  date: string; // ISO
  totalValue: number;
  totalInvested: number | null; // null when cost basis is incomplete
}

/**
 * Latest cached exchange rates (no API calls), keyed by "FROM:TO".
 */
async function getCachedRates(): Promise<Map<string, number>> {
  const rates = await db.exchangeRate.findMany({
    orderBy: { date: "desc" },
  });

  const map = new Map<string, number>();
  for (const rate of rates) {
    const key = `${rate.fromCurrency}:${rate.toCurrency}`;
    if (!map.has(key)) {
      map.set(key, rate.rate.toNumber());
    }
  }
  return map;
}

function convert(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Map<string, number>
): number {
  if (fromCurrency === toCurrency) return amount;
  const rate = rates.get(`${fromCurrency}:${toCurrency}`);
  // Fall back to 1:1 when no cached rate exists (better than dropping the asset)
  return rate ? amount * rate : amount;
}

/**
 * Latest Indexa account snapshots (totalValue + invested) per account.
 * Indexa does not expose per-instrument cost, but the account-level invested
 * amount serves as the cost basis for all INDEXA-sourced assets combined.
 *
 * Invested prefers netContributions (net deposits — what Indexa itself uses
 * to compute returns) over the snapshot's totalInvested (acquisition cost of
 * current holdings, which drifts after internal fund rebalances).
 */
async function getLatestIndexaSnapshots(
  userId: string
): Promise<Array<{ totalValue: number; totalInvested: number }>> {
  const accounts = await db.indexaAccount.findMany({
    where: { userId, status: "active" },
    include: {
      snapshots: {
        where: { totalValue: { gt: 0 } },
        orderBy: { date: "desc" },
        take: 1,
      },
    },
  });

  return accounts
    .filter((a) => a.snapshots.length > 0)
    .map((a) => ({
      totalValue: a.snapshots[0].totalValue.toNumber(),
      totalInvested: a.netContributions?.toNumber() ?? a.snapshots[0].totalInvested.toNumber(),
    }));
}

/**
 * Full portfolio overview: all assets with values converted to the user's
 * preferred currency, plus per-source breakdown.
 *
 * Cost basis: per-asset for MANUAL/IBKR; account-level totalInvested for
 * INDEXA (the Indexa API does not expose per-instrument cost).
 */
export async function getPortfolioOverview(userId: string): Promise<PortfolioOverview> {
  const preferences = await db.userPreferences.findUnique({
    where: { userId },
    select: { currency: true },
  });
  const targetCurrency = preferences?.currency ?? "EUR";

  const [assets, rates, indexaSnapshots] = await Promise.all([
    getFinancialAssets(userId),
    getCachedRates(),
    getLatestIndexaSnapshots(userId),
  ]);

  // Convert asset values to the preferred currency
  const converted = assets.map((asset) => ({
    ...asset,
    currentValue: convert(asset.currentValue, asset.currency, targetCurrency, rates),
    totalCost:
      asset.totalCost != null
        ? convert(asset.totalCost, asset.currency, targetCurrency, rates)
        : null,
  }));

  const totalValue = converted.reduce((sum, a) => sum + a.currentValue, 0);

  // Cost basis: known per-asset for MANUAL/IBKR. For INDEXA, use the
  // account-level invested amount from the latest snapshot (covers all
  // Indexa holdings, so per-asset nulls are expected there).
  const hasIndexaAssets = converted.some((a) => a.source === "INDEXA");
  const indexaInvested = indexaSnapshots.reduce((sum, s) => sum + s.totalInvested, 0);
  const indexaCostCovered = !hasIndexaAssets || indexaSnapshots.length > 0;

  const otherAssetsCostKnown = converted
    .filter((a) => a.source !== "INDEXA")
    .every((a) => a.totalCost != null);

  const totalCost =
    indexaCostCovered && otherAssetsCostKnown
      ? converted
          .filter((a) => a.source !== "INDEXA")
          .reduce((sum, a) => sum + (a.totalCost ?? 0), 0) + indexaInvested
      : null;

  const totalGainLoss = totalCost != null ? totalValue - totalCost : null;
  const totalGainLossPercent =
    totalCost != null && totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : null;

  const sourceMap = new Map<AssetSource, { totalValue: number; assetCount: number }>();
  for (const asset of converted) {
    const entry = sourceMap.get(asset.source) ?? { totalValue: 0, assetCount: 0 };
    entry.totalValue += asset.currentValue;
    entry.assetCount++;
    sourceMap.set(asset.source, entry);
  }

  const bySource: SourceBreakdown[] = Array.from(sourceMap.entries())
    .map(([source, data]) => ({
      source,
      ...data,
      weight: totalValue > 0 ? (data.totalValue / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.totalValue - a.totalValue);

  return {
    assets: converted,
    totalValue,
    totalCost,
    totalGainLoss,
    totalGainLossPercent,
    bySource,
  };
}

/**
 * Combined portfolio history across all sources.
 *
 * - Indexa: account-level snapshots (exact), carried forward so dates after
 *   the last NAV update (weekends, holidays) still include the Indexa value.
 * - Manual + IBKR: per-asset daily prices × current shares; prices are
 *   carried forward after the first observation to fill non-trading days.
 */
export async function getCombinedPortfolioHistory(
  userId: string,
  days: number = 365
): Promise<PortfolioHistoryPoint[]> {
  const startDate = startOfDay(subDays(new Date(), days));
  const today = new Date();

  // --- Indexa snapshots, deduplicated per account per date ---
  const indexaAccounts = await db.indexaAccount.findMany({
    where: { userId, status: "active" },
    select: { id: true },
  });
  const indexaAccountIds = indexaAccounts.map((a) => a.id);

  const indexaSnapshots =
    indexaAccountIds.length > 0
      ? await db.indexaPortfolioSnapshot.findMany({
          where: {
            accountId: { in: indexaAccountIds },
            date: { gte: startDate, lte: today },
            totalValue: { gt: 0 },
          },
          orderBy: { date: "asc" },
        })
      : [];

  // Per-account sorted arrays of [dateKey, totalValue, totalInvested]
  const perAccount = new Map<string, Array<{ dateKey: string; value: number; invested: number }>>();
  for (const snapshot of indexaSnapshots) {
    const dateKey = snapshot.date.toISOString().split("T")[0];
    const list = perAccount.get(snapshot.accountId) ?? [];
    const last = list[list.length - 1];
    if (last && last.dateKey === dateKey) {
      last.value = snapshot.totalValue.toNumber();
      last.invested = snapshot.totalInvested.toNumber();
    } else {
      list.push({
        dateKey,
        value: snapshot.totalValue.toNumber(),
        invested: snapshot.totalInvested.toNumber(),
      });
    }
    perAccount.set(snapshot.accountId, list);
  }

  // --- Non-Indexa assets with their price history ---
  const otherAssets = await db.financialAsset.findMany({
    where: { userId, source: { in: ["MANUAL", "IBKR"] } },
    include: {
      prices: {
        where: { date: { gte: startDate, lte: today } },
        orderBy: { date: "asc" },
      },
    },
  });

  // --- Merge every observed date ---
  const dateKeys = new Set<string>();
  for (const list of perAccount.values()) for (const p of list) dateKeys.add(p.dateKey);
  for (const asset of otherAssets)
    for (const p of asset.prices) dateKeys.add(p.date.toISOString().split("T")[0]);

  const sortedDates = Array.from(dateKeys).sort();

  // Walking pointers per account / asset for last-value-carried-forward
  const accountPointers = new Map<string, number>();
  const assetPointers = new Map<string, number>();
  const assetLastPrice = new Map<string, number>();
  const accountLast = new Map<string, { value: number; invested: number }>();

  const points: PortfolioHistoryPoint[] = [];

  for (const dateKey of sortedDates) {
    let totalValue = 0;
    let totalInvested = 0;
    let investedKnown = true;

    // Indexa: advance pointers, carry forward last known values
    for (const [accountId, list] of perAccount) {
      let pointer = accountPointers.get(accountId) ?? 0;
      while (pointer < list.length && list[pointer].dateKey <= dateKey) {
        accountLast.set(accountId, {
          value: list[pointer].value,
          invested: list[pointer].invested,
        });
        pointer++;
      }
      accountPointers.set(accountId, pointer);

      const last = accountLast.get(accountId);
      if (last) {
        totalValue += last.value;
        totalInvested += last.invested;
      }
    }

    // Other assets: price on/before this date × current shares
    for (const asset of otherAssets) {
      const prices = asset.prices;
      let pointer = assetPointers.get(asset.id) ?? 0;
      while (
        pointer < prices.length &&
        prices[pointer].date.toISOString().split("T")[0] <= dateKey
      ) {
        assetLastPrice.set(asset.id, prices[pointer].price.toNumber());
        pointer++;
      }
      assetPointers.set(asset.id, pointer);

      const lastPrice = assetLastPrice.get(asset.id);
      if (lastPrice == null) continue; // no observation yet — no history to invent

      const shares = asset.shares.toNumber();
      totalValue += shares * lastPrice;

      const costBasis = asset.avgCostBasis?.toNumber() ?? null;
      if (costBasis != null) {
        totalInvested += shares * costBasis;
      } else {
        investedKnown = false;
      }
    }

    points.push({
      date: new Date(dateKey).toISOString(),
      totalValue,
      totalInvested: investedKnown ? totalInvested : null,
    });
  }

  return points;
}
