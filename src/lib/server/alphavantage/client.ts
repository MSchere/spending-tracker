import { env } from "@/env";
import type {
  AlphaVantageGlobalQuote,
  AlphaVantageCryptoRate,
  AlphaVantageSearchResult,
  AlphaVantageTimeSeries,
  AlphaVantageCryptoDaily,
  AlphaVantageError,
  StockQuote,
  CryptoQuote,
  SymbolSearchMatch,
  PriceHistoryPoint,
} from "./types";

const ALPHA_VANTAGE_API_URL = "https://www.alphavantage.co/query";

// Simple rate limiter - 1 request per second
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1100; // 1.1 seconds to be safe

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

/**
 * Alpha Vantage API Client
 */
export class AlphaVantageClient {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || env.ALPHA_VANTAGE_API_KEY || "";
    if (!this.apiKey) {
      throw new Error("Alpha Vantage API key is required");
    }
  }

  /**
   * Make a request to the Alpha Vantage API
   */
  private async request<T>(params: Record<string, string>): Promise<T> {
    await waitForRateLimit();

    const url = new URL(ALPHA_VANTAGE_API_URL);
    url.searchParams.set("apikey", this.apiKey);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Alpha Vantage API error: ${response.status}`);
    }

    const data = (await response.json()) as T & AlphaVantageError;

    // Check for API errors
    if (data["Error Message"]) {
      throw new Error(data["Error Message"]);
    }
    if (data.Note) {
      // Rate limit hit
      throw new Error(`Rate limit exceeded: ${data.Note}`);
    }
    if (data.Information) {
      throw new Error(data.Information);
    }

    return data;
  }

  async getGlobalQuoteRaw(symbol: string): Promise<AlphaVantageGlobalQuote> {
    return this.request<AlphaVantageGlobalQuote>({
      function: "GLOBAL_QUOTE",
      symbol: symbol.toUpperCase(),
    });
  }

  /**
   * Get current stock/ETF quote (transformed)
   * Optionally converts to target currency using forex rates
   */
  async getStockQuote(symbol: string, targetCurrency?: string): Promise<StockQuote> {
    const raw = await this.getGlobalQuoteRaw(symbol);
    const quote = raw["Global Quote"];

    if (!quote || !quote["05. price"]) {
      throw new Error(`No quote found for symbol: ${symbol}`);
    }

    let price = parseFloat(quote["05. price"]);
    let change = parseFloat(quote["09. change"]);
    let previousClose = parseFloat(quote["08. previous close"]);

    // US stocks are in USD - convert if target currency is different
    if (targetCurrency && targetCurrency !== "USD") {
      const forexRate = await this.getForexRate("USD", targetCurrency);
      price = price * forexRate;
      change = change * forexRate;
      previousClose = previousClose * forexRate;
    }

    return {
      symbol: quote["01. symbol"],
      price,
      change,
      changePercent: parseFloat(quote["10. change percent"].replace("%", "")),
      latestTradingDay: quote["07. latest trading day"],
      previousClose,
    };
  }

  /**
   * Get forex exchange rate between two currencies
   */
  async getForexRate(fromCurrency: string, toCurrency: string): Promise<number> {
    if (fromCurrency === toCurrency) return 1;

    const raw = await this.getCryptoRateRaw(fromCurrency, toCurrency);
    const rate = raw["Realtime Currency Exchange Rate"];

    if (!rate || !rate["5. Exchange Rate"]) {
      throw new Error(`No forex rate found for ${fromCurrency}/${toCurrency}`);
    }

    return parseFloat(rate["5. Exchange Rate"]);
  }

  /**
   * Get stock/ETF daily price history (raw API response)
   */
  async getTimeSeriesDailyRaw(
    symbol: string,
    outputSize: "compact" | "full" = "compact"
  ): Promise<AlphaVantageTimeSeries> {
    return this.request<AlphaVantageTimeSeries>({
      function: "TIME_SERIES_DAILY",
      symbol: symbol.toUpperCase(),
      outputsize: outputSize,
    });
  }

  /**
   * Get stock/ETF daily price history (transformed)
   * compact = last 100 days, full = 20+ years
   */
  async getStockHistory(
    symbol: string,
    outputSize: "compact" | "full" = "compact"
  ): Promise<PriceHistoryPoint[]> {
    const raw = await this.getTimeSeriesDailyRaw(symbol, outputSize);
    const timeSeries = raw["Time Series (Daily)"];

    if (!timeSeries) {
      throw new Error(`No price history found for symbol: ${symbol}`);
    }

    const points: PriceHistoryPoint[] = [];
    for (const [date, data] of Object.entries(timeSeries)) {
      points.push({
        date,
        open: parseFloat(data["1. open"]),
        high: parseFloat(data["2. high"]),
        low: parseFloat(data["3. low"]),
        close: parseFloat(data["4. close"]),
        volume: parseFloat(data["5. volume"]),
      });
    }

    // Sort by date ascending
    points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return points;
  }

  async getCryptoRateRaw(
    fromCurrency: string,
    toCurrency: string = "USD"
  ): Promise<AlphaVantageCryptoRate> {
    return this.request<AlphaVantageCryptoRate>({
      function: "CURRENCY_EXCHANGE_RATE",
      from_currency: fromCurrency.toUpperCase(),
      to_currency: toCurrency.toUpperCase(),
    });
  }

  /**
   * Get current crypto exchange rate (transformed)
   */
  async getCryptoQuote(symbol: string, toCurrency: string = "USD"): Promise<CryptoQuote> {
    const raw = await this.getCryptoRateRaw(symbol, toCurrency);
    const rate = raw["Realtime Currency Exchange Rate"];

    if (!rate || !rate["5. Exchange Rate"]) {
      throw new Error(`No rate found for crypto: ${symbol}`);
    }

    return {
      symbol: rate["1. From_Currency Code"],
      price: parseFloat(rate["5. Exchange Rate"]),
      lastRefreshed: rate["6. Last Refreshed"],
    };
  }

  /**
   * Get crypto daily price history (raw API response)
   */
  async getCryptoDailyRaw(
    symbol: string,
    market: string = "USD"
  ): Promise<AlphaVantageCryptoDaily> {
    return this.request<AlphaVantageCryptoDaily>({
      function: "DIGITAL_CURRENCY_DAILY",
      symbol: symbol.toUpperCase(),
      market: market.toUpperCase(),
    });
  }

  /**
   * Get crypto daily price history (transformed)
   */
  async getCryptoHistory(symbol: string, market: string = "USD"): Promise<PriceHistoryPoint[]> {
    const raw = await this.getCryptoDailyRaw(symbol, market);
    const timeSeries = raw["Time Series (Digital Currency Daily)"];

    if (!timeSeries) {
      throw new Error(`No price history found for crypto: ${symbol}`);
    }

    const points: PriceHistoryPoint[] = [];
    for (const [date, data] of Object.entries(timeSeries)) {
      points.push({
        date,
        open: parseFloat(data["1. open"]),
        high: parseFloat(data["2. high"]),
        low: parseFloat(data["3. low"]),
        close: parseFloat(data["4. close"]),
        volume: parseFloat(data["5. volume"]),
      });
    }

    // Sort by date ascending
    points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return points;
  }

  async symbolSearchRaw(keywords: string): Promise<AlphaVantageSearchResult> {
    return this.request<AlphaVantageSearchResult>({
      function: "SYMBOL_SEARCH",
      keywords,
    });
  }

  /**
   * Search for symbols (transformed)
   */
  async searchSymbols(keywords: string): Promise<SymbolSearchMatch[]> {
    const raw = await this.symbolSearchRaw(keywords);

    if (!raw.bestMatches) {
      return [];
    }

    return raw.bestMatches.map((match) => ({
      symbol: match["1. symbol"],
      name: match["2. name"],
      type: match["3. type"],
      region: match["4. region"],
      currency: match["8. currency"],
      matchScore: parseFloat(match["9. matchScore"]),
    }));
  }
}

let alphaVantageClientInstance: AlphaVantageClient | null = null;

/**
 * Get a singleton Alpha Vantage client instance
 */
export function getAlphaVantageClient(): AlphaVantageClient {
  if (!alphaVantageClientInstance) {
    alphaVantageClientInstance = new AlphaVantageClient();
  }
  return alphaVantageClientInstance;
}

/**
 * Check if Alpha Vantage integration is configured
 */
export function isAlphaVantageConfigured(): boolean {
  return !!env.ALPHA_VANTAGE_API_KEY;
}
