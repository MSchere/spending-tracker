/**
 * CoinGecko API Client
 * Free API with good crypto coverage - used as fallback when Alpha Vantage fails
 * Docs: https://docs.coingecko.com/v3.0.1/reference/introduction
 */

const COINGECKO_API_URL = "https://api.coingecko.com/api/v3";

// Rate limiter for CoinGecko free tier (10-30 calls/min)
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2500; // 2.5 seconds to be safe

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
    );
  }
  lastRequestTime = Date.now();
}

// Map common crypto symbols to CoinGecko IDs
// CoinGecko uses IDs like "bitcoin" instead of symbols like "BTC"
export const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  XRP: "ripple",
  DOGE: "dogecoin",
  ADA: "cardano",
  AVAX: "avalanche-2",
  DOT: "polkadot",
  MATIC: "matic-network",
  LINK: "chainlink",
  UNI: "uniswap",
  LTC: "litecoin",
  XMR: "monero",
  ATOM: "cosmos",
  XLM: "stellar",
  ALGO: "algorand",
  NEAR: "near",
  APT: "aptos",
  ARB: "arbitrum",
  OP: "optimism",
  FIL: "filecoin",
  ICP: "internet-computer",
  VET: "vechain",
  HBAR: "hedera-hashgraph",
  IMX: "immutable-x",
  INJ: "injective-protocol",
  RUNE: "thorchain",
  GRT: "the-graph",
  MKR: "maker",
  AAVE: "aave",
  CRV: "curve-dao-token",
  SNX: "synthetix-network-token",
  COMP: "compound-governance-token",
  LDO: "lido-dao",
  RPL: "rocket-pool",
  PEPE: "pepe",
  SHIB: "shiba-inu",
  FLOKI: "floki",
  BONK: "bonk",
};

export interface CoinGeckoPrice {
  symbol: string;
  price: number;
  lastUpdated: string;
}

export interface CoinGeckoSimplePrice {
  [id: string]: {
    usd?: number;
    eur?: number;
    last_updated_at?: number;
  };
}

/**
 * CoinGecko API Client
 */
export class CoinGeckoClient {
  /**
   * Make a request to the CoinGecko API
   */
  private async request<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    await waitForRateLimit();

    const url = new URL(`${COINGECKO_API_URL}${endpoint}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("CoinGecko rate limit exceeded");
      }
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Get crypto price by CoinGecko ID
   */
  async getPriceById(coinId: string, currency: string = "usd"): Promise<CoinGeckoPrice> {
    const data = await this.request<CoinGeckoSimplePrice>("/simple/price", {
      ids: coinId,
      vs_currencies: currency.toLowerCase(),
      include_last_updated_at: "true",
    });

    const coinData = data[coinId];
    if (!coinData) {
      throw new Error(`No price data found for: ${coinId}`);
    }

    const price = coinData[currency.toLowerCase() as keyof typeof coinData] as number | undefined;
    if (price === undefined) {
      throw new Error(`No ${currency} price found for: ${coinId}`);
    }

    return {
      symbol: coinId,
      price,
      lastUpdated: coinData.last_updated_at
        ? new Date(coinData.last_updated_at * 1000).toISOString()
        : new Date().toISOString(),
    };
  }

  /**
   * Get crypto price by symbol (e.g., "BTC", "XMR")
   * Uses the symbol-to-id mapping
   */
  async getPriceBySymbol(symbol: string, currency: string = "usd"): Promise<CoinGeckoPrice> {
    const coinId = SYMBOL_TO_COINGECKO_ID[symbol.toUpperCase()];
    if (!coinId) {
      throw new Error(
        `Unknown crypto symbol: ${symbol}. Add it to SYMBOL_TO_COINGECKO_ID mapping.`
      );
    }

    const result = await this.getPriceById(coinId, currency);
    return {
      ...result,
      symbol: symbol.toUpperCase(),
    };
  }

  /**
   * Check if a symbol is supported
   */
  isSymbolSupported(symbol: string): boolean {
    return symbol.toUpperCase() in SYMBOL_TO_COINGECKO_ID;
  }
}

// Singleton instance
let clientInstance: CoinGeckoClient | null = null;

export function getCoinGeckoClient(): CoinGeckoClient {
  if (!clientInstance) {
    clientInstance = new CoinGeckoClient();
  }
  return clientInstance;
}
