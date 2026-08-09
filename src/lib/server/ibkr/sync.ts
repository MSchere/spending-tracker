import { db } from "../db";
import { getIbkrClient, isIbkrConfigured, IbkrNotAuthenticatedError } from "./client";
import { Decimal } from "decimal.js";
import { startOfDay } from "date-fns";
import type { Currency, FinancialAssetType } from "@prisma/client";

export interface IbkrSyncResult {
  success: boolean;
  accountsSynced: number;
  positionsSynced: number;
  /** Positions skipped because their asset class is not supported (options, cash, ...) */
  skipped: number;
  error?: string;
}

const SUPPORTED_CURRENCIES: Currency[] = ["EUR", "USD", "GBP", "CHF", "JPY", "CAD", "AUD", "BRL"];

function toCurrency(code: string): Currency {
  const upper = code.toUpperCase() as Currency;
  return SUPPORTED_CURRENCIES.includes(upper) ? upper : "USD";
}

/**
 * Map an IBKR position to a FinancialAssetType, or null if the asset class
 * is not tracked (options, futures, cash balances, ...).
 */
function toAssetType(assetClass: string, instrumentType: string | null): FinancialAssetType | null {
  if (assetClass !== "STK") return null;
  return instrumentType === "ETF" ? "ETF" : "STOCK";
}

/**
 * Sync IBKR positions into FinancialAsset rows (source = IBKR).
 *
 * Positions are aggregated per (ticker, type) across all accounts, with
 * value-weighted average cost. Stale IBKR assets (closed positions) are
 * removed. Daily price history is recorded in FinancialAssetPrice.
 */
export async function syncIbkrData(userId: string): Promise<IbkrSyncResult> {
  if (!isIbkrConfigured()) {
    return { success: true, accountsSynced: 0, positionsSynced: 0, skipped: 0 };
  }

  const client = getIbkrClient();

  try {
    const accounts = await client.getAccounts();

    if (accounts.length === 0) {
      return { success: true, accountsSynced: 0, positionsSynced: 0, skipped: 0 };
    }

    // Aggregate positions across accounts, keyed by ticker|type
    const aggregated = new Map<
      string,
      {
        ticker: string;
        type: FinancialAssetType;
        name: string;
        conid: string;
        currency: Currency;
        totalShares: number;
        totalValue: number;
        totalCost: number;
      }
    >();
    let skipped = 0;

    for (const account of accounts) {
      const accountId = account.accountId ?? account.id;
      const positions = await client.getPositions(accountId);

      for (const position of positions) {
        if (position.shares <= 0) continue;

        const type = toAssetType(position.assetClass, position.instrumentType);
        if (!type) {
          skipped++;
          continue;
        }

        const key = `${position.ticker}|${type}`;
        const existing = aggregated.get(key);
        if (existing) {
          existing.totalShares += position.shares;
          existing.totalValue += position.value;
          existing.totalCost += position.shares * position.avgCost;
        } else {
          aggregated.set(key, {
            ticker: position.ticker,
            type,
            name: position.name,
            conid: position.conid,
            currency: toCurrency(position.currency),
            totalShares: position.shares,
            totalValue: position.value,
            totalCost: position.shares * position.avgCost,
          });
        }
      }
    }

    const now = new Date();
    const today = startOfDay(now);

    for (const [, position] of aggregated) {
      const price = position.totalValue / position.totalShares;
      const avgCostBasis = position.totalCost / position.totalShares;

      const asset = await db.financialAsset.upsert({
        where: {
          userId_source_ticker_type: {
            userId,
            source: "IBKR",
            ticker: position.ticker,
            type: position.type,
          },
        },
        create: {
          userId,
          ticker: position.ticker,
          name: position.name,
          type: position.type,
          source: "IBKR",
          externalId: position.conid,
          shares: new Decimal(position.totalShares),
          avgCostBasis: new Decimal(avgCostBasis),
          currency: position.currency,
          lastPrice: new Decimal(price),
          lastPriceAt: now,
        },
        update: {
          // Only overwrite metadata when we got a real name (the gateway
          // occasionally returns slim payloads without contract details).
          ...(position.name !== position.ticker ? { name: position.name } : {}),
          externalId: position.conid,
          shares: new Decimal(position.totalShares),
          avgCostBasis: new Decimal(avgCostBasis),
          currency: position.currency,
          lastPrice: new Decimal(price),
          lastPriceAt: now,
        },
      });

      await db.financialAssetPrice.upsert({
        where: { assetId_date: { assetId: asset.id, date: today } },
        create: { assetId: asset.id, date: today, price: new Decimal(price) },
        update: { price: new Decimal(price) },
      });
    }

    // Remove IBKR assets whose positions were closed (exact ticker+type match)
    const currentKeys = new Set([...aggregated.values()].map((p) => `${p.ticker}|${p.type}`));
    const existingIbkrAssets = await db.financialAsset.findMany({
      where: { userId, source: "IBKR" },
      select: { id: true, ticker: true, type: true },
    });
    const staleIds = existingIbkrAssets
      .filter((a) => !currentKeys.has(`${a.ticker}|${a.type}`))
      .map((a) => a.id);

    if (staleIds.length > 0) {
      await db.financialAsset.deleteMany({ where: { id: { in: staleIds } } });
    }

    return {
      success: true,
      accountsSynced: accounts.length,
      positionsSynced: aggregated.size,
      skipped,
    };
  } catch (error) {
    if (error instanceof IbkrNotAuthenticatedError) {
      return {
        success: false,
        accountsSynced: 0,
        positionsSynced: 0,
        skipped: 0,
        error: error.message,
      };
    }

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      accountsSynced: 0,
      positionsSynced: 0,
      skipped: 0,
      error: errorMessage,
    };
  }
}
