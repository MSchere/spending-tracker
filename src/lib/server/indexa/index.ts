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
  IndexaAuthResponse,
  IndexaApiUser,
  IndexaApiAccountSummary,
  IndexaApiAccount,
  IndexaApiPortfolio,
  IndexaApiPerformance,
  IndexaApiError,
  IndexaAccount,
  IndexaHolding,
  IndexaPortfolioSnapshot,
  IndexaPerformancePoint,
} from "./types";
