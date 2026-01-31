// =============================================================================
// Wise Sync Service
// Syncs transactions from Wise API to the database
// =============================================================================

import { db } from "../db";
import { getWiseClient } from "./client";
import type { WiseApiActivity } from "./types";
import { Decimal } from "decimal.js";
import { subYears } from "date-fns";

/**
 * Auto-categorize a transaction based on description keywords
 */
async function autoCategorize(description: string): Promise<string | null> {
  const searchText = description.toLowerCase();

  // Get all category keywords
  const keywords = await db.categoryKeyword.findMany({
    include: { category: true },
  });

  for (const kw of keywords) {
    if (searchText.includes(kw.keyword.toLowerCase())) {
      return kw.categoryId;
    }
  }

  return null;
}

/**
 * Get exchange rate for a currency pair, using cache
 */
async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  date: Date
): Promise<number> {
  if (fromCurrency === toCurrency) return 1;

  // Check cache first (same day)
  const dateOnly = new Date(date.toISOString().split("T")[0]);
  const cached = await db.exchangeRate.findUnique({
    where: {
      fromCurrency_toCurrency_date: {
        fromCurrency,
        toCurrency,
        date: dateOnly,
      },
    },
  });

  if (cached) {
    return cached.rate.toNumber();
  }

  // Fetch from Wise API
  const client = getWiseClient();
  const rate = await client.getExchangeRate(fromCurrency, toCurrency);

  // Cache the rate
  await db.exchangeRate.create({
    data: {
      fromCurrency,
      toCurrency,
      date: dateOnly,
      rate: new Decimal(rate),
    },
  });

  return rate;
}

/**
 * Parse amount string from Activity API
 * Examples: "150 JPY", "-25.50 EUR", "+100.00 GBP", "<positive>+ 3,070.68 EUR</positive>"
 * Returns the value, currency, and whether it's marked as positive (income)
 */
function parseActivityAmount(amountStr: string): { value: number; currency: string; isPositive: boolean } | null {
  if (!amountStr) return null;
  
  // Check if wrapped in <positive> tag (indicates incoming money)
  const isPositive = amountStr.includes("<positive>");
  
  // Remove HTML tags
  const cleanStr = amountStr.replace(/<[^>]*>/g, "").trim();
  
  // Match patterns like "150 JPY", "-25.50 EUR", "+100.00 GBP", "+ 3,070.68 EUR"
  const match = cleanStr.match(/^([+-]?)\s*([\d,]+\.?\d*)\s*([A-Z]{3})$/);
  if (!match) return null;
  
  const sign = match[1];
  const value = parseFloat(match[2].replace(/,/g, ""));
  const currency = match[3];
  
  // If there's an explicit + sign or <positive> tag, it's positive (income)
  const finalIsPositive = isPositive || sign === "+";
  
  return { value, currency, isPositive: finalIsPositive };
}

/**
 * Determine transaction type based on Wise activity type and amount direction
 * The <positive> tag or + sign in the amount indicates incoming money
 * Returns null if the activity should be skipped
 */
function determineTransactionType(
  activityType: string,
  isPositiveAmount: boolean
): "INCOME" | "EXPENSE" | "TRANSFER" | "INVESTMENT" | null {
  // Skip - not real transactions
  if (activityType === "CARD_CHECK") {
    return null;
  }

  // Transfers between own balances
  if (activityType === "INTERBALANCE" || activityType === "CONVERSION" || activityType === "AUTO_CONVERSION") {
    return "TRANSFER";
  }

  // For TRANSFER type, use the amount sign to determine direction
  // Wise uses TRANSFER for both incoming and outgoing transfers
  if (activityType === "TRANSFER") {
    return isPositiveAmount ? "INCOME" : "EXPENSE";
  }

  // Explicit income types
  if (activityType === "BALANCE_DEPOSIT" || activityType === "BALANCE_CASHBACK" || 
      activityType === "INCOMING_PAYMENT" || activityType === "MONEY_ADDED") {
    return "INCOME";
  }

  // Card payments and direct debits can be refunds if positive
  // A positive CARD_PAYMENT is a refund (money coming back to you)
  if (activityType === "CARD_PAYMENT" || activityType === "DIRECT_DEBIT_TRANSACTION") {
    return isPositiveAmount ? "INCOME" : "EXPENSE";
  }

  // Explicit expense types (fees are always expenses)
  if (activityType === "BALANCE_ASSET_FEE") {
    return "EXPENSE";
  }

  // For unknown types, use the amount direction
  console.log(`Unknown activity type: ${activityType}, using amount direction`);
  return isPositiveAmount ? "INCOME" : "EXPENSE";
}

/**
 * Process a single activity from Wise Activity API
 */
