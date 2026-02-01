import { db as prisma } from "@/lib/server/db";
import type {
  FinancialAsset,
  FinancialAssetPrice,
  FinancialAssetType,
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
  symbol: string;
  name: string;
  type: FinancialAssetType;
  shares: number;
  avgCostBasis: number;
  currency: string;
  lastPrice: number | null;
  lastPriceAt: string | null; // ISO string for serialization
  createdAt: string;
  updatedAt: string;
  // Calculated fields
  currentValue: number;
  totalCost: number;
  gainLoss: number;
  gainLossPercent: number;
}

export interface FinancialAssetsTotals {
  totalValue: number;
  totalCost: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  assetCount: number;
}

export interface CreateFinancialAssetInput {
  userId: string;
  symbol: string;
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
}

export async function getFinancialAssets(userId: string): Promise<FinancialAssetSummary[]> {
  const assets = await prisma.financialAsset.findMany({
    where: { userId },
    orderBy: [{ type: "asc" }, { symbol: "asc" }],
  });

  return assets.map((asset) => {
    const shares = Number(asset.shares);
    const avgCostBasis = Number(asset.avgCostBasis);
    const lastPrice = asset.lastPrice ? Number(asset.lastPrice) : avgCostBasis;

    const currentValue = shares * lastPrice;
    const totalCost = shares * avgCostBasis;
    const gainLoss = currentValue - totalCost;
    const gainLossPercent = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0;

    // Return plain object with all Decimals converted to numbers
    // and Dates converted to ISO strings for serialization
    return {
      id: asset.id,
      userId: asset.userId,
      symbol: asset.symbol,
      name: asset.name,
      type: asset.type,
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
  });
}

/**
 * Get financial assets totals for a user
 */
export async function getFinancialAssetsTotals(userId: string): Promise<FinancialAssetsTotals> {
  const assets = await getFinancialAssets(userId);

  const totalValue = assets.reduce((sum, a) => sum + a.currentValue, 0);
  const totalCost = assets.reduce((sum, a) => sum + a.totalCost, 0);
  const totalGainLoss = totalValue - totalCost;
  const totalGainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

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
 * Get a financial asset by symbol and type
 */
export async function getFinancialAssetBySymbol(
  userId: string,
  symbol: string,
  type: FinancialAssetType
): Promise<FinancialAsset | null> {
  return prisma.financialAsset.findUnique({
    where: {
      userId_symbol_type: { userId, symbol: symbol.toUpperCase(), type },
    },
  });
}

export async function createFinancialAsset(
  input: CreateFinancialAssetInput
): Promise<FinancialAsset> {
  const { userId, symbol, name, type, shares, avgCostBasis, currency } = input;

  return prisma.financialAsset.create({
    data: {
      userId,
      symbol: symbol.toUpperCase(),
      name,
      type,
      shares: new Decimal(shares),
      avgCostBasis: new Decimal(avgCostBasis),
      currency: (currency as Currency) || "USD",
    },
  });
}

/**
 * Update an existing financial asset
 */
export async function updateFinancialAsset(
  id: string,
  userId: string,
  input: UpdateFinancialAssetInput
): Promise<FinancialAsset | null> {
  // Verify ownership
  const existing = await prisma.financialAsset.findFirst({
    where: { id, userId },
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

  return prisma.financialAsset.update({
    where: { id },
    data,
  });
}

/**
 * Delete a financial asset
 */
export async function deleteFinancialAsset(id: string, userId: string): Promise<boolean> {
  // Verify ownership
  const existing = await prisma.financialAsset.findFirst({
    where: { id, userId },
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

  // Build update data
  const updateData: { lastPrice: Decimal; lastPriceAt: Date; currency?: Currency } = {
    lastPrice: new Decimal(price),
    lastPriceAt: now,
  };

  // Update currency if provided
  if (currency) {
    updateData.currency = currency;
  }

  // Update the asset's lastPrice
  const asset = await prisma.financialAsset.update({
    where: { id },
    data: updateData,
  });

  // Also store in price history (upsert to avoid duplicates for today)
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
 * Sync prices for all user's financial assets from Alpha Vantage
 * This is the core sync function called by the unified sync orchestrator
 */
export async function syncFinancialAssetPrices(
  userId: string,
  client: {
    getStockQuote: (symbol: string) => Promise<{ price: number }>;
    getCryptoQuote: (symbol: string) => Promise<{ price: number }>;
  }
): Promise<FinancialAssetsSyncResult> {
  const assets = await prisma.financialAsset.findMany({
    where: { userId },
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

  // Process assets sequentially to respect rate limits
  for (const asset of assets) {
    try {
      let price: number;

      if (asset.type === "CRYPTO") {
        const quote = await client.getCryptoQuote(asset.symbol);
        price = quote.price;
      } else {
        // STOCK or ETF
        const quote = await client.getStockQuote(asset.symbol);
        price = quote.price;
      }

      await updateAssetPrice(asset.id, price);
      updated++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push(`${asset.symbol}: ${message}`);

      // If rate limited, stop processing
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
