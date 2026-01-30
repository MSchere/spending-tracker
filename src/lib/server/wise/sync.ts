// =============================================================================
// Wise Sync Service
// Syncs transactions from Wise API to the database
// =============================================================================

import { db } from "../db";
import { getWiseClient } from "./client";
import type { WiseApiTransaction } from "./types";
import { Decimal } from "decimal.js";
import { subMonths } from "date-fns";

/**
 * Map Wise transaction type to our TransactionType enum
 */
function mapTransactionType(
  wiseType: "CREDIT" | "DEBIT",
  detailType: string
): "INCOME" | "EXPENSE" | "TRANSFER" | "INVESTMENT" {
  // Internal transfers between Wise balances
  if (
    detailType === "BALANCE_TRANSFER" ||
    detailType === "BALANCE_CONVERSION"
  ) {
    return "TRANSFER";
  }

  // Credits are income
  if (wiseType === "CREDIT") {
    return "INCOME";
  }

  // Debits are expenses
  return "EXPENSE";
}

/**
 * Auto-categorize a transaction based on merchant/description keywords
 */
async function autoCategorize(
  description: string,
  merchant: string | null
): Promise<string | null> {
  const searchText = `${description} ${merchant || ""}`.toLowerCase();

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
 * Process a single transaction from Wise
 */
async function processTransaction(
  transaction: WiseApiTransaction,
  profileId: string
): Promise<{ created: boolean; id: string }> {
  // Check if transaction already exists
  const existing = await db.transaction.findUnique({
    where: { wiseRefNumber: transaction.referenceNumber },
  });

  if (existing) {
    return { created: false, id: existing.id };
  }

  const currency = transaction.amount.currency;
  const amount = transaction.amount.value;
  const date = new Date(transaction.date);

  // Get EUR equivalent
  let amountEur = amount;
  if (currency !== "EUR") {
    const rate = await getExchangeRate(currency, "EUR", date);
    amountEur = amount * rate;
  }

  // Extract merchant info
  const merchant = transaction.details.merchant?.name || null;
  const description =
    transaction.details.description ||
    transaction.details.paymentReference ||
    merchant ||
    "Unknown transaction";

  // Auto-categorize
  const categoryId = await autoCategorize(description, merchant);

  // Map transaction type
  const type = mapTransactionType(
    transaction.type,
    transaction.details.type
  );

  // Create transaction
  const created = await db.transaction.create({
    data: {
      wiseRefNumber: transaction.referenceNumber,
      profileId,
      type,
      amount: new Decimal(amount),
      currency,
      amountEur: new Decimal(amountEur),
      description,
      merchant,
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

        // Get transactions for the last 3 months
        const endDate = new Date();
        const startDate = subMonths(endDate, 3);

        try {
          const statement = await client.getStatement(
            apiProfile.id,
            apiBalance.id,
            apiBalance.currency,
            startDate,
            endDate
          );

          // Process each transaction
          for (const tx of statement.transactions) {
            const result = await processTransaction(tx, profile.id);
            if (result.created) {
              transactionsAdded++;
            }
          }
        } catch (error) {
          // Some balances may not support statements
          console.warn(
            `Could not fetch statement for balance ${apiBalance.id}:`,
            error
          );
        }
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
