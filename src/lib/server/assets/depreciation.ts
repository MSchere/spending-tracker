import { Decimal } from "decimal.js";
import { TangibleAssetCategory, DepreciationMethod } from "@prisma/client";
import { differenceInDays } from "date-fns";

/**
 * Default depreciation settings by asset category.
 * Based on realistic market values (e.g., Spanish used car market).
 */
export const CATEGORY_DEFAULTS: Record<
  TangibleAssetCategory,
  {
    usefulLifeYears: number | null;
    salvagePercent: number; // Percentage of purchase price retained
    method: DepreciationMethod;
  }
> = {
  VEHICLE: {
    usefulLifeYears: 15,
    salvagePercent: 40, // Cars retain ~40% after 15 years in current market
    method: "STRAIGHT_LINE",
  },
  REAL_ESTATE: {
    usefulLifeYears: null,
    salvagePercent: 100, // Real estate typically doesn't depreciate (may appreciate)
    method: "NONE",
  },
  ELECTRONICS: {
    usefulLifeYears: 5,
    salvagePercent: 10,
    method: "DECLINING_BALANCE",
  },
  FURNITURE: {
    usefulLifeYears: 10,
    salvagePercent: 20,
    method: "STRAIGHT_LINE",
  },
  JEWELRY: {
    usefulLifeYears: null,
    salvagePercent: 100, // Jewelry typically retains or gains value
    method: "NONE",
  },
  COLLECTIBLES: {
    usefulLifeYears: null,
    salvagePercent: 100, // Collectibles may appreciate
    method: "NONE",
  },
  OTHER: {
    usefulLifeYears: 10,
    salvagePercent: 10,
    method: "STRAIGHT_LINE",
  },
};

export interface AssetForDepreciation {
  purchaseDate: Date;
  purchasePrice: Decimal;
  depreciationMethod: DepreciationMethod;
  usefulLifeYears: number | null;
  salvageValue: Decimal | null;
}

export interface DepreciationResult {
  currentValue: number;
  totalDepreciation: number;
  depreciationPercent: number;
  yearsOwned: number;
  remainingLifeYears: number | null;
}

/**
 * Calculate the current value of an asset based on its depreciation method.
 */
export function calculateDepreciation(
  asset: AssetForDepreciation,
  asOfDate: Date = new Date()
): DepreciationResult {
  const purchasePrice = asset.purchasePrice.toNumber();
  const salvageValue = asset.salvageValue?.toNumber() ?? 0;

  // Calculate years owned (with fractional precision)
  const daysOwned = differenceInDays(asOfDate, asset.purchaseDate);
  const yearsOwned = Math.max(0, daysOwned / 365.25);

  let currentValue: number;
  let remainingLifeYears: number | null = null;

  switch (asset.depreciationMethod) {
    case "NONE":
      // No depreciation - value stays at purchase price
      currentValue = purchasePrice;
      break;

    case "STRAIGHT_LINE": {
      // Linear depreciation: (Cost - Salvage) / Useful Life per year
      const usefulLife = asset.usefulLifeYears ?? 10;
      const depreciableAmount = purchasePrice - salvageValue;
      const annualDepreciation = depreciableAmount / usefulLife;
      const totalDepreciated = Math.min(yearsOwned * annualDepreciation, depreciableAmount);
      currentValue = Math.max(purchasePrice - totalDepreciated, salvageValue);
      remainingLifeYears = Math.max(0, usefulLife - yearsOwned);
      break;
    }

    case "DECLINING_BALANCE": {
      // Double declining balance: 2/usefulLife rate applied to remaining value
      const usefulLife = asset.usefulLifeYears ?? 10;
      const rate = 2 / usefulLife;
      let value = purchasePrice;

      // Apply depreciation year by year
      const fullYears = Math.floor(yearsOwned);
      for (let i = 0; i < fullYears && value > salvageValue; i++) {
        const depreciation = value * rate;
        value = Math.max(value - depreciation, salvageValue);
      }

      // Apply partial year depreciation
      const partialYear = yearsOwned - fullYears;
      if (partialYear > 0 && value > salvageValue) {
        const depreciation = value * rate * partialYear;
        value = Math.max(value - depreciation, salvageValue);
      }

      currentValue = value;
      remainingLifeYears = Math.max(0, usefulLife - yearsOwned);
      break;
    }

    default:
      currentValue = purchasePrice;
  }

  const totalDepreciation = purchasePrice - currentValue;
  const depreciationPercent = purchasePrice > 0 ? (totalDepreciation / purchasePrice) * 100 : 0;

  return {
    currentValue,
    totalDepreciation,
    depreciationPercent,
    yearsOwned,
    remainingLifeYears,
  };
}

/**
 * Generate depreciation schedule data points for charting.
 * Returns monthly data points from purchase date to end of useful life (or current date + 2 years if NONE).
 */
export function generateDepreciationSchedule(
  asset: AssetForDepreciation,
  intervalMonths: number = 3 // Quarterly by default
): { date: Date; value: number }[] {
  const points: { date: Date; value: number }[] = [];

  const startDate = new Date(asset.purchaseDate);
  let endDate: Date;

  if (asset.depreciationMethod === "NONE") {
    // For non-depreciating assets, show 5 years from purchase
    endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 5);
  } else {
    // Show until end of useful life + 1 year buffer
    const usefulLife = asset.usefulLifeYears ?? 10;
    endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + usefulLife + 1);
  }

  // Cap at reasonable future date (current date + 1 year max for future)
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 1);
  if (endDate > maxDate) {
    endDate = maxDate;
  }

  // Generate points
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const result = calculateDepreciation(asset, currentDate);
    points.push({
      date: new Date(currentDate),
      value: result.currentValue,
    });

    // Move to next interval
    currentDate.setMonth(currentDate.getMonth() + intervalMonths);
  }

  // Always include current date as the last point if not already included
  const now = new Date();
  if (now > startDate && now <= endDate) {
    const lastPoint = points[points.length - 1];
    if (
      !lastPoint ||
      Math.abs(now.getTime() - lastPoint.date.getTime()) > 7 * 24 * 60 * 60 * 1000
    ) {
      const result = calculateDepreciation(asset, now);
      points.push({
        date: now,
        value: result.currentValue,
      });
      // Re-sort by date
      points.sort((a, b) => a.date.getTime() - b.date.getTime());
    }
  }

  return points;
}

/**
 * Calculate default salvage value based on category and purchase price.
 */
export function calculateDefaultSalvageValue(
  category: TangibleAssetCategory,
  purchasePrice: number
): number {
  const defaults = CATEGORY_DEFAULTS[category];
  return (purchasePrice * defaults.salvagePercent) / 100;
}
