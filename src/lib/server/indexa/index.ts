export { IndexaClient, getIndexaClient, isIndexaConfigured } from "./client";
export {
  syncIndexaData,
  getIndexaPortfolioSummary,
  getIndexaPortfolioHistory,
  getIndexaHoldings,
  type IndexaSyncMode,
  type IndexaSyncResult,
} from "./sync";
export type {
  // Raw API types (snake_case)
  IndexaAuthResponse,
  IndexaApiUser,
  IndexaApiAccountSummary,
  IndexaApiAccount,
  IndexaApiPortfolio,
  IndexaApiPerformance,
  IndexaApiError,
  // Transformed types (camelCase)
  IndexaAccount,
  IndexaHolding,
  IndexaPortfolioSnapshot,
  IndexaPerformancePoint,
} from "./types";
