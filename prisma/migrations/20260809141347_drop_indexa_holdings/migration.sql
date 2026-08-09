/*
  Hand-edited: before dropping IndexaHolding, migrate its data into the
  FinancialAsset / FinancialAssetPrice tables (source = 'INDEXA'):

    1. One FinancialAsset per (userId, instrument), aggregated across accounts,
       using each account's latest snapshot.
    2. One FinancialAssetPrice per (asset, snapshot date) reconstructed from
       historical holdings (price = value / shares), so portfolio history
       survives the table drop.

  Ticker falls back to the instrument name when no ISIN is known.
*/

-- 1. Current holdings -> FinancialAsset
INSERT OR IGNORE INTO "FinancialAsset" (
    "id", "userId", "ticker", "isin", "name", "type", "source", "externalId",
    "shares", "avgCostBasis", "currency", "lastPrice", "lastPriceAt",
    "createdAt", "updatedAt"
)
SELECT
    lower(hex(randomblob(16))),
    a."userId",
    COALESCE(h."isin", h."instrumentName"),
    h."isin",
    h."instrumentName",
    'FUND',
    'INDEXA',
    h."isin",
    SUM(h."shares"),
    NULL,
    'EUR',
    SUM(h."value") / SUM(h."shares"),
    MAX(s."date"),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "IndexaHolding" h
JOIN "IndexaPortfolioSnapshot" s ON h."snapshotId" = s."id"
JOIN "IndexaAccount" a ON s."accountId" = a."id"
WHERE h."shares" > 0
  AND h."value" > 0
  AND s."date" = (
      SELECT MAX(s2."date") FROM "IndexaPortfolioSnapshot" s2 WHERE s2."accountId" = a."id"
  )
GROUP BY a."userId", COALESCE(h."isin", h."instrumentName");

-- 2. Historical holdings -> FinancialAssetPrice (daily price per asset)
INSERT OR REPLACE INTO "FinancialAssetPrice" ("id", "assetId", "date", "price", "createdAt")
SELECT
    lower(hex(randomblob(16))),
    fa."id",
    s."date",
    h."value" / h."shares",
    CURRENT_TIMESTAMP
FROM "IndexaHolding" h
JOIN "IndexaPortfolioSnapshot" s ON h."snapshotId" = s."id"
JOIN "IndexaAccount" a ON s."accountId" = a."id"
JOIN "FinancialAsset" fa
  ON fa."userId" = a."userId"
 AND fa."source" = 'INDEXA'
 AND fa."ticker" = COALESCE(h."isin", h."instrumentName")
WHERE h."shares" > 0
  AND h."value" > 0;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "IndexaHolding";
PRAGMA foreign_keys=on;
