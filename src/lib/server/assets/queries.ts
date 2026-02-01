import { db } from "@/lib/server/db";
import {
  TangibleAssetCategory,
  DepreciationMethod,
  TangibleAsset,
  TangibleAssetValuation,
  Currency,
} from "@prisma/client";
import {
  calculateDepreciation,
  calculateDefaultSalvageValue,
  CATEGORY_DEFAULTS,
} from "./depreciation";

export type TangibleAssetWithValuations = TangibleAsset & {
  valuations: TangibleAssetValuation[];
};

export interface TangibleAssetSummary {
  id: string;
  name: string;
  description: string | null;
  category: TangibleAssetCategory;
  purchaseDate: string; // ISO string for client
  purchasePrice: number;
  currentValue: number;
  currency: string;
  depreciationMethod: DepreciationMethod;
  usefulLifeYears: number | null;
  salvageValue: number | null;
  depreciation: number;
  depreciationPercent: number;
  yearsOwned: number;
  remainingLifeYears: number | null;
  lastValuation: {
    date: string;
    value: number;
    note: string | null;
  } | null;
}

export interface TangibleAssetsTotals {
  totalCurrentValue: number;
  totalPurchasePrice: number;
  totalDepreciation: number;
  depreciationPercent: number;
  assetCount: number;
}

/**
 * Get all tangible assets for a user with calculated current values.
 */
