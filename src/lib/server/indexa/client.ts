import type {
  IndexaAuthResponse,
  IndexaApiUser,
  IndexaApiAccount,
  IndexaApiPortfolio,
  IndexaApiPerformance,
  IndexaApiError,
  IndexaAccount,
  IndexaPortfolioSnapshot,
  IndexaPerformancePoint,
  IndexaHolding,
} from "./types";

const INDEXA_API_URL = "https://api.indexacapital.com";

/**
 * Indexa Capital API Client with automatic token refresh
 */
export class IndexaClient {
  private token: string;
  private username: string;
  private password: string;
  private document: string;
  private tokenExpiry: Date | null = null;

  constructor(options?: {
    token?: string;
    username?: string;
    password?: string;
    document?: string;
  }) {
    this.token = options?.token || process.env.INDEXA_API_TOKEN || "";
    this.username = options?.username || process.env.INDEXA_USERNAME || "";
    this.password = options?.password || process.env.INDEXA_PASSWORD || "";
    this.document = options?.document || process.env.INDEXA_DOCUMENT || "";

    if (!this.token && (!this.username || !this.password || !this.document)) {
      throw new Error(
        "Indexa API requires either a token or username/password/document credentials"
      );
    }
  }

  /**
   * Authenticate and get a new JWT token
   */
  private async authenticate(): Promise<void> {
    if (!this.username || !this.password || !this.document) {
      throw new Error("Cannot re-authenticate without credentials");
    }

    const response = await fetch(`${INDEXA_API_URL}/auth/authenticate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: this.username,
        document: this.document,
        password: this.password,
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as IndexaApiError;
      throw new Error(errorData.message || `Indexa auth failed: ${response.status}`);
    }

    const data = (await response.json()) as IndexaAuthResponse;
    this.token = data.token;
    // JWT tokens from Indexa expire in ~16 hours, refresh after 15 hours
    this.tokenExpiry = new Date(Date.now() + 15 * 60 * 60 * 1000);
  }

  /**
   * Check if token is expired or will expire soon
   */
  private isTokenExpired(): boolean {
    if (!this.tokenExpiry) return false;
    return new Date() >= this.tokenExpiry;
  }

  /**
   * Ensure we have a valid token
   */
  private async ensureValidToken(): Promise<void> {
    if (!this.token || this.isTokenExpired()) {
      await this.authenticate();
    }
  }

  /**
   * Make an authenticated request to the Indexa API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retry: boolean = true
  ): Promise<T> {
    await this.ensureValidToken();

    const url = `${INDEXA_API_URL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        "X-AUTH-TOKEN": this.token,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...options.headers,
      },
    });

