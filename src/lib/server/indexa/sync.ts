import { db } from "../db";
import { getIndexaClient, isIndexaConfigured } from "./client";
import { Decimal } from "decimal.js";
import { startOfDay, subDays, subYears } from "date-fns";

export type IndexaSyncMode = "light" | "full";

export interface IndexaSyncResult {
  success: boolean;
  accountsSynced: number;
  snapshotsAdded: number;
  error?: string;
}

export async function syncIndexaData(
  userId: string,
  mode: IndexaSyncMode = "light"
): Promise<IndexaSyncResult> {
  if (!isIndexaConfigured()) {
    return { success: true, accountsSynced: 0, snapshotsAdded: 0 };
  }

  const client = getIndexaClient();
  let snapshotsAdded = 0;

  try {
    const user = await client.getUser();
    const accounts = user.accounts ?? [];

    if (accounts.length === 0) {
      return { success: true, accountsSynced: 0, snapshotsAdded: 0 };
    }

    for (const accountSummary of accounts) {
      const account = await client.getAccount(accountSummary.account_number);
      const portfolio = await client.getPortfolio(account.accountNumber);
      const netContributions = await client.getNetContributions(account.accountNumber);

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

      const today = startOfDay(new Date());
      const portfolioDate = startOfDay(new Date(portfolio.date));
      const snapshotDate = portfolioDate <= today ? portfolioDate : today;

      const totalInvested = portfolio.instrumentsCost + portfolio.cashAmount;
      const returns = portfolio.totalValue - totalInvested;
      const returnsPercent = totalInvested > 0 ? (returns / totalInvested) * 100 : 0;

      const currentSnapshot = await db.indexaPortfolioSnapshot.upsert({
        where: { accountId_date: { accountId: dbAccount.id, date: snapshotDate } },
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
          // totalInvested is intentionally not overwritten: the Indexa API returns
          // the current cost basis for all queried dates, so updating it on every
          // sync would flatten the historical record to today's value.
          returns: new Decimal(returns),
          returnsPercent: new Decimal(returnsPercent),
        },
      });

      await db.indexaHolding.deleteMany({ where: { snapshotId: currentSnapshot.id } });

      const nonZeroHoldings = portfolio.holdings.filter((h) => h.value > 0 && h.shares > 0);
      const totalHoldingsValue = nonZeroHoldings.reduce((sum, h) => sum + h.value, 0);

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

      const endDate = new Date();
      const startDate =
        mode === "full"
          ? subYears(endDate, 10)
          : dbAccount.lastSyncAt ?? subDays(endDate, 30);

      const performancePoints = await client.getPerformance(account.accountNumber, startDate, endDate);

      for (const point of performancePoints) {
        const pointDate = startOfDay(new Date(point.date));

        if (pointDate.getTime() === snapshotDate.getTime()) continue;
        if (point.totalValue <= 0 || pointDate > new Date()) continue;

        await db.indexaPortfolioSnapshot.upsert({
          where: { accountId_date: { accountId: dbAccount.id, date: pointDate } },
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
            // totalInvested intentionally not overwritten — see comment above.
            returns: new Decimal(point.returns),
            returnsPercent: new Decimal(point.returnsPercent),
          },
        });

        snapshotsAdded++;
      }

      await db.indexaAccount.update({
        where: { id: dbAccount.id },
        data: { lastSyncAt: new Date() },
      });
    }

    return { success: true, accountsSynced: accounts.length, snapshotsAdded };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { success: false, accountsSynced: 0, snapshotsAdded, error: errorMessage };
  }
}

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

  if (accounts.length === 0) return null;

  let totalValue = 0;
  let totalInvested = 0;
  let totalReturns = 0;

  const accountSummaries = accounts.map((account) => {
    const latestSnapshot = account.snapshots[0];
    const currentValue = latestSnapshot?.totalValue.toNumber() ?? 0;
    const invested =
      account.netContributions?.toNumber() ?? latestSnapshot?.totalInvested.toNumber() ?? 0;
    const returns = currentValue - invested;
    const returnsPercent = invested > 0 ? (returns / invested) * 100 : 0;

    totalValue += currentValue;
    totalInvested += invested;
    totalReturns += returns;

    return { accountNumber: account.accountNumber, accountType: account.accountType, status: account.status, currentValue, returns, returnsPercent, lastSyncAt: account.lastSyncAt };
  });

  const totalReturnsPercent = totalInvested > 0 ? (totalReturns / totalInvested) * 100 : 0;

  return { totalValue, totalInvested, totalReturns, totalReturnsPercent, accounts: accountSummaries };
}

