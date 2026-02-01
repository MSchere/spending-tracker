/**
 * Authentication response from POST /auth/authenticate
 */
export interface IndexaAuthResponse {
  token: string;
}

/**
 * Account summary from /users/me accounts array
 */
export interface IndexaApiAccountSummary {
  account_number: string;
  status: string;
  type: "mutual" | "pension";
  "@path": string;
}

/**
 * User information from GET /users/me
 */
export interface IndexaApiUser {
  username: string;
  email: string;
  name?: string;
  surname?: string;
  phone: string;
  document: string;
  document_type: string;
  roles: string[];
  is_activated: boolean;
  phone_activated: boolean;
  email_activated: boolean;
  affiliate_fee: number;
  profiles?: string[];
  accounts?: IndexaApiAccountSummary[];
  accounts_relations?: Array<{
    account_number: string;
    relation: "owner" | "auth" | "guest";
  }>;
  person?: {
    name: string;
  };
}

/**
 * Account details from GET /accounts/{account_number}
 */
export interface IndexaApiAccount {
  account_number: string;
  type: "mutual" | "pension";
  status: string;
  currency: string;
  profile: {
    id: string;
    risk: {
      tolerance: number;
      capacity: number;
      total: number;
    };
    selected_risk: number;
  };
}

/**
 * Instrument from portfolio
 */
export interface IndexaApiInstrument {
  asset_class: string;
  isin_code: string;
  name: string;
}

/**
 * Position in portfolio
 */
export interface IndexaApiPosition {
  amount: number;
  instrument: IndexaApiInstrument;
  price: number;
  titles: number;
}

/**
 * Instrument account from portfolio
 */
export interface IndexaApiInstrumentAccount {
  amount: number;
  positions: IndexaApiPosition[];
}

/**
 * Portfolio summary from GET /accounts/{account_number}/portfolio
 * Note: account_number may not be present in the portfolio object
 */
export interface IndexaApiPortfolioSummary {
  account_number?: string;
  cash_amount: number;
  date: string;
  instruments_amount: number;
  instruments_cost: number;
  total_amount: number;
  inflows?: number;
  outflows?: number;
  tax_outflows?: number;
  created_at?: string;
  accrued_interest?: number | null;
}

/**
 * Portfolio response from GET /accounts/{account_number}/portfolio
 */
export interface IndexaApiPortfolio {
  portfolio: IndexaApiPortfolioSummary;
  instrument_accounts: IndexaApiInstrumentAccount[];
  cash_accounts?: unknown[];
  comparison?: unknown;
  extra?: unknown;
}

/**
 * Performance response from GET /accounts/{account_number}/performance
 * The actual values are in separate arrays: history, portfolios, net_amounts
 */
export interface IndexaApiPerformance {
  plan_expected_return: number;
  performance: {
    // Date strings in format "YYYY-MM-DD" (monthly end dates)
    period: string[];
    // Return percentages (not absolute values)
    real?: number[];
    expected?: number[];
    worst?: number[];
    best?: number[];
    expected_return?: number[];
    worst_return?: number[];
    best_return?: number[];
    expected_pl?: number[];
    worst_pl?: number[];
    best_pl?: number[];
  };
  // Actual portfolio value history (array of values matching period dates)
  history?: number[];
  // Portfolio values at each period
  portfolios?: number[];
  // Net amounts (deposits - withdrawals) at each period - object with YYYYMMDD date keys
  net_amounts?: Record<string, number>;
  // Other fields
  benchmark?: unknown;
  return?: unknown;
  cash_returns?: unknown;
  volatility?: unknown;
  drawdowns?: unknown;
  risk_free_asset_beg_annual?: number;
  sharpe_ratio?: number;
}

/**
 * Error response from Indexa API
 */
export interface IndexaApiError {
  code?: number;
  message?: string;
  errors?: {
    errors?: string[];
    children?: Record<string, unknown>;
  };
}

/**
 * Transformed account for internal use
 */
export interface IndexaAccount {
  accountNumber: string;
  type: "mutual" | "pension";
  status: string;
  riskLevel: number;
  currency: string;
}

/**
 * Transformed holding for internal use
 */
export interface IndexaHolding {
  instrumentName: string;
  instrumentType: string;
  isin: string | null;
  shares: number;
  value: number;
  price: number;
}

/**
 * Transformed portfolio snapshot for internal use
 */
export interface IndexaPortfolioSnapshot {
  accountNumber: string;
  date: string;
  totalValue: number;
  cashAmount: number;
  instrumentsValue: number;
  instrumentsCost: number;
  /** Total deposits/contributions */
  inflows: number;
  /** Total withdrawals */
  outflows: number;
  holdings: IndexaHolding[];
}

/**
 * Transformed performance data point for internal use
 */
export interface IndexaPerformancePoint {
  date: string;
  totalValue: number;
  totalInvested: number;
  returns: number;
  returnsPercent: number;
}
