export { AlphaVantageClient, getAlphaVantageClient, isAlphaVantageConfigured } from "./client";

export {
  getFinancialAssets,
  getFinancialAssetsTotals,
  getFinancialAssetById,
  getFinancialAssetBySymbol,
  createFinancialAsset,
  updateFinancialAsset,
  deleteFinancialAsset,
  updateAssetPrice,
  syncFinancialAssetPrices,
} from "./queries";

export type {
  FinancialAssetWithPrices,
  FinancialAssetSummary,
  FinancialAssetsTotals,
  CreateFinancialAssetInput,
  UpdateFinancialAssetInput,
  FinancialAssetsSyncResult,
} from "./queries";

export type { StockQuote, CryptoQuote, SymbolSearchMatch, PriceHistoryPoint } from "./types";

export { COMMON_CRYPTO_SYMBOLS } from "./types";