export async function getTangibleAssets(userId: string): Promise<TangibleAssetSummary[]> {
  const assets = await db.tangibleAsset.findMany({
    where: { userId },
    include: {
      valuations: {
        orderBy: { date: "desc" },
        take: 1, // Only need the latest valuation
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return assets.map((asset) => {
    const lastValuation = asset.valuations[0] ?? null;

    // For MANUAL method, use last valuation if available
    let currentValue: number;
    let depreciation: number;
    let depreciationPercent: number;
    let yearsOwned: number;
    let remainingLifeYears: number | null;

    if (asset.depreciationMethod === "MANUAL" && lastValuation) {
      const purchasePrice = asset.purchasePrice.toNumber();
      currentValue = lastValuation.value.toNumber();
      depreciation = purchasePrice - currentValue;
      depreciationPercent = purchasePrice > 0 ? (depreciation / purchasePrice) * 100 : 0;

      const daysOwned = Math.max(
        0,
        (new Date().getTime() - asset.purchaseDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      yearsOwned = daysOwned / 365.25;
      remainingLifeYears = null;
    } else {
      const result = calculateDepreciation({
        purchaseDate: asset.purchaseDate,
        purchasePrice: asset.purchasePrice,
        depreciationMethod: asset.depreciationMethod,
        usefulLifeYears: asset.usefulLifeYears,
        salvageValue: asset.salvageValue,
      });

      currentValue = result.currentValue;
      depreciation = result.totalDepreciation;
      depreciationPercent = result.depreciationPercent;
      yearsOwned = result.yearsOwned;
      remainingLifeYears = result.remainingLifeYears;
    }

    return {
      id: asset.id,
      name: asset.name,
      description: asset.description,
      category: asset.category,
      purchaseDate: asset.purchaseDate.toISOString(),
      purchasePrice: asset.purchasePrice.toNumber(),
      currentValue,
      currency: asset.currency,
      depreciationMethod: asset.depreciationMethod,
      usefulLifeYears: asset.usefulLifeYears,
      salvageValue: asset.salvageValue?.toNumber() ?? null,
      depreciation,
      depreciationPercent,
      yearsOwned,
      remainingLifeYears,
      lastValuation: lastValuation
        ? {
            date: lastValuation.date.toISOString(),
            value: lastValuation.value.toNumber(),
            note: lastValuation.note,
          }
        : null,
    };
  });
}

/**
 * Get totals for all tangible assets.
 */
export async function getTangibleAssetsTotals(userId: string): Promise<TangibleAssetsTotals> {
  const assets = await getTangibleAssets(userId);

  const totalCurrentValue = assets.reduce((sum, a) => sum + a.currentValue, 0);
  const totalPurchasePrice = assets.reduce((sum, a) => sum + a.purchasePrice, 0);
  const totalDepreciation = totalPurchasePrice - totalCurrentValue;
  const depreciationPercent =
    totalPurchasePrice > 0 ? (totalDepreciation / totalPurchasePrice) * 100 : 0;

  return {
    totalCurrentValue,
    totalPurchasePrice,
    totalDepreciation,
    depreciationPercent,
    assetCount: assets.length,
  };
}

/**
 * Get a single tangible asset by ID with all valuations.
 */
export async function getTangibleAssetById(
  id: string,
  userId: string
): Promise<TangibleAssetWithValuations | null> {
  return db.tangibleAsset.findFirst({
    where: { id, userId },
    include: {
      valuations: {
        orderBy: { date: "desc" },
      },
    },
  });
}

export interface CreateTangibleAssetInput {
  name: string;
  description?: string;
  category: TangibleAssetCategory;
  purchaseDate: Date;
  purchasePrice: number;
  currency?: string;
  depreciationMethod?: DepreciationMethod;
  usefulLifeYears?: number;
  salvageValue?: number;
}

/**
 * Create a new tangible asset with smart defaults based on category.
 */
export async function createTangibleAsset(
  userId: string,
  input: CreateTangibleAssetInput
): Promise<TangibleAsset> {
  const categoryDefaults = CATEGORY_DEFAULTS[input.category];

  // Use provided values or fall back to category defaults
  const depreciationMethod = input.depreciationMethod ?? categoryDefaults.method;
  const usefulLifeYears = input.usefulLifeYears ?? categoryDefaults.usefulLifeYears;
  const salvageValue =
    input.salvageValue ?? calculateDefaultSalvageValue(input.category, input.purchasePrice);

  return db.tangibleAsset.create({
    data: {
      userId,
      name: input.name,
      description: input.description,
      category: input.category,
      purchaseDate: input.purchaseDate,
      purchasePrice: input.purchasePrice,
      currency: (input.currency as Currency) ?? "EUR",
      depreciationMethod,
      usefulLifeYears,
      salvageValue,
    },
  });
}

export interface UpdateTangibleAssetInput {
  name?: string;
  description?: string;
  category?: TangibleAssetCategory;
  purchaseDate?: Date;
  purchasePrice?: number;
  currency?: string;
  depreciationMethod?: DepreciationMethod;
  usefulLifeYears?: number | null;
  salvageValue?: number | null;
}

/**
 * Update a tangible asset.
 */
export async function updateTangibleAsset(
  id: string,
  userId: string,
  input: UpdateTangibleAssetInput
): Promise<TangibleAsset | null> {
  // First verify ownership
  const existing = await db.tangibleAsset.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    return null;
  }

  return db.tangibleAsset.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description,
      category: input.category,
      purchaseDate: input.purchaseDate,
      purchasePrice: input.purchasePrice,
      currency: input.currency as Currency | undefined,
      depreciationMethod: input.depreciationMethod,
      usefulLifeYears: input.usefulLifeYears,
      salvageValue: input.salvageValue,
    },
  });
}

/**
 * Delete a tangible asset.
 */
export async function deleteTangibleAsset(id: string, userId: string): Promise<boolean> {
  // First verify ownership
  const existing = await db.tangibleAsset.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    return false;
  }

  await db.tangibleAsset.delete({
    where: { id },
  });

  return true;
}

export interface CreateValuationInput {
  date: Date;
  value: number;
  note?: string;
}

/**
 * Add a manual valuation to an asset.
 */
export async function addAssetValuation(
  assetId: string,
  userId: string,
  input: CreateValuationInput
): Promise<TangibleAssetValuation | null> {
  // Verify ownership
  const asset = await db.tangibleAsset.findFirst({
    where: { id: assetId, userId },
  });

  if (!asset) {
    return null;
  }

  return db.tangibleAssetValuation.upsert({
    where: {
      assetId_date: {
        assetId,
        date: input.date,
      },
    },
    create: {
      assetId,
      date: input.date,
      value: input.value,
      note: input.note,
    },
    update: {
      value: input.value,
      note: input.note,
    },
  });
}