    // Handle 401/403 by refreshing token and retrying once
    if ((response.status === 401 || response.status === 403) && retry) {
      this.tokenExpiry = null; // Force re-auth
      return this.request<T>(endpoint, options, false);
    }

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as IndexaApiError;
      throw new Error(errorData.message || `Indexa API error: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Get current user information including account list
   */
  async getUser(): Promise<IndexaApiUser> {
    return this.request<IndexaApiUser>("/users/me");
  }

  /**
   * Get account details (raw API response)
   */
  async getAccountRaw(accountNumber: string): Promise<IndexaApiAccount> {
    return this.request<IndexaApiAccount>(`/accounts/${accountNumber}`);
  }

  /**
   * Get account details (transformed)
   */
  async getAccount(accountNumber: string): Promise<IndexaAccount> {
    const raw = await this.getAccountRaw(accountNumber);
    return {
      accountNumber: raw.account_number,
      type: raw.type,
      status: raw.status,
      riskLevel: raw.profile?.selected_risk ?? raw.profile?.risk?.total ?? 5,
      currency: raw.currency,
    };
  }

  /**
   * Get current portfolio (raw API response)
   */
  async getPortfolioRaw(accountNumber: string): Promise<IndexaApiPortfolio> {
    return this.request<IndexaApiPortfolio>(`/accounts/${accountNumber}/portfolio`);
  }

  /**
   * Get current portfolio (transformed)
   */
  async getPortfolio(accountNumber: string): Promise<IndexaPortfolioSnapshot> {
    const raw = await this.getPortfolioRaw(accountNumber);

    // Transform holdings from the API response
    const holdings: IndexaHolding[] = [];

    for (const instrumentAccount of raw.instrument_accounts || []) {
      for (const position of instrumentAccount.positions || []) {
        holdings.push({
          instrumentName: position.instrument.name,
          instrumentType: position.instrument.asset_class,
          isin: position.instrument.isin_code || null,
          shares: position.titles,
          value: position.amount,
          price: position.price,
        });
      }
    }

    return {
      // account_number may not be in portfolio object, use the one we queried with
      accountNumber: raw.portfolio.account_number || accountNumber,
      date: raw.portfolio.date,
      totalValue: raw.portfolio.total_amount,
      cashAmount: raw.portfolio.cash_amount,
      instrumentsValue: raw.portfolio.instruments_amount,
      instrumentsCost: raw.portfolio.instruments_cost,
      inflows: raw.portfolio.inflows ?? 0,
      outflows: raw.portfolio.outflows ?? 0,
      holdings,
    };
  }

  /**
   * Get performance history (raw API response)
   */
  async getPerformanceRaw(
    accountNumber: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<IndexaApiPerformance> {
    const params = new URLSearchParams();
    if (startDate) {
      params.set("from", startDate.toISOString().split("T")[0]);
    }
    if (endDate) {
      params.set("to", endDate.toISOString().split("T")[0]);
    }

    const queryString = params.toString();
    const endpoint = `/accounts/${accountNumber}/performance${queryString ? `?${queryString}` : ""}`;
    return this.request<IndexaApiPerformance>(endpoint);
  }

  /**
   * Get performance history (transformed)
   *
   * The Indexa API returns portfolio snapshots in the `portfolios` array,
   * each containing: date, total_amount, instruments_cost, instruments_amount, cash_amount
   */
  async getPerformance(
    accountNumber: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<IndexaPerformancePoint[]> {
    const raw = await this.getPerformanceRaw(accountNumber, startDate, endDate);

    const points: IndexaPerformancePoint[] = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // The portfolios array contains portfolio snapshot objects with dates
    const portfolioSnapshots = raw.portfolios || [];

    if (Array.isArray(portfolioSnapshots) && portfolioSnapshots.length > 0) {
      for (const snapshot of portfolioSnapshots) {
        if (typeof snapshot === "object" && snapshot !== null) {
          const snap = snapshot as Record<string, unknown>;
          const dateStr = (snap.date || snap.created_at) as string;
          const totalValue = (snap.total_amount || 0) as number;
          const instrumentsCost = (snap.instruments_cost || 0) as number;
          const cashAmount = (snap.cash_amount || 0) as number;

          // Parse the date and filter out future dates (projections)
          const date = new Date(dateStr);
          if (isNaN(date.getTime()) || date > today) {
            continue;
          }

          // Only include snapshots with actual value
          if (dateStr && totalValue > 0) {
            // Use cost basis (instruments_cost + cash) as total invested
            // This represents the actual cost of acquiring current holdings
            const totalInvested = instrumentsCost + cashAmount;
            const returns = totalValue - totalInvested;
            const returnsPercent = totalInvested > 0 ? (returns / totalInvested) * 100 : 0;

            points.push({
              date: dateStr,
              totalValue,
              totalInvested,
              returns,
              returnsPercent,
            });
          }
        }
      }
    }

    // Sort by date ascending
    points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return points;
  }

  /**
   * Get the latest net contributions (deposits - withdrawals) for an account.
   * This matches Indexa's "Aportaciones" value.
   */
  async getNetContributions(accountNumber: string): Promise<number> {
    const raw = await this.getPerformanceRaw(accountNumber);

    const netAmounts = raw.net_amounts;
    if (netAmounts && typeof netAmounts === "object" && !Array.isArray(netAmounts)) {
      const dateKeys = Object.keys(netAmounts).sort();
      if (dateKeys.length > 0) {
        const lastKey = dateKeys[dateKeys.length - 1];
        return netAmounts[lastKey] ?? 0;
      }
    }

    return 0;
  }
}

/**
 * Get a singleton Indexa client instance
 */
let indexaClientInstance: IndexaClient | null = null;

export function getIndexaClient(): IndexaClient {
  if (!indexaClientInstance) {
    indexaClientInstance = new IndexaClient();
  }
  return indexaClientInstance;
}

/**
 * Check if Indexa integration is configured
 */
export function isIndexaConfigured(): boolean {
  const hasToken = !!process.env.INDEXA_API_TOKEN;
  const hasCredentials =
    !!process.env.INDEXA_USERNAME && !!process.env.INDEXA_PASSWORD && !!process.env.INDEXA_DOCUMENT;
  return hasToken || hasCredentials;
}
