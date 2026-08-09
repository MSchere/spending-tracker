/**
 * IBKR Client Portal Web API types
 * Docs: https://www.interactivebrokers.com/docs/web-api/api/web-api/quick-start
 */

/**
 * GET /v1/api/iserver/auth/status
 */
export interface IbkrAuthStatus {
  authenticated: boolean;
  connected: boolean;
  competing?: boolean;
  message?: string;
  fail?: string;
}

/**
 * GET /v1/api/portfolio/accounts
 */
export interface IbkrAccount {
  id: string;
  accountId: string;
  accountVan?: string;
  accountTitle?: string;
  displayName?: string;
  accountAlias?: string | null;
  currency: string;
  type?: string;
  tradingType?: string;
  ibEntity?: string;
  clearingStatus?: string;
  desc?: string;
}

/**
 * GET /v1/api/portfolio/{accountId}/positions/{pageId}
 * Only the fields we use are typed; the API returns many more.
 */
export interface IbkrPosition {
  acctId: string;
  conid: number;
  contractDesc?: string;
  position: number;
  mktPrice: number;
  mktValue: number;
  currency: string;
  avgCost: number;
  avgPrice?: number;
  realizedPnl?: number;
  unrealizedPnl?: number;
  assetClass: string; // "STK", "OPT", "FUT", "CASH", ...
  ticker?: string;
  name?: string;
  type?: string; // "ETF", "Stock", ...
  listingExchange?: string;
  countryCode?: string;
}

/**
 * Transformed position for internal use
 */
export interface IbkrPositionInfo {
  accountId: string;
  conid: string;
  ticker: string;
  name: string;
  assetClass: string;
  instrumentType: string | null;
  shares: number;
  price: number;
  value: number;
  avgCost: number;
  currency: string;
}
