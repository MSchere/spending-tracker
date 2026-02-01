import { db } from "../db";
import { getIndexaClient, isIndexaConfigured } from "./client";
import { Decimal } from "decimal.js";
import { startOfDay, subDays, subYears } from "date-fns";

/**
 * Sync mode for Indexa data
 */
export type IndexaSyncMode = "light" | "full";

/**
 * Sync result for Indexa
 */
export interface IndexaSyncResult {
  success: boolean;
  accountsSynced: number;
  snapshotsAdded: number;
  error?: string;
}

/**
 * Sync Indexa Capital data for a user
 *
 * @param userId - The user ID to sync data for
 * @param mode - "light" (incremental, from last sync) or "full" (complete history)
 */
export async function syncIndexaData(
  userId: string,
  mode: IndexaSyncMode = "light"
): Promise<IndexaSyncResult> {
  // Check if Indexa is configured
  if (!isIndexaConfigured()) {
    return {
      success: true,
      accountsSynced: 0,
      snapshotsAdded: 0,
    };
  }

  const client = getIndexaClient();
  let snapshotsAdded = 0;

  try {
    // Get user info and account list
    const user = await client.getUser();
    const accounts = user.accounts ?? [];

    if (accounts.length === 0) {
      return {
        success: true,
        accountsSynced: 0,
        snapshotsAdded: 0,
      };
    }

    for (const accountSummary of accounts) {
      // Get full account details (already transformed by client)
      const account = await client.getAccount(accountSummary.account_number);

      // Get current portfolio first (for the latest snapshot)
      const portfolio = await client.getPortfolio(account.accountNumber);

      // Get net contributions from performance endpoint (matches Indexa's "Aportaciones")
      const netContributions = await client.getNetContributions(account.accountNumber);

      // Upsert account in database with net contributions
      const dbAccount = await db.indexaAccount.upsert({
        where: { accountNumber: account.accountNumber },
        create: {
          userId,
          accountNumber: account.accountNumber,
          accountType: account.type,
          status: account.status,
          riskLevel: account.riskLevel,
          netContributions: netContributions > 0 ? new Decimal(netContributions) : null,
        },
        update: {
          status: account.status,
          riskLevel: account.riskLevel,
          netContributions: netContributions > 0 ? new Decimal(netContributions) : undefined,
        },
      });

      // Create/update today's snapshot with current portfolio data
      const today = startOfDay(new Date());
      const portfolioDate = startOfDay(new Date(portfolio.date));

      // Use portfolio date if it's today or recent, otherwise use today
      const snapshotDate = portfolioDate <= today ? portfolioDate : today;

      // Use cost basis (instruments_cost + cash) for historical tracking
      // This represents the actual cost of acquiring current holdings
      const totalInvested = portfolio.instrumentsCost + portfolio.cashAmount;
      const returns = portfolio.totalValue - totalInvested;
      const returnsPercent = totalInvested > 0 ? (returns / totalInvested) * 100 : 0;

      const currentSnapshot = await db.indexaPortfolioSnapshot.upsert({
        where: {
          accountId_date: {
            accountId: dbAccount.id,
            date: snapshotDate,
          },
        },
        create: {
          accountId: dbAccount.id,
          date: snapshotDate,
          totalValue: new Decimal(portfolio.totalValue),
          totalInvested: new Decimal(totalInvested),
          returns: new Decimal(returns),
          returnsPercent: new Decimal(returnsPercent),
        },
        update: {
          totalValue: new Decimal(portfolio.totalValue),
          totalInvested: new Decimal(totalInvested),
          returns: new Decimal(returns),
          returnsPercent: new Decimal(returnsPercent),
        },
      });

      // Update holdings for current snapshot
      await db.indexaHolding.deleteMany({
        where: { snapshotId: currentSnapshot.id },
      });

      // Calculate total value for weight calculation (only non-zero holdings)
      const nonZeroHoldings = portfolio.holdings.filter((h) => h.value > 0 && h.shares > 0);
      const totalHoldingsValue = nonZeroHoldings.reduce((sum, h) => sum + h.value, 0);

      // Create holdings (only non-zero)
      for (const holding of nonZeroHoldings) {
        const weight = totalHoldingsValue > 0 ? (holding.value / totalHoldingsValue) * 100 : 0;

        await db.indexaHolding.create({
          data: {
            snapshotId: currentSnapshot.id,
            instrumentName: holding.instrumentName,
            instrumentType: holding.instrumentType,
            isin: holding.isin,
            shares: new Decimal(holding.shares),
            value: new Decimal(holding.value),
            weight: new Decimal(weight),
          },
        });
      }

      snapshotsAdded++;

      // Determine date range for historical data based on mode
      let startDate: Date;
      const endDate = new Date();

      if (mode === "full") {
        // Full sync: Get all historical data (up to 10 years)
        startDate = subYears(endDate, 10);
      } else {
        // Light sync: From last sync date or last 30 days if never synced
        if (dbAccount.lastSyncAt) {
          startDate = dbAccount.lastSyncAt;
        } else {
          startDate = subDays(endDate, 30);
        }
      }

      // Get performance history for the date range
      const performancePoints = await client.getPerformance(
        account.accountNumber,
        startDate,
        endDate
      );

      // Process historical data points (skip today since we already have it)
      for (const point of performancePoints) {
        const pointDate = startOfDay(new Date(point.date));

        // Skip if this is the same date as our current snapshot
        if (pointDate.getTime() === snapshotDate.getTime()) {
          continue;
        }

        // Skip zero-value or future-dated snapshots (extra safety)
        const now = new Date();
        if (point.totalValue <= 0 || pointDate > now) {
          continue;
        }

        // Upsert snapshot (avoid duplicates for the same day)
        await db.indexaPortfolioSnapshot.upsert({
          where: {
            accountId_date: {
              accountId: dbAccount.id,
              date: pointDate,
            },
          },
          create: {
            accountId: dbAccount.id,
            date: pointDate,
            totalValue: new Decimal(point.totalValue),
            totalInvested: new Decimal(point.totalInvested),
            returns: new Decimal(point.returns),
            returnsPercent: new Decimal(point.returnsPercent),
          },
          update: {
            totalValue: new Decimal(point.totalValue),
            totalInvested: new Decimal(point.totalInvested),
            returns: new Decimal(point.returns),
            returnsPercent: new Decimal(point.returnsPercent),
          },
        });

        snapshotsAdded++;
      }

      // Update last sync time
      await db.indexaAccount.update({
        where: { id: dbAccount.id },
        data: { lastSyncAt: new Date() },
      });
    }

    return {
      success: true,
      accountsSynced: accounts.length,
      snapshotsAdded,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return {
      success: false,
      accountsSynced: 0,
      snapshotsAdded,
      error: errorMessage,
    };
  }
}

/**
 * Get Indexa portfolio summary for a user
 */
export async function getIndexaPortfolioSummary(userId: string): Promise<{
  totalValue: number;
  totalInvested: number;
  totalReturns: number;
  totalReturnsPercent: number;
  accounts: Array<{
    accountNumber: string;
    accountType: string;
    status: string;
    currentValue: number;
    returns: number;
    returnsPercent: number;
    lastSyncAt: Date | null;
  }>;
} | null> {
  // Get only active Indexa accounts for the user (exclude cancelled accounts)
  // Only include snapshots with actual value (filter out zero-value future projections)
  const accounts = await db.indexaAccount.findMany({
    where: {
      userId,
      status: "active",
    },
    include: {
      snapshots: {
        where: {
          totalValue: { gt: 0 },
        },
        orderBy: { date: "desc" },
        take: 1,
      },
    },
  });

  if (accounts.length === 0) {
    return null;
  }

  let totalValue = 0;
  let totalInvested = 0;
  let totalReturns = 0;

  const accountSummaries = accounts.map((account) => {
    const latestSnapshot = account.snapshots[0];
    const currentValue = latestSnapshot?.totalValue.toNumber() ?? 0;

    // Use netContributions (Aportaciones) if available, otherwise fall back to snapshot's totalInvested
    // netContributions = actual deposits - withdrawals, matching Indexa's calculation
    const invested =
      account.netContributions?.toNumber() ?? latestSnapshot?.totalInvested.toNumber() ?? 0;

    // Calculate returns based on net contributions to match Indexa
    const returns = currentValue - invested;
    const returnsPercent = invested > 0 ? (returns / invested) * 100 : 0;

    totalValue += currentValue;
    totalInvested += invested;
    totalReturns += returns;

    return {
      accountNumber: account.accountNumber,
      accountType: account.accountType,
      status: account.status,
      currentValue,
      returns,
      returnsPercent,
      lastSyncAt: account.lastSyncAt,
    };
  });

  const totalReturnsPercent = totalInvested > 0 ? (totalReturns / totalInvested) * 100 : 0;

  return {
    totalValue,
    totalInvested,
    totalReturns,
    totalReturnsPercent,
    accounts: accountSummaries,
  };
}

/**
 * Get portfolio history for charts
 */
export async function getIndexaPortfolioHistory(
  userId: string,
  days: number = 365
): Promise<
  Array<{
    date: Date;
    totalValue: number;
    totalInvested: number;
    returns: number;
    returnsPercent: number;
  }>
> {
  const startDate = subDays(new Date(), days);
  const today = new Date();

  // Get all snapshots for the user's active accounts only
  // Filter: only snapshots with actual value AND not in the future
  // Cancelled accounts are excluded from the chart
  const snapshots = await db.indexaPortfolioSnapshot.findMany({
    where: {
      account: {
        userId,
        status: "active", // Only active accounts
      },
      date: {
        gte: startDate,
        lte: today, // Don't include future dates
      },
      totalValue: { gt: 0 }, // Only non-zero values
    },
    orderBy: { date: "asc" },
  });

  // Group by date and aggregate
  const grouped = new Map<
    string,
    {
      date: Date;
      totalValue: number;
      totalInvested: number;
      returns: number;
    }
  >();

  for (const snapshot of snapshots) {
    const dateKey = snapshot.date.toISOString().split("T")[0];
    const existing = grouped.get(dateKey);

    if (existing) {
      existing.totalValue += snapshot.totalValue.toNumber();
      existing.totalInvested += snapshot.totalInvested.toNumber();
      existing.returns += snapshot.returns.toNumber();
    } else {
      grouped.set(dateKey, {
        date: snapshot.date,
        totalValue: snapshot.totalValue.toNumber(),
        totalInvested: snapshot.totalInvested.toNumber(),
        returns: snapshot.returns.toNumber(),
      });
    }
  }

  // Convert to array with calculated returns percent
  return Array.from(grouped.values()).map((point) => ({
    ...point,
    returnsPercent: point.totalInvested > 0 ? (point.returns / point.totalInvested) * 100 : 0,
  }));
}

/**
 * Get current holdings breakdown
 */
export async function getIndexaHoldings(userId: string): Promise<
  Array<{
    instrumentName: string;
    instrumentType: string;
    isin: string | null;
    totalShares: number;
    totalValue: number;
    weight: number;
  }>
> {
  // Get the latest snapshot for each active account only
  // Cancelled accounts don't have holdings
  const accounts = await db.indexaAccount.findMany({
    where: {
      userId,
      status: "active",
    },
  });

  const holdingsMap = new Map<
    string,
    {
      instrumentName: string;
      instrumentType: string;
      isin: string | null;
      totalShares: number;
      totalValue: number;
    }
  >();

  let grandTotal = 0;

  for (const account of accounts) {
    const latestSnapshot = await db.indexaPortfolioSnapshot.findFirst({
      where: { accountId: account.id },
      orderBy: { date: "desc" },
      include: { holdings: true },
    });

    if (latestSnapshot) {
      for (const holding of latestSnapshot.holdings) {
        const shares = holding.shares.toNumber();
        const value = holding.value.toNumber();

        // Skip zero-value holdings
        if (value <= 0 || shares <= 0) {
          continue;
        }

        const key = holding.instrumentName;
        const existing = holdingsMap.get(key);
        grandTotal += value;

        if (existing) {
          existing.totalShares += shares;
          existing.totalValue += value;
        } else {
          holdingsMap.set(key, {
            instrumentName: holding.instrumentName,
            instrumentType: holding.instrumentType,
            isin: holding.isin,
            totalShares: shares,
            totalValue: value,
          });
        }
      }
    }
  }

  // Calculate weights and filter out any remaining zero-value entries
  return Array.from(holdingsMap.values())
    .filter((holding) => holding.totalValue > 0)
    .map((holding) => ({
      ...holding,
      weight: grandTotal > 0 ? (holding.totalValue / grandTotal) * 100 : 0,
    }))
    .sort((a, b) => b.totalValue - a.totalValue);
}
