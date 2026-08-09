/*
  Hand-edited: `symbol` is renamed to `ticker` (data preserved in the INSERT ... SELECT below).
  Existing rows are manual holdings, so `source` defaults to 'MANUAL'.
*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FinancialAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "isin" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "externalId" TEXT,
    "shares" DECIMAL NOT NULL,
    "avgCostBasis" DECIMAL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "lastPrice" DECIMAL,
    "lastPriceAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FinancialAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_FinancialAsset" ("avgCostBasis", "createdAt", "currency", "id", "lastPrice", "lastPriceAt", "name", "shares", "ticker", "type", "updatedAt", "userId") SELECT "avgCostBasis", "createdAt", "currency", "id", "lastPrice", "lastPriceAt", "name", "shares", "symbol", "type", "updatedAt", "userId" FROM "FinancialAsset";
DROP TABLE "FinancialAsset";
ALTER TABLE "new_FinancialAsset" RENAME TO "FinancialAsset";
CREATE INDEX "FinancialAsset_userId_idx" ON "FinancialAsset"("userId");
CREATE UNIQUE INDEX "FinancialAsset_userId_source_ticker_type_key" ON "FinancialAsset"("userId", "source", "ticker", "type");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