export async function getIndexaPortfolioHistory(
  userId: string,
  days: number = 365
): Promise<Array<{ date: Date; totalValue: number; totalInvested: number; returns: number; returnsPercent: number }>> {
  const startDate = subDays(new Date(), days);
  const today = new Date();

  const accounts = await db.indexaAccount.findMany({
    where: { userId, status: "active" },
    select: { id: true },
  });
  const accountIds = accounts.map((a) => a.id);

  if (accountIds.length === 0) return [];

  const snapshots = await db.indexaPortfolioSnapshot.findMany({
    where: { accountId: { in: accountIds }, date: { gte: startDate, lte: today }, totalValue: { gt: 0 } },
    orderBy: { date: "asc" },
  });

  // Deduplicate per account per date (guards against Z vs +00:00 format duplicates
  // that can both exist in SQLite since it compares datetime strings literally).
  const perAccount = new Map<string, Map<string, { date: Date; totalValue: number; totalInvested: number; returns: number }>>();

  for (const snapshot of snapshots) {
    const dateKey = snapshot.date.toISOString().split("T")[0];
    if (!perAccount.has(snapshot.accountId)) perAccount.set(snapshot.accountId, new Map());
    perAccount.get(snapshot.accountId)!.set(dateKey, {
      date: snapshot.date,
      totalValue: snapshot.totalValue.toNumber(),
      totalInvested: snapshot.totalInvested.toNumber(),
      returns: snapshot.returns.toNumber(),
    });
  }

  const grouped = new Map<string, { date: Date; totalValue: number; totalInvested: number; returns: number }>();

  for (const accountDates of perAccount.values()) {
    for (const [dateKey, values] of accountDates) {
      const existing = grouped.get(dateKey);
      if (existing) {
        existing.totalValue += values.totalValue;
        existing.totalInvested += values.totalInvested;
        existing.returns += values.returns;
      } else {
        grouped.set(dateKey, { ...values });
      }
    }
  }

  return Array.from(grouped.values()).map((point) => ({
    ...point,
    returnsPercent: point.totalInvested > 0 ? (point.returns / point.totalInvested) * 100 : 0,
  }));
}

export async function getIndexaHoldings(userId: string): Promise<
  Array<{ instrumentName: string; instrumentType: string; isin: string | null; totalShares: number; totalValue: number; weight: number }>
> {
  const accounts = await db.indexaAccount.findMany({ where: { userId, status: "active" } });

  const holdingsMap = new Map<string, { instrumentName: string; instrumentType: string; isin: string | null; totalShares: number; totalValue: number }>();
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
        if (value <= 0 || shares <= 0) continue;

        const key = holding.instrumentName;
        grandTotal += value;
        const existing = holdingsMap.get(key);

        if (existing) {
          existing.totalShares += shares;
          existing.totalValue += value;
        } else {
          holdingsMap.set(key, { instrumentName: holding.instrumentName, instrumentType: holding.instrumentType, isin: holding.isin, totalShares: shares, totalValue: value });
        }
      }
    }
  }

  return Array.from(holdingsMap.values())
    .filter((h) => h.totalValue > 0)
    .map((h) => ({ ...h, weight: grandTotal > 0 ? (h.totalValue / grandTotal) * 100 : 0 }))
    .sort((a, b) => b.totalValue - a.totalValue);
}
