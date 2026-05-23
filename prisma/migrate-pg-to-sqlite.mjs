#!/usr/bin/env node
/**
 * PostgreSQL → SQLite standalone migration script
 * ================================================
 * Requires only Node.js 22+ (uses built-in node:sqlite) and the pg package.
 * No Prisma, no TypeScript, no engine downloads needed.
 *
 * Usage:
 *   PG_DATABASE_URL="postgresql://user:pass@host:5432/db" \
 *     node prisma/migrate-pg-to-sqlite.mjs [path/to/output.db]
 *
 *   Default output path: ./prisma/spending.db
 */

import { DatabaseSync } from "node:sqlite";
import { Client } from "pg";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PG_URL = process.env.PG_DATABASE_URL;
if (!PG_URL) {
  console.error("❌  PG_DATABASE_URL environment variable is required.");
  console.error(
    '    Example: PG_DATABASE_URL="postgresql://user:pass@localhost:5432/db" node prisma/migrate-pg-to-sqlite.mjs'
  );
  process.exit(1);
}

const SQLITE_PATH = resolve(process.argv[2] ?? "./prisma/spending.db");
console.log(`📂  SQLite target: ${SQLITE_PATH}\n`);

// ---------------------------------------------------------------------------
// Type conversion helpers
// ---------------------------------------------------------------------------

/** pg returns BIGINT columns as strings; convert to Number for SQLite INTEGER */
const int = (v) => (v == null ? null : Number(v));

/** pg returns NUMERIC/DECIMAL as strings; keep as TEXT for precision */
const dec = (v) => (v == null ? null : String(v));

/** JS boolean → SQLite INTEGER 0/1 */
const bool = (v) => (v == null ? null : v ? 1 : 0);

/** Date/string → ISO 8601 string for SQLite DATETIME */
const dt = (v) => (v == null ? null : v instanceof Date ? v.toISOString() : String(v));

// ---------------------------------------------------------------------------
// Schema DDL  (mirrors prisma/migrations/20260523165056_init/migration.sql)
// ---------------------------------------------------------------------------

