-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'BRL');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER', 'INVESTMENT');

-- CreateEnum
CREATE TYPE "CategoryType" AS ENUM ('FIXED_EXPENSE', 'VARIABLE_EXPENSE', 'INCOME', 'INVESTMENT', 'TRANSFER');

-- CreateEnum
CREATE TYPE "BudgetPeriod" AS ENUM ('WEEKLY', 'MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "SavingsGoalType" AS ENUM ('EMERGENCY_FUND', 'SAVINGS', 'INDEX_FUND', 'ETF', 'STOCK', 'CRYPTO');

-- CreateEnum
CREATE TYPE "RecurringType" AS ENUM ('EXPENSE', 'INCOME');

-- CreateEnum
CREATE TYPE "RecurringFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('SUCCESS', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "TangibleAssetCategory" AS ENUM ('VEHICLE', 'REAL_ESTATE', 'ELECTRONICS', 'FURNITURE', 'JEWELRY', 'COLLECTIBLES', 'OTHER');

-- CreateEnum
CREATE TYPE "DepreciationMethod" AS ENUM ('STRAIGHT_LINE', 'DECLINING_BALANCE', 'NONE');

-- CreateEnum
CREATE TYPE "FinancialAssetType" AS ENUM ('STOCK', 'CRYPTO', 'ETF');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "twoFactorSecret" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'es-ES',
    "currency" "Currency" NOT NULL DEFAULT 'EUR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WiseProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" BIGINT NOT NULL,
    "type" TEXT NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WiseProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WiseBalance" (
    "id" TEXT NOT NULL,
    "wiseBalanceId" BIGINT NOT NULL,
    "profileId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WiseBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "wiseRefNumber" TEXT,
    "profileId" TEXT,
    "userId" TEXT,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "amountEur" DECIMAL(18,4) NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "categoryId" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringExpenseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "type" "CategoryType" NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryKeyword" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,

    CONSTRAINT "CategoryKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'EUR',
    "period" "BudgetPeriod" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingsGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetAmount" DECIMAL(18,4) NOT NULL,
    "currentAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "currency" "Currency" NOT NULL DEFAULT 'EUR',
    "deadline" TIMESTAMP(3),
    "type" "SavingsGoalType" NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavingsGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringExpense" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RecurringType" NOT NULL DEFAULT 'EXPENSE',
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'EUR',
    "frequency" "RecurringFrequency" NOT NULL,
    "nextDueDate" TIMESTAMP(3) NOT NULL,
    "categoryId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'settings',
    "primaryCurrency" "Currency" NOT NULL DEFAULT 'EUR',
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL,
    "transactionsAdded" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndexaAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "riskLevel" INTEGER,
    "netContributions" DECIMAL(18,4),
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndexaAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndexaPortfolioSnapshot" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalValue" DECIMAL(18,4) NOT NULL,
    "totalInvested" DECIMAL(18,4) NOT NULL,
    "returns" DECIMAL(18,4) NOT NULL,
    "returnsPercent" DECIMAL(8,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndexaPortfolioSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndexaHolding" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "instrumentName" TEXT NOT NULL,
    "instrumentType" TEXT NOT NULL,
    "isin" TEXT,
    "shares" DECIMAL(18,8) NOT NULL,
    "value" DECIMAL(18,4) NOT NULL,
    "weight" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "IndexaHolding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TangibleAsset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "TangibleAssetCategory" NOT NULL,
    "purchaseDate" DATE NOT NULL,
    "purchasePrice" DECIMAL(18,4) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'EUR',
    "depreciationMethod" "DepreciationMethod" NOT NULL DEFAULT 'STRAIGHT_LINE',
    "usefulLifeYears" INTEGER,
    "salvageValue" DECIMAL(18,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TangibleAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialAsset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FinancialAssetType" NOT NULL,
    "shares" DECIMAL(18,8) NOT NULL,
    "avgCostBasis" DECIMAL(18,4) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "lastPrice" DECIMAL(18,4),
    "lastPriceAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialAssetPrice" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "price" DECIMAL(18,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialAssetPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreferences_userId_key" ON "UserPreferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WiseProfile_profileId_key" ON "WiseProfile"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "WiseBalance_wiseBalanceId_key" ON "WiseBalance"("wiseBalanceId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_wiseRefNumber_key" ON "Transaction"("wiseRefNumber");

-- CreateIndex
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");

-- CreateIndex
CREATE INDEX "Transaction_date_idx" ON "Transaction"("date");

-- CreateIndex
CREATE INDEX "Transaction_categoryId_idx" ON "Transaction"("categoryId");

-- CreateIndex
CREATE INDEX "Transaction_type_idx" ON "Transaction"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryKeyword_categoryId_keyword_key" ON "CategoryKeyword"("categoryId", "keyword");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_fromCurrency_toCurrency_date_key" ON "ExchangeRate"("fromCurrency", "toCurrency", "date");

-- CreateIndex
CREATE UNIQUE INDEX "IndexaAccount_accountNumber_key" ON "IndexaAccount"("accountNumber");

-- CreateIndex
CREATE UNIQUE INDEX "IndexaPortfolioSnapshot_accountId_date_key" ON "IndexaPortfolioSnapshot"("accountId", "date");

-- CreateIndex
CREATE INDEX "TangibleAsset_userId_idx" ON "TangibleAsset"("userId");

-- CreateIndex
CREATE INDEX "FinancialAsset_userId_idx" ON "FinancialAsset"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialAsset_userId_symbol_type_key" ON "FinancialAsset"("userId", "symbol", "type");

-- CreateIndex
CREATE INDEX "FinancialAssetPrice_assetId_idx" ON "FinancialAssetPrice"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialAssetPrice_assetId_date_key" ON "FinancialAssetPrice"("assetId", "date");

-- AddForeignKey
ALTER TABLE "UserPreferences" ADD CONSTRAINT "UserPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WiseProfile" ADD CONSTRAINT "WiseProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WiseBalance" ADD CONSTRAINT "WiseBalance_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "WiseProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "WiseProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_recurringExpenseId_fkey" FOREIGN KEY ("recurringExpenseId") REFERENCES "RecurringExpense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryKeyword" ADD CONSTRAINT "CategoryKeyword_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsGoal" ADD CONSTRAINT "SavingsGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndexaAccount" ADD CONSTRAINT "IndexaAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndexaPortfolioSnapshot" ADD CONSTRAINT "IndexaPortfolioSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "IndexaAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndexaHolding" ADD CONSTRAINT "IndexaHolding_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "IndexaPortfolioSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TangibleAsset" ADD CONSTRAINT "TangibleAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAsset" ADD CONSTRAINT "FinancialAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAssetPrice" ADD CONSTRAINT "FinancialAssetPrice_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FinancialAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

