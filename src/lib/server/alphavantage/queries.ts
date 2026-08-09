import { db as prisma } from "@/lib/server/db";
import type {
  FinancialAsset,
  FinancialAssetPrice,
  FinancialAssetType,
  AssetSource,
  Currency,
} from "@prisma/client";
import { Decimal } from "decimal.js";

export interface FinancialAssetWithPrices extends FinancialAsset {
  prices: FinancialAssetPrice[];
}

/**
 * Serializable financial asset summary for client components
 * All Decimal fields converted to numbers
 */
export interface FinancialAssetSummary {
  id: string;
  userId: string;
  ticker: string;
  isin: string | null;
  name: string;
  type: FinancialAssetType;
  source: AssetSource;
  externalId: string | null;
  shares: number;
  avgCostBasis: number | null; // null when unknown (e.g. Indexa funds)
  currency: string;
  lastPrice: number | null;
  lastPriceAt: string | null; // ISO string for serialization
  createdAt: string;
  updatedAt: string;
  // Calculated fields (null when cost basis is unknown)
  currentValue: number;
  totalCost: number | null;
  gainLoss: number | null;
  gainLossPercent: number | null;
}

export interface FinancialAssetsTotals {
  totalValue: number;
  totalCost: number | null; // null if any asset lacks a cost basis
  totalGainLoss: number | null;
  totalGainLossPercent: number | null;
  assetCount: number;
}

export interface CreateFinancialAssetInput {
  userId: string;
  ticker: string;
  isin?: string;
  name: string;
  type: FinancialAssetType;
  shares: number;
  avgCostBasis: number;
  currency?: string;
}

export interface UpdateFinancialAssetInput {
  shares?: number;
  avgCostBasis?: number;
  name?: string;
  isin?: string;
}

export function toFinancialAssetSummary(asset: FinancialAsset): FinancialAssetSummary {
  const shares = Number(asset.shares);
  const avgCostBasis = asset.avgCostBasis != null ? Number(asset.avgCostBasis) : null;
  const lastPrice = asset.lastPrice ? Number(asset.lastPrice) : avgCostBasis;

  const currentValue = lastPrice != null ? shares * lastPrice : 0;
  const totalCost = avgCostBasis != null ? shares * avgCostBasis : null;
  const gainLoss = totalCost != null ? currentValue - totalCost : null;
  const gainLossPercent =
    totalCost != null && totalCost > 0 ? ((currentValue - totalCost) / totalCost) * 100 : null;

  return {
    id: asset.id,
    userId: asset.userId,
    ticker: asset.ticker,
    isin: asset.isin,
    name: asset.name,
    type: asset.type,
    source: asset.source,
    externalId: asset.externalId,
    shares,
    avgCostBasis,
    currency: asset.currency,
    lastPrice: asset.lastPrice ? Number(asset.lastPrice) : null,
    lastPriceAt: asset.lastPriceAt?.toISOString() ?? null,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
    currentValue,
    totalCost,
    gainLoss,
    gainLossPercent,
  };
}

export async function getFinancialAssets(
  userId: string,
  options: { source?: AssetSource } = {}
): Promise<FinancialAssetSummary[]> {
  const assets = await prisma.financialAsset.findMany({
    where: { userId, ...(options.source ? { source: options.source } : {}) },
    orderBy: [{ type: "asc" }, { ticker: "asc" }],
  });

  return assets.map(toFinancialAssetSummary);
}

/**
 * Get financial assets totals for a user.
 * Cost/gain-loss are null when at least one held asset lacks a cost basis.
 */
export async function getFinancialAssetsTotals(userId: string): Promise<FinancialAssetsTotals> {
  const assets = await getFinancialAssets(userId);

  const totalValue = assets.reduce((sum, a) => sum + a.currentValue, 0);
  const hasFullCostBasis = assets.every((a) => a.totalCost != null);
  const totalCost = hasFullCostBasis
    ? assets.reduce((sum, a) => sum + (a.totalCost ?? 0), 0)
    : null;
  const totalGainLoss = totalCost != null ? totalValue - totalCost : null;
  const totalGainLossPercent =
    totalCost != null && totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : null;

  return {
    totalValue,
    totalCost,
    totalGainLoss,
    totalGainLossPercent,
    assetCount: assets.length,
  };
}

/**
 * Get a single financial asset by ID
 */
export async function getFinancialAssetById(
  id: string,
  userId: string
): Promise<FinancialAssetWithPrices | null> {
  return prisma.financialAsset.findFirst({
    where: { id, userId },
    include: {
      prices: {
        orderBy: { date: "desc" },
        take: 100, // Last 100 price points
      },
    },
  });
}

/**
 * Get a financial asset by ticker, type and source
 */