async function processActivity(
  activity: WiseApiActivity,
  profileId: string
): Promise<{ created: boolean; id: string }> {
  // Use activity ID as reference (it's unique)
  const refNumber = `activity-${activity.id}`;
  
  // Check if already exists
  const existing = await db.transaction.findUnique({
    where: { wiseRefNumber: refNumber },
  });

  if (existing) {
    return { created: false, id: existing.id };
  }

  // Only process completed activities
  if (activity.status !== "COMPLETED") {
    return { created: false, id: "" };
  }

  // Parse the primary amount
  const parsedAmount = parseActivityAmount(activity.primaryAmount);
  if (!parsedAmount) {
    console.warn(`Could not parse activity amount: ${activity.primaryAmount}`);
    return { created: false, id: "" };
  }

  const { value: amount, currency, isPositive } = parsedAmount;
  const date = new Date(activity.createdOn);

  // Get EUR equivalent
  let amountEur = amount;
  if (currency !== "EUR") {
    try {
      const rate = await getExchangeRate(currency, "EUR", date);
      amountEur = amount * rate;
    } catch {
      // If exchange rate fails, use the amount as-is
      amountEur = amount;
    }
  }

  // Clean title for description (remove HTML tags)
  const description = activity.title.replace(/<[^>]*>/g, "").trim() || activity.description || "Unknown transaction";

  // Auto-categorize
  const categoryId = await autoCategorize(description);

  // Determine transaction type based on activity type and amount direction
  const type = determineTransactionType(activity.type, isPositive);
  
  // Skip activities that don't represent real transactions (e.g., CARD_CHECK)
  if (type === null) {
    return { created: false, id: "" };
  }

  // Create transaction
  const created = await db.transaction.create({
    data: {
      wiseRefNumber: refNumber,
      profileId,
      type,
      amount: new Decimal(Math.abs(amount)),
      currency,
      amountEur: new Decimal(Math.abs(amountEur)),
      description,
      date,
      categoryId,
    },
  });

  return { created: true, id: created.id };
}

/**
 * Sync result
 */
export interface SyncResult {
  success: boolean;
  profilesSynced: number;
  transactionsAdded: number;
  balancesUpdated: number;
  error?: string;
}

/**
 * Sync all data from Wise for a user
 */
export async function syncWiseData(userId: string): Promise<SyncResult> {
  const client = getWiseClient();
  let transactionsAdded = 0;
  let balancesUpdated = 0;

  try {
    // Get profiles from Wise
    const apiProfiles = await client.getProfiles();

    for (const apiProfile of apiProfiles) {
      // Upsert profile in database
      const profile = await db.wiseProfile.upsert({
        where: { profileId: BigInt(apiProfile.id) },
        create: {
          userId,
          profileId: BigInt(apiProfile.id),
          type: apiProfile.type,
        },
        update: {
          type: apiProfile.type,
        },
      });

      // Get balances
      const apiBalances = await client.getBalances(apiProfile.id);

      for (const apiBalance of apiBalances) {
        // Upsert balance
        await db.wiseBalance.upsert({
          where: { wiseBalanceId: BigInt(apiBalance.id) },
          create: {
            wiseBalanceId: BigInt(apiBalance.id),
            profileId: profile.id,
            currency: apiBalance.currency,
            amount: new Decimal(apiBalance.amount.value),
          },
          update: {
            amount: new Decimal(apiBalance.amount.value),
          },
        });
        balancesUpdated++;
      }

      // Get all historical transactions using Activity API
      // Wise typically has data going back several years
      const endDate = new Date();
      const startDate = subYears(endDate, 10); // Fetch up to 10 years of history

      try {
        const activities = await client.getAllActivities(
          apiProfile.id,
          startDate,
          endDate
        );

        for (const activity of activities) {
          const result = await processActivity(activity, profile.id);
          if (result.created) {
            transactionsAdded++;
          }
        }
        console.log(`Synced ${activities.length} activities for profile ${apiProfile.id}`);
      } catch (activityError) {
        console.error(
          `Activity API failed for profile ${apiProfile.id}:`,
          activityError
        );
      }

      // Update last sync time
      await db.wiseProfile.update({
        where: { id: profile.id },
        data: { lastSyncAt: new Date() },
      });
    }

    // Log successful sync
    await db.syncLog.create({
      data: {
        status: "SUCCESS",
        transactionsAdded,
      },
    });

    // Update app settings
    await db.appSettings.upsert({
      where: { id: "settings" },
      create: { lastSyncAt: new Date() },
      update: { lastSyncAt: new Date() },
    });

    return {
      success: true,
      profilesSynced: apiProfiles.length,
      transactionsAdded,
      balancesUpdated,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Log failed sync
    await db.syncLog.create({
      data: {
        status: "FAILED",
        errorMessage,
      },
    });

    return {
      success: false,
      profilesSynced: 0,
      transactionsAdded,
      balancesUpdated,
      error: errorMessage,
    };
  }
}

/**
 * Get last sync info
 */
export async function getLastSyncInfo(): Promise<{
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
}> {
  const lastLog = await db.syncLog.findFirst({
    orderBy: { createdAt: "desc" },
  });

  return {
    lastSyncAt: lastLog?.createdAt || null,
    lastSyncStatus: lastLog?.status || null,
  };
}
