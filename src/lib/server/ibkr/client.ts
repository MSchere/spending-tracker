import { env } from "@/env";
import { Agent, fetch } from "undici";
import type { IbkrAuthStatus, IbkrAccount, IbkrPosition, IbkrPositionInfo } from "./types";

/**
 * The Client Portal Gateway serves a self-signed certificate (root/vertx.jks),
 * so TLS verification has to be disabled for gateway requests. The gateway is
 * only ever reachable on localhost / a private docker network.
 */
const insecureAgent = new Agent({ connect: { rejectUnauthorized: false } });

/** Thrown when the gateway is up but the brokerage session is not authenticated. */
export class IbkrNotAuthenticatedError extends Error {
  constructor() {
    super(
      "IBKR gateway session is not authenticated. " +
        "Open the gateway URL in a browser and log in again (sessions last ~24h)."
    );
    this.name = "IbkrNotAuthenticatedError";
  }
}

/**
 * IBKR Client Portal Web API client.
 *
 * Requires the Client Portal Gateway (Java binary in ibkr/) to be running and
 * authenticated. The gateway itself handles session keep-alive; brokerage
 * sessions expire roughly daily and need an interactive re-login with 2FA.
 */
export class IbkrClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    const url = baseUrl || env.IBKR_GATEWAY_URL;
    if (!url) {
      throw new Error("IBKR gateway URL is not configured (IBKR_GATEWAY_URL)");
    }
    this.baseUrl = url.replace(/\/+$/, "");
  }

  private async request<T>(path: string): Promise<T> {
    let response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        dispatcher: insecureAgent,
        headers: { Accept: "application/json" },
      });
    } catch (error) {
      throw new Error(
        `IBKR gateway unreachable at ${this.baseUrl}: ${error instanceof Error ? error.message : error}`
      );
    }

    if (response.status === 401) {
      throw new IbkrNotAuthenticatedError();
    }

    if (!response.ok) {
      throw new Error(`IBKR API error: ${response.status} for ${path}`);
    }

    return (await response.json()) as T;
  }

  /**
   * Check gateway authentication status. Never throws on 401 —
   * returns { authenticated: false, connected: false } instead.
   */
  async getAuthStatus(): Promise<IbkrAuthStatus> {
    try {
      return await this.request<IbkrAuthStatus>("/v1/api/iserver/auth/status");
    } catch (error) {
      if (error instanceof IbkrNotAuthenticatedError) {
        return { authenticated: false, connected: false };
      }
      throw error;
    }
  }

  /**
   * List brokerage accounts accessible with the current session.
   */
  async getAccounts(): Promise<IbkrAccount[]> {
    return this.request<IbkrAccount[]>("/v1/api/portfolio/accounts");
  }

  /**
   * Get all positions for an account, following pagination.
   * GET /v1/api/portfolio/{accountId}/positions/{pageId}
   *
   * The gateway sometimes returns slim payloads (missing name/type/ticker)
   * while its contract cache warms up; those are enriched via /trsrv/secdef.
   */
  async getPositions(accountId: string): Promise<IbkrPositionInfo[]> {
    const raw: IbkrPosition[] = [];
    let page = 0;

    for (;;) {
      const batch = await this.request<IbkrPosition[]>(
        `/v1/api/portfolio/${encodeURIComponent(accountId)}/positions/${page}`
      );

      if (!Array.isArray(batch) || batch.length === 0) break;
      raw.push(...batch);
      page++;
    }

    const enriched = await this.enrichContracts(raw);

    return raw.map((position, i) => ({
      accountId: position.acctId ?? accountId,
      conid: String(position.conid),
      ticker: enriched[i].ticker ?? position.contractDesc ?? String(position.conid),
      name:
        enriched[i].name ?? position.contractDesc ?? enriched[i].ticker ?? String(position.conid),
      assetClass: position.assetClass,
      instrumentType: enriched[i].type ?? null,
      shares: position.position,
      price: position.mktPrice,
      value: position.mktValue,
      avgCost: position.avgCost,
      currency: position.currency,
    }));
  }

  /**
   * Fill in missing contract fields (ticker, name, type) from
   * GET /v1/api/trsrv/secdef?conids=... — one batch call for all positions.
   */
  private async enrichContracts(
    positions: IbkrPosition[]
  ): Promise<Array<{ ticker?: string; name?: string; type?: string }>> {
    const incomplete = positions.filter((p) => !p.ticker || !p.name || !p.type);
    if (incomplete.length === 0) {
      return positions.map((p) => ({ ticker: p.ticker, name: p.name, type: p.type }));
    }

    let secdefMap = new Map<number, { ticker?: string; name?: string; type?: string }>();
    try {
      const conids = [...new Set(incomplete.map((p) => p.conid))].join(",");
      const response = await this.request<{
        secdef?: Array<{ conid: number; ticker?: string; name?: string; type?: string }>;
      }>(`/v1/api/trsrv/secdef?conids=${conids}`);

      secdefMap = new Map((response.secdef ?? []).map((c) => [c.conid, c]));
    } catch {}

    return positions.map((p) => {
      const extra = secdefMap.get(p.conid);
      return {
        ticker: p.ticker ?? extra?.ticker,
        name: p.name ?? extra?.name,
        type: p.type ?? extra?.type,
      };
    });
  }
}

let ibkrClientInstance: IbkrClient | null = null;

/**
 * Get a singleton IBKR client instance
 */
export function getIbkrClient(): IbkrClient {
  if (!ibkrClientInstance) {
    ibkrClientInstance = new IbkrClient();
  }
  return ibkrClientInstance;
}

/**
 * Check if the IBKR integration is configured (gateway URL set)
 */
export function isIbkrConfigured(): boolean {
  return !!env.IBKR_GATEWAY_URL;
}

/**
 * The configured gateway URL, or null when the integration is disabled
 */
export function getIbkrGatewayUrl(): string | null {
  return env.IBKR_GATEWAY_URL ?? null;
}

/**
 * Browser-reachable gateway URL for re-login links in the UI.
 * Falls back to the internal gateway URL when no public one is configured.
 */
export function getIbkrGatewayPublicUrl(): string | null {
  return env.IBKR_GATEWAY_PUBLIC_URL ?? env.IBKR_GATEWAY_URL ?? null;
}