export async function getFinancialAssetByTicker(
  userId: string,
  ticker: string,
  type: FinancialAssetType,
  source: AssetSource = "MANUAL"
): Promise<FinancialAsset | null> {
  return prisma.financialAsset.findUnique({
    where: {
      userId_source_ticker_type: {
        userId,
        source,
        ticker: ticker.toUpperCase(),
        type,
      },
    },
  });
}

export async function createFinancialAsset(
  input: CreateFinancialAssetInput
): Promise<FinancialAsset> {
  const { userId, ticker, isin, name, type, shares, avgCostBasis, currency } = input;

  return prisma.financialAsset.create({
    data: {
      userId,
      ticker: ticker.toUpperCase(),
      isin: isin?.toUpperCase() || null,
      name,
      type,
      source: "MANUAL",
      shares: new Decimal(shares),
      avgCostBasis: new Decimal(avgCostBasis),
      currency: (currency as Currency) || "USD",
    },
  });
}

/**
 * Update an existing financial asset.
 * Only manual assets are editable; synced (INDEXA/IBKR) assets are managed by their syncs.
 */
export async function updateFinancialAsset(
  id: string,
  userId: string,
  input: UpdateFinancialAssetInput
): Promise<FinancialAsset | null> {
  const existing = await prisma.financialAsset.findFirst({
    where: { id, userId, source: "MANUAL" },
  });

  if (!existing) {
    return null;
  }

  const data: Record<string, unknown> = {};
  if (input.shares !== undefined) {
    data.shares = new Decimal(input.shares);
  }
  if (input.avgCostBasis !== undefined) {
    data.avgCostBasis = new Decimal(input.avgCostBasis);
  }
  if (input.name !== undefined) {
    data.name = input.name;
  }
  if (input.isin !== undefined) {
    data.isin = input.isin ? input.isin.toUpperCase() : null;
  }

  return prisma.financialAsset.update({
    where: { id },
    data,
  });
}

/**
 * Delete a financial asset. Only manual assets can be deleted;
 * synced assets disappear when the position closes at the source.
 */
export async function deleteFinancialAsset(id: string, userId: string): Promise<boolean> {
  const existing = await prisma.financialAsset.findFirst({
    where: { id, userId, source: "MANUAL" },
  });

  if (!existing) {
    return false;
  }

  await prisma.financialAsset.delete({
    where: { id },
  });

  return true;
}

export async function updateAssetPrice(
  id: string,
  price: number,
  currency?: Currency
): Promise<FinancialAsset> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const updateData: { lastPrice: Decimal; lastPriceAt: Date; currency?: Currency } = {
    lastPrice: new Decimal(price),
    lastPriceAt: now,
  };

  if (currency) {
    updateData.currency = currency;
  }

  const asset = await prisma.financialAsset.update({
    where: { id },
    data: updateData,
  });

  await prisma.financialAssetPrice.upsert({
    where: {
      assetId_date: { assetId: id, date: today },
    },
    create: {
      assetId: id,
      date: today,
      price: new Decimal(price),
    },
    update: {
      price: new Decimal(price),
    },
  });

  return asset;
}

export interface FinancialAssetsSyncResult {
  success: boolean;
  updated: number;
  total: number;
  errors?: string[];
}

/**
 * Sync prices for all user's MANUAL financial assets from Alpha Vantage.
 * Synced assets (INDEXA/IBKR) get their prices from their own integrations.
 * This is the core sync function called by the unified sync orchestrator.
 */
export async function syncFinancialAssetPrices(
  userId: string,
  client: {
    getStockQuote: (symbol: string, currency: Currency) => Promise<{ price: number }>;
    getCryptoQuote: (symbol: string, currency: Currency) => Promise<{ price: number }>;
  }
): Promise<FinancialAssetsSyncResult> {
  const assets = await prisma.financialAsset.findMany({
    where: { userId, source: "MANUAL" },
  });

  if (assets.length === 0) {
    return {
      success: true,
      updated: 0,
      total: 0,
    };
  }

  let updated = 0;
  const errors: string[] = [];

  for (const asset of assets) {
    try {
      let price: number;

      if (asset.type === "CRYPTO") {
        const quote = await client.getCryptoQuote(asset.ticker, asset.currency);
        price = quote.price;
      } else {
        const quote = await client.getStockQuote(asset.ticker, asset.currency);
        price = quote.price;
      }

      await updateAssetPrice(asset.id, price);
      updated++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push(`${asset.ticker}: ${message}`);

      if (message.includes("Rate limit") || message.includes("rate limit")) {
        errors.push("Rate limit reached - remaining assets skipped");
        break;
      }
    }
  }

  return {
    success: errors.length === 0 || updated > 0,
    updated,
    total: assets.length,
    errors: errors.length > 0 ? errors : undefined,
  };
}
