// =============================================================================
// Wise API Client
// =============================================================================

import type {
  WiseApiProfile,
  WiseApiBalance,
  WiseApiStatementResponse,
  WiseApiExchangeRate,
  WiseApiError,
} from "./types";

const WISE_API_URL =
  process.env.WISE_ENVIRONMENT === "sandbox"
    ? "https://api.sandbox.transferwise.tech"
    : "https://api.wise.com";

/**
 * Wise API Client for interacting with the Wise API
 */
export class WiseClient {
  private token: string;

  constructor(token?: string) {
    this.token = token || process.env.WISE_API_TOKEN || "";
    if (!this.token) {
      throw new Error("Wise API token is required");
    }
  }

  /**
   * Make an authenticated request to the Wise API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${WISE_API_URL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as WiseApiError;
      throw new Error(
        errorData.message ||
          errorData.error ||
          `Wise API error: ${response.status}`
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Get all profiles for the authenticated user
   */
  async getProfiles(): Promise<WiseApiProfile[]> {
    return this.request<WiseApiProfile[]>("/v1/profiles");
  }

  /**
   * Get balances for a profile
   */
  async getBalances(profileId: number): Promise<WiseApiBalance[]> {
    return this.request<WiseApiBalance[]>(
      `/v4/profiles/${profileId}/balances?types=STANDARD,SAVINGS`
    );
  }

  /**
   * Get statement (transactions) for a balance account
   */
  async getStatement(
    profileId: number,
    balanceId: number,
    currency: string,
    startDate: Date,
    endDate: Date
  ): Promise<WiseApiStatementResponse> {
    const params = new URLSearchParams({
      currency,
      intervalStart: startDate.toISOString(),
      intervalEnd: endDate.toISOString(),
    });

    return this.request<WiseApiStatementResponse>(
      `/v1/profiles/${profileId}/balance-statements/${balanceId}/statement.json?${params}`
    );
  }

  /**
   * Get exchange rates
   */
  async getExchangeRates(
    source: string,
    target: string
  ): Promise<WiseApiExchangeRate[]> {
    const params = new URLSearchParams({ source, target });
    return this.request<WiseApiExchangeRate[]>(`/v1/rates?${params}`);
  }

  /**
   * Get exchange rate for a specific currency pair
   */
  async getExchangeRate(source: string, target: string): Promise<number> {
    const rates = await this.getExchangeRates(source, target);
    if (rates.length === 0) {
      throw new Error(`No exchange rate found for ${source}/${target}`);
    }
    return rates[0].rate;
  }
}

/**
 * Get a singleton Wise client instance
 */
let wiseClientInstance: WiseClient | null = null;

export function getWiseClient(): WiseClient {
  if (!wiseClientInstance) {
    wiseClientInstance = new WiseClient();
  }
  return wiseClientInstance;
}
