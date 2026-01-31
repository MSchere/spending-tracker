// =============================================================================
// Wise API Client
// =============================================================================

import type {
  WiseApiProfile,
  WiseApiBalance,
  WiseApiExchangeRate,
  WiseApiError,
  WiseApiActivityResponse,
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

  /**
   * Get activities for a profile (works with read-only tokens)
   * This is an alternative to Balance Statements that doesn't require write permissions
   */
  async getActivities(
    profileId: number,
    startDate: Date,
    endDate: Date,
    size: number = 100
  ): Promise<WiseApiActivityResponse> {
    const params = new URLSearchParams({
      since: startDate.toISOString(),
      until: endDate.toISOString(),
      size: size.toString(),
    });

    return this.request<WiseApiActivityResponse>(
      `/v1/profiles/${profileId}/activities?${params}`
    );
  }

  /**
   * Get all activities with pagination
   */
  async getAllActivities(
    profileId: number,
    startDate: Date,
    endDate: Date
  ): Promise<WiseApiActivityResponse["activities"]> {
    const allActivities: WiseApiActivityResponse["activities"] = [];
    let cursor: string | null = null;

    do {
      const params = new URLSearchParams({
        since: startDate.toISOString(),
        until: endDate.toISOString(),
        size: "100",
      });

      if (cursor) {
        params.set("nextCursor", cursor);
      }

      const response = await this.request<WiseApiActivityResponse>(
        `/v1/profiles/${profileId}/activities?${params}`
      );

      allActivities.push(...response.activities);
      cursor = response.cursor;
    } while (cursor);

    return allActivities;
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