const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS "User" (
  "id"               TEXT     NOT NULL PRIMARY KEY,
  "email"            TEXT     NOT NULL,
  "password"         TEXT     NOT NULL,
  "name"             TEXT,
  "twoFactorSecret"  TEXT,
  "twoFactorEnabled" INTEGER  NOT NULL DEFAULT 0,
  "createdAt"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

CREATE TABLE IF NOT EXISTS "UserPreferences" (
  "id"        TEXT     NOT NULL PRIMARY KEY,
  "userId"    TEXT     NOT NULL,
  "locale"    TEXT     NOT NULL DEFAULT 'es-ES',
  "currency"  TEXT     NOT NULL DEFAULT 'EUR',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "UserPreferences_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserPreferences_userId_key" ON "UserPreferences"("userId");

CREATE TABLE IF NOT EXISTS "WiseProfile" (
  "id"         TEXT     NOT NULL PRIMARY KEY,
  "userId"     TEXT     NOT NULL,
  "profileId"  INTEGER  NOT NULL,
  "type"       TEXT     NOT NULL,
  "lastSyncAt" DATETIME,
  "createdAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WiseProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "WiseProfile_profileId_key" ON "WiseProfile"("profileId");

CREATE TABLE IF NOT EXISTS "WiseBalance" (
  "id"            TEXT     NOT NULL PRIMARY KEY,
  "wiseBalanceId" INTEGER  NOT NULL,
  "profileId"     TEXT     NOT NULL,
  "currency"      TEXT     NOT NULL,
  "amount"        TEXT     NOT NULL,
  "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     DATETIME NOT NULL,
  CONSTRAINT "WiseBalance_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "WiseProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "WiseBalance_wiseBalanceId_key" ON "WiseBalance"("wiseBalanceId");

CREATE TABLE IF NOT EXISTS "Category" (
  "id"        TEXT     NOT NULL PRIMARY KEY,
  "name"      TEXT     NOT NULL,
  "icon"      TEXT,
  "color"     TEXT,
  "type"      TEXT     NOT NULL,
  "isSystem"  INTEGER  NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Category_name_key" ON "Category"("name");

CREATE TABLE IF NOT EXISTS "CategoryKeyword" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "categoryId" TEXT NOT NULL,
  "keyword"    TEXT NOT NULL,
  CONSTRAINT "CategoryKeyword_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "CategoryKeyword_categoryId_keyword_key"
  ON "CategoryKeyword"("categoryId", "keyword");

CREATE TABLE IF NOT EXISTS "RecurringExpense" (
  "id"          TEXT     NOT NULL PRIMARY KEY,
  "name"        TEXT     NOT NULL,
  "type"        TEXT     NOT NULL DEFAULT 'EXPENSE',
  "amount"      TEXT     NOT NULL,
  "currency"    TEXT     NOT NULL DEFAULT 'EUR',
  "frequency"   TEXT     NOT NULL,
  "nextDueDate" DATETIME NOT NULL,
  "categoryId"  TEXT,
  "isActive"    INTEGER  NOT NULL DEFAULT 1,
  "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   DATETIME NOT NULL,
  CONSTRAINT "RecurringExpense_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Transaction" (
  "id"                 TEXT     NOT NULL PRIMARY KEY,
  "wiseRefNumber"      TEXT,
  "profileId"          TEXT,
  "userId"             TEXT,
  "type"               TEXT     NOT NULL,
  "amount"             TEXT     NOT NULL,
  "currency"           TEXT     NOT NULL,
  "amountEur"          TEXT     NOT NULL,
  "description"        TEXT,
  "date"               DATETIME NOT NULL,
  "categoryId"         TEXT,
  "isRecurring"        INTEGER  NOT NULL DEFAULT 0,
  "recurringExpenseId" TEXT,
  "createdAt"          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          DATETIME NOT NULL,
  CONSTRAINT "Transaction_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "WiseProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Transaction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Transaction_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Transaction_recurringExpenseId_fkey"
    FOREIGN KEY ("recurringExpenseId") REFERENCES "RecurringExpense"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Transaction_wiseRefNumber_key" ON "Transaction"("wiseRefNumber");
CREATE INDEX IF NOT EXISTS "Transaction_userId_idx"     ON "Transaction"("userId");
CREATE INDEX IF NOT EXISTS "Transaction_date_idx"       ON "Transaction"("date");
CREATE INDEX IF NOT EXISTS "Transaction_categoryId_idx" ON "Transaction"("categoryId");
CREATE INDEX IF NOT EXISTS "Transaction_type_idx"       ON "Transaction"("type");

CREATE TABLE IF NOT EXISTS "Budget" (
  "id"         TEXT     NOT NULL PRIMARY KEY,
  "userId"     TEXT     NOT NULL,
  "categoryId" TEXT     NOT NULL,
  "amount"     TEXT     NOT NULL,
  "currency"   TEXT     NOT NULL DEFAULT 'EUR',
  "period"     TEXT     NOT NULL,
  "startDate"  DATETIME NOT NULL,
  "isActive"   INTEGER  NOT NULL DEFAULT 1,
  "createdAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  DATETIME NOT NULL,
  CONSTRAINT "Budget_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Budget_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "SavingsGoal" (
  "id"            TEXT     NOT NULL PRIMARY KEY,
  "userId"        TEXT     NOT NULL,
  "name"          TEXT     NOT NULL,
  "targetAmount"  TEXT     NOT NULL,
  "currentAmount" TEXT     NOT NULL DEFAULT '0',
  "currency"      TEXT     NOT NULL DEFAULT 'EUR',
  "deadline"      DATETIME,
  "type"          TEXT     NOT NULL,
  "isCompleted"   INTEGER  NOT NULL DEFAULT 0,
  "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     DATETIME NOT NULL,
  CONSTRAINT "SavingsGoal_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ExchangeRate" (
  "id"           TEXT     NOT NULL PRIMARY KEY,
  "fromCurrency" TEXT     NOT NULL,
  "toCurrency"   TEXT     NOT NULL,
  "rate"         TEXT     NOT NULL,
  "date"         DATETIME NOT NULL,
  "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ExchangeRate_fromCurrency_toCurrency_date_key"
  ON "ExchangeRate"("fromCurrency", "toCurrency", "date");

CREATE TABLE IF NOT EXISTS "AppSettings" (
  "id"              TEXT     NOT NULL PRIMARY KEY DEFAULT 'settings',
  "primaryCurrency" TEXT     NOT NULL DEFAULT 'EUR',
  "lastSyncAt"      DATETIME,
  "createdAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "SyncLog" (
  "id"                TEXT     NOT NULL PRIMARY KEY,
  "status"            TEXT     NOT NULL,
  "transactionsAdded" INTEGER  NOT NULL DEFAULT 0,
  "errorMessage"      TEXT,
  "createdAt"         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "IndexaAccount" (
  "id"               TEXT     NOT NULL PRIMARY KEY,
  "userId"           TEXT     NOT NULL,
  "accountNumber"    TEXT     NOT NULL,
  "accountType"      TEXT     NOT NULL,
  "status"           TEXT     NOT NULL,
  "riskLevel"        INTEGER,
  "netContributions" TEXT,
  "lastSyncAt"       DATETIME,
  "createdAt"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        DATETIME NOT NULL,
  CONSTRAINT "IndexaAccount_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "IndexaAccount_accountNumber_key" ON "IndexaAccount"("accountNumber");

CREATE TABLE IF NOT EXISTS "IndexaPortfolioSnapshot" (
  "id"             TEXT     NOT NULL PRIMARY KEY,
  "accountId"      TEXT     NOT NULL,
  "date"           DATETIME NOT NULL,
  "totalValue"     TEXT     NOT NULL,
  "totalInvested"  TEXT     NOT NULL,
  "returns"        TEXT     NOT NULL,
  "returnsPercent" TEXT     NOT NULL,
  "createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IndexaPortfolioSnapshot_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "IndexaAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "IndexaPortfolioSnapshot_accountId_date_key"
  ON "IndexaPortfolioSnapshot"("accountId", "date");

CREATE TABLE IF NOT EXISTS "IndexaHolding" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "snapshotId"     TEXT NOT NULL,
  "instrumentName" TEXT NOT NULL,
  "instrumentType" TEXT NOT NULL,
  "isin"           TEXT,
  "shares"         TEXT NOT NULL,
  "value"          TEXT NOT NULL,
  "weight"         TEXT NOT NULL,
  CONSTRAINT "IndexaHolding_snapshotId_fkey"
    FOREIGN KEY ("snapshotId") REFERENCES "IndexaPortfolioSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "TangibleAsset" (
  "id"                 TEXT     NOT NULL PRIMARY KEY,
  "userId"             TEXT     NOT NULL,
  "name"               TEXT     NOT NULL,
  "description"        TEXT,
  "category"           TEXT     NOT NULL,
  "purchaseDate"       DATETIME NOT NULL,
  "purchasePrice"      TEXT     NOT NULL,
  "currency"           TEXT     NOT NULL DEFAULT 'EUR',
  "depreciationMethod" TEXT     NOT NULL DEFAULT 'STRAIGHT_LINE',
  "usefulLifeYears"    INTEGER,
  "salvageValue"       TEXT,
  "createdAt"          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          DATETIME NOT NULL,
  CONSTRAINT "TangibleAsset_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "TangibleAsset_userId_idx" ON "TangibleAsset"("userId");

CREATE TABLE IF NOT EXISTS "FinancialAsset" (
  "id"           TEXT     NOT NULL PRIMARY KEY,
  "userId"       TEXT     NOT NULL,
  "symbol"       TEXT     NOT NULL,
  "name"         TEXT     NOT NULL,
  "type"         TEXT     NOT NULL,
  "shares"       TEXT     NOT NULL,
  "avgCostBasis" TEXT     NOT NULL,
  "currency"     TEXT     NOT NULL DEFAULT 'USD',
  "lastPrice"    TEXT,
  "lastPriceAt"  DATETIME,
  "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    DATETIME NOT NULL,
  CONSTRAINT "FinancialAsset_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "FinancialAsset_userId_symbol_type_key"
  ON "FinancialAsset"("userId", "symbol", "type");
CREATE INDEX IF NOT EXISTS "FinancialAsset_userId_idx" ON "FinancialAsset"("userId");

CREATE TABLE IF NOT EXISTS "FinancialAssetPrice" (
  "id"        TEXT     NOT NULL PRIMARY KEY,
  "assetId"   TEXT     NOT NULL,
  "date"      DATETIME NOT NULL,
  "price"     TEXT     NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinancialAssetPrice_assetId_fkey"
    FOREIGN KEY ("assetId") REFERENCES "FinancialAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "FinancialAssetPrice_assetId_date_key"
  ON "FinancialAssetPrice"("assetId", "date");
CREATE INDEX IF NOT EXISTS "FinancialAssetPrice_assetId_idx" ON "FinancialAssetPrice"("assetId");
`;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const pg = new Client({ connectionString: PG_URL });
await pg.connect();
console.log("✅  Connected to PostgreSQL source.");

const db = new DatabaseSync(SQLITE_PATH);
db.exec(SCHEMA_SQL);
console.log("✅  SQLite schema ready.\n");

/** Bulk-insert rows using a transaction and INSERT OR IGNORE for idempotency. */
function insertAll(table, rows, mapper) {
  if (rows.length === 0) return;
  const sample = mapper(rows[0]);
  const cols = Object.keys(sample);
  const placeholders = cols.map(() => "?").join(", ");
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO "${table}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders})`
  );
  const insertMany = db.transaction((items) => {
    for (const row of items) {
      const mapped = mapper(row);
      stmt.run(...Object.values(mapped));
    }
  });
  insertMany(rows);
}

// 1. User
process.stdout.write("⏳  Users… ");
const { rows: users } = await pg.query(`SELECT * FROM "User" ORDER BY "createdAt"`);
insertAll("User", users, (r) => ({
  id: r.id, email: r.email, password: r.password, name: r.name ?? null,
  twoFactorSecret: r.twoFactorSecret ?? null, twoFactorEnabled: bool(r.twoFactorEnabled),
  createdAt: dt(r.createdAt), updatedAt: dt(r.updatedAt),
}));
console.log(`✓ ${users.length}`);

// 2. UserPreferences
process.stdout.write("⏳  UserPreferences… ");
const { rows: prefs } = await pg.query(`SELECT * FROM "UserPreferences" ORDER BY "createdAt"`);
insertAll("UserPreferences", prefs, (r) => ({
  id: r.id, userId: r.userId, locale: r.locale, currency: r.currency,
  createdAt: dt(r.createdAt), updatedAt: dt(r.updatedAt),
}));
console.log(`✓ ${prefs.length}`);

// 3. WiseProfile
process.stdout.write("⏳  WiseProfiles… ");
const { rows: wiseProfiles } = await pg.query(`SELECT * FROM "WiseProfile" ORDER BY "createdAt"`);
insertAll("WiseProfile", wiseProfiles, (r) => ({
  id: r.id, userId: r.userId, profileId: int(r.profileId), type: r.type,
  lastSyncAt: dt(r.lastSyncAt), createdAt: dt(r.createdAt),
}));
console.log(`✓ ${wiseProfiles.length}`);

// 4. WiseBalance
process.stdout.write("⏳  WiseBalances… ");
const { rows: wiseBalances } = await pg.query(`SELECT * FROM "WiseBalance" ORDER BY "createdAt"`);
insertAll("WiseBalance", wiseBalances, (r) => ({
  id: r.id, wiseBalanceId: int(r.wiseBalanceId), profileId: r.profileId,
  currency: r.currency, amount: dec(r.amount),
  createdAt: dt(r.createdAt), updatedAt: dt(r.updatedAt),
}));
console.log(`✓ ${wiseBalances.length}`);

// 5. Category
process.stdout.write("⏳  Categories… ");
const { rows: categories } = await pg.query(`SELECT * FROM "Category" ORDER BY "createdAt"`);
insertAll("Category", categories, (r) => ({
  id: r.id, name: r.name, icon: r.icon ?? null, color: r.color ?? null,
  type: r.type, isSystem: bool(r.isSystem), createdAt: dt(r.createdAt),
}));
console.log(`✓ ${categories.length}`);

// 6. CategoryKeyword
process.stdout.write("⏳  CategoryKeywords… ");
const { rows: keywords } = await pg.query(`SELECT * FROM "CategoryKeyword"`);
insertAll("CategoryKeyword", keywords, (r) => ({
  id: r.id, categoryId: r.categoryId, keyword: r.keyword,
}));
console.log(`✓ ${keywords.length}`);

// 7. RecurringExpense  (before Transaction)
process.stdout.write("⏳  RecurringExpenses… ");
const { rows: recurring } = await pg.query(`SELECT * FROM "RecurringExpense" ORDER BY "createdAt"`);
insertAll("RecurringExpense", recurring, (r) => ({
  id: r.id, name: r.name, type: r.type, amount: dec(r.amount), currency: r.currency,
  frequency: r.frequency, nextDueDate: dt(r.nextDueDate), categoryId: r.categoryId ?? null,
  isActive: bool(r.isActive), createdAt: dt(r.createdAt), updatedAt: dt(r.updatedAt),
}));
console.log(`✓ ${recurring.length}`);

// 8. Transaction
process.stdout.write("⏳  Transactions… ");
const { rows: transactions } = await pg.query(`SELECT * FROM "Transaction" ORDER BY "createdAt"`);
insertAll("Transaction", transactions, (r) => ({
  id: r.id, wiseRefNumber: r.wiseRefNumber ?? null, profileId: r.profileId ?? null,
  userId: r.userId ?? null, type: r.type, amount: dec(r.amount), currency: r.currency,
  amountEur: dec(r.amountEur), description: r.description ?? null, date: dt(r.date),
  categoryId: r.categoryId ?? null, isRecurring: bool(r.isRecurring),
  recurringExpenseId: r.recurringExpenseId ?? null,
  createdAt: dt(r.createdAt), updatedAt: dt(r.updatedAt),
}));
console.log(`✓ ${transactions.length}`);

// 9. Budget
process.stdout.write("⏳  Budgets… ");
const { rows: budgets } = await pg.query(`SELECT * FROM "Budget" ORDER BY "createdAt"`);
insertAll("Budget", budgets, (r) => ({
  id: r.id, userId: r.userId, categoryId: r.categoryId, amount: dec(r.amount),
  currency: r.currency, period: r.period, startDate: dt(r.startDate),
  isActive: bool(r.isActive), createdAt: dt(r.createdAt), updatedAt: dt(r.updatedAt),
}));
console.log(`✓ ${budgets.length}`);

// 10. SavingsGoal
process.stdout.write("⏳  SavingsGoals… ");
const { rows: goals } = await pg.query(`SELECT * FROM "SavingsGoal" ORDER BY "createdAt"`);
insertAll("SavingsGoal", goals, (r) => ({
  id: r.id, userId: r.userId, name: r.name, targetAmount: dec(r.targetAmount),
  currentAmount: dec(r.currentAmount), currency: r.currency, deadline: dt(r.deadline),
  type: r.type, isCompleted: bool(r.isCompleted),
  createdAt: dt(r.createdAt), updatedAt: dt(r.updatedAt),
}));
console.log(`✓ ${goals.length}`);

// 11. ExchangeRate
process.stdout.write("⏳  ExchangeRates… ");
const { rows: rates } = await pg.query(`SELECT * FROM "ExchangeRate" ORDER BY "createdAt"`);
insertAll("ExchangeRate", rates, (r) => ({
  id: r.id, fromCurrency: r.fromCurrency, toCurrency: r.toCurrency,
  rate: dec(r.rate), date: dt(r.date), createdAt: dt(r.createdAt),
}));
console.log(`✓ ${rates.length}`);

// 12. AppSettings
process.stdout.write("⏳  AppSettings… ");
const { rows: settings } = await pg.query(`SELECT * FROM "AppSettings"`);
insertAll("AppSettings", settings, (r) => ({
  id: r.id, primaryCurrency: r.primaryCurrency, lastSyncAt: dt(r.lastSyncAt),
  createdAt: dt(r.createdAt), updatedAt: dt(r.updatedAt),
}));
console.log(`✓ ${settings.length}`);

// 13. SyncLog
process.stdout.write("⏳  SyncLogs… ");
const { rows: syncLogs } = await pg.query(`SELECT * FROM "SyncLog" ORDER BY "createdAt"`);
insertAll("SyncLog", syncLogs, (r) => ({
  id: r.id, status: r.status, transactionsAdded: r.transactionsAdded,
  errorMessage: r.errorMessage ?? null, createdAt: dt(r.createdAt),
}));
console.log(`✓ ${syncLogs.length}`);

// 14. IndexaAccount
process.stdout.write("⏳  IndexaAccounts… ");
const { rows: indexaAccounts } = await pg.query(`SELECT * FROM "IndexaAccount" ORDER BY "createdAt"`);
insertAll("IndexaAccount", indexaAccounts, (r) => ({
  id: r.id, userId: r.userId, accountNumber: r.accountNumber, accountType: r.accountType,
  status: r.status, riskLevel: r.riskLevel ?? null, netContributions: dec(r.netContributions),
  lastSyncAt: dt(r.lastSyncAt), createdAt: dt(r.createdAt), updatedAt: dt(r.updatedAt),
}));
console.log(`✓ ${indexaAccounts.length}`);

// 15. IndexaPortfolioSnapshot
process.stdout.write("⏳  IndexaPortfolioSnapshots… ");
const { rows: snapshots } = await pg.query(
  `SELECT * FROM "IndexaPortfolioSnapshot" ORDER BY "createdAt"`
);
insertAll("IndexaPortfolioSnapshot", snapshots, (r) => ({
  id: r.id, accountId: r.accountId, date: dt(r.date),
  totalValue: dec(r.totalValue), totalInvested: dec(r.totalInvested),
  returns: dec(r.returns), returnsPercent: dec(r.returnsPercent), createdAt: dt(r.createdAt),
}));
console.log(`✓ ${snapshots.length}`);

// 16. IndexaHolding
process.stdout.write("⏳  IndexaHoldings… ");
const { rows: holdings } = await pg.query(`SELECT * FROM "IndexaHolding"`);
insertAll("IndexaHolding", holdings, (r) => ({
  id: r.id, snapshotId: r.snapshotId, instrumentName: r.instrumentName,
  instrumentType: r.instrumentType, isin: r.isin ?? null,
  shares: dec(r.shares), value: dec(r.value), weight: dec(r.weight),
}));
console.log(`✓ ${holdings.length}`);

// 17. TangibleAsset
process.stdout.write("⏳  TangibleAssets… ");
const { rows: tangibleAssets } = await pg.query(
  `SELECT * FROM "TangibleAsset" ORDER BY "createdAt"`
);
insertAll("TangibleAsset", tangibleAssets, (r) => ({
  id: r.id, userId: r.userId, name: r.name, description: r.description ?? null,
  category: r.category, purchaseDate: dt(r.purchaseDate), purchasePrice: dec(r.purchasePrice),
  currency: r.currency, depreciationMethod: r.depreciationMethod,
  usefulLifeYears: r.usefulLifeYears ?? null, salvageValue: dec(r.salvageValue),
  createdAt: dt(r.createdAt), updatedAt: dt(r.updatedAt),
}));
console.log(`✓ ${tangibleAssets.length}`);

// 18. FinancialAsset
process.stdout.write("⏳  FinancialAssets… ");
const { rows: financialAssets } = await pg.query(
  `SELECT * FROM "FinancialAsset" ORDER BY "createdAt"`
);
insertAll("FinancialAsset", financialAssets, (r) => ({
  id: r.id, userId: r.userId, symbol: r.symbol, name: r.name, type: r.type,
  shares: dec(r.shares), avgCostBasis: dec(r.avgCostBasis), currency: r.currency,
  lastPrice: dec(r.lastPrice), lastPriceAt: dt(r.lastPriceAt),
  createdAt: dt(r.createdAt), updatedAt: dt(r.updatedAt),
}));
console.log(`✓ ${financialAssets.length}`);

// 19. FinancialAssetPrice
process.stdout.write("⏳  FinancialAssetPrices… ");
const { rows: assetPrices } = await pg.query(
  `SELECT * FROM "FinancialAssetPrice" ORDER BY "createdAt"`
);
insertAll("FinancialAssetPrice", assetPrices, (r) => ({
  id: r.id, assetId: r.assetId, date: dt(r.date), price: dec(r.price),
  createdAt: dt(r.createdAt),
}));
console.log(`✓ ${assetPrices.length}`);

// ---------------------------------------------------------------------------
// Done
// ---------------------------------------------------------------------------

await pg.end();
db.close();

console.log("\n🎉  Migration complete!\n");
console.log("Row counts written to SQLite:");
console.log(`  Users                  : ${users.length}`);
console.log(`  Transactions           : ${transactions.length}`);
console.log(`  Categories             : ${categories.length}`);
console.log(`  Category Keywords      : ${keywords.length}`);
console.log(`  Wise Profiles          : ${wiseProfiles.length}`);
console.log(`  Wise Balances          : ${wiseBalances.length}`);
console.log(`  Budgets                : ${budgets.length}`);
console.log(`  Savings Goals          : ${goals.length}`);
console.log(`  Recurring Expenses     : ${recurring.length}`);
console.log(`  Exchange Rates         : ${rates.length}`);
console.log(`  Indexa Accounts        : ${indexaAccounts.length}`);
console.log(`  Portfolio Snapshots    : ${snapshots.length}`);
console.log(`  Indexa Holdings        : ${holdings.length}`);
console.log(`  Tangible Assets        : ${tangibleAssets.length}`);
console.log(`  Financial Assets       : ${financialAssets.length}`);
console.log(`  Financial Asset Prices : ${assetPrices.length}`);
