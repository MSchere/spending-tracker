/**
 * PostgreSQL → SQLite Data Migration Script
 * ==========================================
 *
 * Copies every row from the existing Postgres database into the new SQLite
 * database in foreign-key-safe insertion order.
 *
 * Prerequisites
 * -------------
 * 1. Update DATABASE_URL in .env to the new SQLite path, e.g.
 *      DATABASE_URL="file:./prisma/database.db"
 * 2. Create the SQLite schema:
 *      pnpm db:migrate
 * 3. Run this script, providing the OLD Postgres connection string:
 *      PG_DATABASE_URL="postgresql://user:pass@host:5432/dbname" \
 *        pnpm tsx prisma/migrate-pg-to-sqlite.ts
 *
 * The script is safe to re-run – it uses upserts so duplicate rows are
 * silently skipped rather than causing errors.
 */

import { Client } from "pg";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import "dotenv/config";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PG_URL = process.env.PG_DATABASE_URL;
if (!PG_URL) {
  console.error("❌  PG_DATABASE_URL environment variable is required.");
  console.error(
    '    Example: PG_DATABASE_URL="postgresql://user:pass@localhost:5432/db" pnpm tsx prisma/migrate-pg-to-sqlite.ts'
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** pg returns BIGINT columns as strings – convert them back to BigInt. */
function bigint(value: string | number | null | undefined): bigint | null {
  if (value === null || value === undefined) return null;
  return BigInt(value);
}

/** pg returns NUMERIC/DECIMAL columns as strings – wrap in Prisma Decimal. */
function decimal(
  value: string | number | null | undefined
): Prisma.Decimal | null {
  if (value === null || value === undefined) return null;
  return new Prisma.Decimal(String(value));
}

/** Ensure a value that should be a Date is actually a Date object. */
function date(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value : new Date(value);
}

/** Non-nullable version of date(). */
function dateNN(value: Date | string | null | undefined): Date {
  const d = date(value);
  if (!d) throw new Error(`Expected non-null date, got ${value}`);
  return d;
}

/** Non-nullable version of decimal(). */
function decimalNN(value: string | number | null | undefined): Prisma.Decimal {
  const d = decimal(value);
  if (!d) throw new Error(`Expected non-null decimal, got ${value}`);
  return d;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const pg = new Client({ connectionString: PG_URL });
  await pg.connect();
  console.log("✅  Connected to PostgreSQL source.");

  const sqliteUrl = process.env.DATABASE_URL;
  if (!sqliteUrl) throw new Error("DATABASE_URL is not set — point it at the SQLite file.");
  const adapter = new PrismaLibSql({ url: sqliteUrl });
  const sqlite = new PrismaClient({ adapter });
  console.log("✅  Connected to SQLite target.\n");

  // -------------------------------------------------------------------------
  // 1. Users
  // -------------------------------------------------------------------------
  console.log("⏳  Migrating Users…");
  const { rows: users } = await pg.query("SELECT * FROM \"User\" ORDER BY \"createdAt\"");
  for (const r of users) {
    await sqlite.user.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        email: r.email,
        password: r.password,
        name: r.name ?? null,
        twoFactorSecret: r.twoFactorSecret ?? null,
        twoFactorEnabled: r.twoFactorEnabled,
        createdAt: dateNN(r.createdAt),
        updatedAt: dateNN(r.updatedAt),
      },
      update: {},
    });
  }
  console.log(`   ✓ ${users.length} users`);

  // -------------------------------------------------------------------------
  // 2. UserPreferences
  // -------------------------------------------------------------------------
  console.log("⏳  Migrating UserPreferences…");
  const { rows: prefs } = await pg.query(
    "SELECT * FROM \"UserPreferences\" ORDER BY \"createdAt\""
  );
  for (const r of prefs) {
    await sqlite.userPreferences.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        userId: r.userId,
        locale: r.locale,
        currency: r.currency,
        createdAt: dateNN(r.createdAt),
        updatedAt: dateNN(r.updatedAt),
      },
      update: {},
    });
  }
  console.log(`   ✓ ${prefs.length} preferences`);

  // -------------------------------------------------------------------------
  // 3. WiseProfile
  // -------------------------------------------------------------------------
  console.log("⏳  Migrating WiseProfiles…");
  const { rows: wiseProfiles } = await pg.query(
    "SELECT * FROM \"WiseProfile\" ORDER BY \"createdAt\""
  );
  for (const r of wiseProfiles) {
    await sqlite.wiseProfile.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        userId: r.userId,
        profileId: BigInt(r.profileId),
        type: r.type,
        lastSyncAt: date(r.lastSyncAt),
        createdAt: dateNN(r.createdAt),
      },
      update: {},
    });
  }
  console.log(`   ✓ ${wiseProfiles.length} Wise profiles`);

  // -------------------------------------------------------------------------
  // 4. WiseBalance
  // -------------------------------------------------------------------------
  console.log("⏳  Migrating WiseBalances…");
  const { rows: wiseBalances } = await pg.query(
    "SELECT * FROM \"WiseBalance\" ORDER BY \"createdAt\""
  );
  for (const r of wiseBalances) {
    await sqlite.wiseBalance.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        wiseBalanceId: BigInt(r.wiseBalanceId),
        profileId: r.profileId,
        currency: r.currency,
        amount: decimalNN(r.amount),
        createdAt: dateNN(r.createdAt),
        updatedAt: dateNN(r.updatedAt),
      },
      update: {},
    });
  }
  console.log(`   ✓ ${wiseBalances.length} Wise balances`);

  // -------------------------------------------------------------------------
  // 5. Category
  // -------------------------------------------------------------------------
  console.log("⏳  Migrating Categories…");
  const { rows: categories } = await pg.query(
    "SELECT * FROM \"Category\" ORDER BY \"createdAt\""
  );
  for (const r of categories) {
    await sqlite.category.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        name: r.name,
        icon: r.icon ?? null,
        color: r.color ?? null,
        type: r.type,
        isSystem: r.isSystem,
        createdAt: dateNN(r.createdAt),
      },
      update: {},
    });
  }
  console.log(`   ✓ ${categories.length} categories`);

  // -------------------------------------------------------------------------
  // 6. CategoryKeyword
  // -------------------------------------------------------------------------
  console.log("⏳  Migrating CategoryKeywords…");
  const { rows: keywords } = await pg.query("SELECT * FROM \"CategoryKeyword\"");
  for (const r of keywords) {
    await sqlite.categoryKeyword.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        categoryId: r.categoryId,
        keyword: r.keyword,
      },
      update: {},
    });
  }
  console.log(`   ✓ ${keywords.length} keywords`);

  // -------------------------------------------------------------------------
  // 7. RecurringExpense  (before Transaction – referenced by it)
  // -------------------------------------------------------------------------
  console.log("⏳  Migrating RecurringExpenses…");
  const { rows: recurring } = await pg.query(
    "SELECT * FROM \"RecurringExpense\" ORDER BY \"createdAt\""
  );
  for (const r of recurring) {
    await sqlite.recurringExpense.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        name: r.name,
        type: r.type,
        amount: decimalNN(r.amount),
        currency: r.currency,
        frequency: r.frequency,
        nextDueDate: dateNN(r.nextDueDate),
        categoryId: r.categoryId ?? null,
        isActive: r.isActive,
        createdAt: dateNN(r.createdAt),
        updatedAt: dateNN(r.updatedAt),
      },
      update: {},
    });
  }
  console.log(`   ✓ ${recurring.length} recurring expenses`);

  // -------------------------------------------------------------------------
  // 8. Transaction
  // -------------------------------------------------------------------------
  console.log("⏳  Migrating Transactions…");
  const { rows: transactions } = await pg.query(
    "SELECT * FROM \"Transaction\" ORDER BY \"createdAt\""
  );
  const CHUNK = 500;
  for (let i = 0; i < transactions.length; i += CHUNK) {
    const chunk = transactions.slice(i, i + CHUNK);
    await sqlite.$transaction(
      chunk.map((r: Record<string, any>) =>
        sqlite.transaction.upsert({
          where: { id: r.id },
          create: {
            id: r.id,
            wiseRefNumber: r.wiseRefNumber ?? null,
            profileId: r.profileId ?? null,
            userId: r.userId ?? null,
            type: r.type,
            amount: decimalNN(r.amount),
            currency: r.currency,
            amountEur: decimalNN(r.amountEur),
            description: r.description ?? null,
            date: dateNN(r.date),
            categoryId: r.categoryId ?? null,
            isRecurring: r.isRecurring,
            recurringExpenseId: r.recurringExpenseId ?? null,
            createdAt: dateNN(r.createdAt),
            updatedAt: dateNN(r.updatedAt),
          },
          update: {},
        })
      )
    );
    process.stdout.write(`\r   ✓ ${Math.min(i + CHUNK, transactions.length)}/${transactions.length} transactions`);
  }
  console.log();

  // -------------------------------------------------------------------------
  // 9. Budget
  // -------------------------------------------------------------------------
  console.log("⏳  Migrating Budgets…");
  const { rows: budgets } = await pg.query(
    "SELECT * FROM \"Budget\" ORDER BY \"createdAt\""
  );
  for (const r of budgets) {
    await sqlite.budget.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        userId: r.userId,
        categoryId: r.categoryId,
        amount: decimalNN(r.amount),
        currency: r.currency,
        period: r.period,
        startDate: dateNN(r.startDate),
        isActive: r.isActive,
        createdAt: dateNN(r.createdAt),
        updatedAt: dateNN(r.updatedAt),
      },
      update: {},
    });
  }
  console.log(`   ✓ ${budgets.length} budgets`);

  // -------------------------------------------------------------------------
  // 10. SavingsGoal
  // -------------------------------------------------------------------------
  console.log("⏳  Migrating SavingsGoals…");
  const { rows: goals } = await pg.query(
    "SELECT * FROM \"SavingsGoal\" ORDER BY \"createdAt\""
  );
  for (const r of goals) {
    await sqlite.savingsGoal.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        userId: r.userId,
        name: r.name,
        targetAmount: decimalNN(r.targetAmount),
        currentAmount: decimalNN(r.currentAmount),
        currency: r.currency,
        deadline: date(r.deadline),
        type: r.type,
        isCompleted: r.isCompleted,
        createdAt: dateNN(r.createdAt),
        updatedAt: dateNN(r.updatedAt),
      },
      update: {},
    });
  }
  console.log(`   ✓ ${goals.length} savings goals`);

  // -------------------------------------------------------------------------
  // 11. ExchangeRate
  // -------------------------------------------------------------------------
  console.log("⏳  Migrating ExchangeRates…");
  const { rows: rates } = await pg.query(
    "SELECT * FROM \"ExchangeRate\" ORDER BY \"createdAt\""
  );
  for (const r of rates) {
    await sqlite.exchangeRate.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        fromCurrency: r.fromCurrency,
        toCurrency: r.toCurrency,
        rate: decimalNN(r.rate),
        date: dateNN(r.date),
        createdAt: dateNN(r.createdAt),
      },
      update: {},
    });
  }
  console.log(`   ✓ ${rates.length} exchange rates`);

  // -------------------------------------------------------------------------
  // 12. AppSettings
  // -------------------------------------------------------------------------
  console.log("⏳  Migrating AppSettings…");
  const { rows: settings } = await pg.query("SELECT * FROM \"AppSettings\"");
  for (const r of settings) {
    await sqlite.appSettings.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        primaryCurrency: r.primaryCurrency,
        lastSyncAt: date(r.lastSyncAt),
        createdAt: dateNN(r.createdAt),
        updatedAt: dateNN(r.updatedAt),
      },
      update: {},
    });
  }
  console.log(`   ✓ ${settings.length} app settings`);

  // -------------------------------------------------------------------------
  // 13. SyncLog
  // -------------------------------------------------------------------------
  console.log("⏳  Migrating SyncLogs…");
  const { rows: syncLogs } = await pg.query(
    "SELECT * FROM \"SyncLog\" ORDER BY \"createdAt\""
  );
  for (const r of syncLogs) {
    await sqlite.syncLog.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        status: r.status,
        transactionsAdded: r.transactionsAdded,
        errorMessage: r.errorMessage ?? null,
        createdAt: dateNN(r.createdAt),
      },
      update: {},
    });
  }
  console.log(`   ✓ ${syncLogs.length} sync logs`);

  // -------------------------------------------------------------------------
  // 14. IndexaAccount
  // -------------------------------------------------------------------------
  console.log("⏳  Migrating IndexaAccounts…");
  const { rows: indexaAccounts } = await pg.query(
    "SELECT * FROM \"IndexaAccount\" ORDER BY \"createdAt\""
  );
  for (const r of indexaAccounts) {
    await sqlite.indexaAccount.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        userId: r.userId,
        accountNumber: r.accountNumber,
        accountType: r.accountType,
        status: r.status,
        riskLevel: r.riskLevel ?? null,
        netContributions: decimal(r.netContributions),
        lastSyncAt: date(r.lastSyncAt),
        createdAt: dateNN(r.createdAt),
        updatedAt: dateNN(r.updatedAt),
      },
      update: {},
    });
  }
  console.log(`   ✓ ${indexaAccounts.length} Indexa accounts`);

  // -------------------------------------------------------------------------
  // 15. IndexaPortfolioSnapshot
  // -------------------------------------------------------------------------
  console.log("⏳  Migrating IndexaPortfolioSnapshots…");
  const { rows: snapshots } = await pg.query(
    "SELECT * FROM \"IndexaPortfolioSnapshot\" ORDER BY \"createdAt\""
  );
  for (const r of snapshots) {
    await sqlite.indexaPortfolioSnapshot.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        accountId: r.accountId,
        date: dateNN(r.date),
        totalValue: decimalNN(r.totalValue),
        totalInvested: decimalNN(r.totalInvested),
        returns: decimalNN(r.returns),
        returnsPercent: decimalNN(r.returnsPercent),
        createdAt: dateNN(r.createdAt),
      },
      update: {},
    });
  }
  console.log(`   ✓ ${snapshots.length} portfolio snapshots`);

  // -------------------------------------------------------------------------
  // 16. IndexaHolding
  // -------------------------------------------------------------------------
  console.log("⏳  Migrating IndexaHoldings…");
  const { rows: holdings } = await pg.query("SELECT * FROM \"IndexaHolding\"");
  for (const r of holdings) {
    await sqlite.indexaHolding.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        snapshotId: r.snapshotId,
        instrumentName: r.instrumentName,
        instrumentType: r.instrumentType,
        isin: r.isin ?? null,
        shares: decimalNN(r.shares),
        value: decimalNN(r.value),
        weight: decimalNN(r.weight),
      },
      update: {},
    });
  }
  console.log(`   ✓ ${holdings.length} holdings`);

  // -------------------------------------------------------------------------
  // 17. TangibleAsset
  // -------------------------------------------------------------------------
  console.log("⏳  Migrating TangibleAssets…");
  const { rows: tangibleAssets } = await pg.query(
    "SELECT * FROM \"TangibleAsset\" ORDER BY \"createdAt\""
  );
  for (const r of tangibleAssets) {
    await sqlite.tangibleAsset.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        userId: r.userId,
        name: r.name,
        description: r.description ?? null,
        category: r.category,
        purchaseDate: dateNN(r.purchaseDate),
        purchasePrice: decimalNN(r.purchasePrice),
        currency: r.currency,
        depreciationMethod: r.depreciationMethod,
        usefulLifeYears: r.usefulLifeYears ?? null,
        salvageValue: decimal(r.salvageValue),
        createdAt: dateNN(r.createdAt),
        updatedAt: dateNN(r.updatedAt),
      },
      update: {},
    });
  }
  console.log(`   ✓ ${tangibleAssets.length} tangible assets`);

  // -------------------------------------------------------------------------
  // 18. FinancialAsset
  // -------------------------------------------------------------------------
  console.log("⏳  Migrating FinancialAssets…");
  const { rows: financialAssets } = await pg.query(
    "SELECT * FROM \"FinancialAsset\" ORDER BY \"createdAt\""
  );
  for (const r of financialAssets) {
    await sqlite.financialAsset.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        userId: r.userId,
        symbol: r.symbol,
        name: r.name,
        type: r.type,
        shares: decimalNN(r.shares),
        avgCostBasis: decimalNN(r.avgCostBasis),
        currency: r.currency,
        lastPrice: decimal(r.lastPrice),
        lastPriceAt: date(r.lastPriceAt),
        createdAt: dateNN(r.createdAt),
        updatedAt: dateNN(r.updatedAt),
      },
      update: {},
    });
  }
  console.log(`   ✓ ${financialAssets.length} financial assets`);

  // -------------------------------------------------------------------------
  // 19. FinancialAssetPrice
  // -------------------------------------------------------------------------
  console.log("⏳  Migrating FinancialAssetPrices…");
  const { rows: assetPrices } = await pg.query(
    "SELECT * FROM \"FinancialAssetPrice\" ORDER BY \"createdAt\""
  );
  for (const r of assetPrices) {
    await sqlite.financialAssetPrice.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        assetId: r.assetId,
        date: dateNN(r.date),
        price: decimalNN(r.price),
        createdAt: dateNN(r.createdAt),
      },
      update: {},
    });
  }
  console.log(`   ✓ ${assetPrices.length} price records`);

  // -------------------------------------------------------------------------
  // Done
  // -------------------------------------------------------------------------
  console.log("\n🎉  Migration complete!\n");

  // Row counts summary
  const counts = await sqlite.$transaction([
    sqlite.user.count(),
    sqlite.transaction.count(),
    sqlite.category.count(),
    sqlite.wiseProfile.count(),
    sqlite.wiseBalance.count(),
    sqlite.budget.count(),
    sqlite.savingsGoal.count(),
    sqlite.recurringExpense.count(),
    sqlite.exchangeRate.count(),
    sqlite.indexaAccount.count(),
    sqlite.indexaPortfolioSnapshot.count(),
    sqlite.indexaHolding.count(),
    sqlite.tangibleAsset.count(),
    sqlite.financialAsset.count(),
    sqlite.financialAssetPrice.count(),
  ]);

  console.log("SQLite row counts:");
  console.log(`  Users                    : ${counts[0]}`);
  console.log(`  Transactions             : ${counts[1]}`);
  console.log(`  Categories               : ${counts[2]}`);
  console.log(`  Wise Profiles            : ${counts[3]}`);
  console.log(`  Wise Balances            : ${counts[4]}`);
  console.log(`  Budgets                  : ${counts[5]}`);
  console.log(`  Savings Goals            : ${counts[6]}`);
  console.log(`  Recurring Expenses       : ${counts[7]}`);
  console.log(`  Exchange Rates           : ${counts[8]}`);
  console.log(`  Indexa Accounts          : ${counts[9]}`);
  console.log(`  Portfolio Snapshots      : ${counts[10]}`);
  console.log(`  Indexa Holdings          : ${counts[11]}`);
  console.log(`  Tangible Assets          : ${counts[12]}`);
  console.log(`  Financial Assets         : ${counts[13]}`);
  console.log(`  Financial Asset Prices   : ${counts[14]}`);

  await pg.end();
  await sqlite.$disconnect();
}

main().catch((err) => {
  console.error("❌  Migration failed:", err);
  process.exit(1);
});
