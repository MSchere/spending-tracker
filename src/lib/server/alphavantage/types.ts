/**
 * Global Quote response for stocks/ETFs
 * GET: /query?function=GLOBAL_QUOTE&symbol=IBM
 */
export interface AlphaVantageGlobalQuote {
  "Global Quote": {
    "01. symbol": string;
    "02. open": string;
    "03. high": string;
    "04. low": string;
    "05. price": string;
    "06. volume": string;
    "07. latest trading day": string;
    "08. previous close": string;
    "09. change": string;
    "10. change percent": string;
  };
}

/**
 * Currency Exchange Rate response for crypto
 * GET: /query?function=CURRENCY_EXCHANGE_RATE&from_currency=BTC&to_currency=USD
 */
export interface AlphaVantageCryptoRate {
  "Realtime Currency Exchange Rate": {
    "1. From_Currency Code": string;
    "2. From_Currency Name": string;
    "3. To_Currency Code": string;
    "4. To_Currency Name": string;
    "5. Exchange Rate": string;
    "6. Last Refreshed": string;
    "7. Time Zone": string;
    "8. Bid Price": string;
    "9. Ask Price": string;
  };
}

/**
 * Symbol Search response
 * GET: /query?function=SYMBOL_SEARCH&keywords=apple
 */
export interface AlphaVantageSearchResult {
  bestMatches: Array<{
    "1. symbol": string;
    "2. name": string;
    "3. type": string;
    "4. region": string;
    "5. marketOpen": string;
    "6. marketClose": string;
    "7. timezone": string;
    "8. currency": string;
    "9. matchScore": string;
  }>;
}

/**
 * Time Series Daily response
 * GET: /query?function=TIME_SERIES_DAILY&symbol=IBM&outputsize=compact
 */
export interface AlphaVantageTimeSeries {
  "Meta Data": {
    "1. Information": string;
    "2. Symbol": string;
    "3. Last Refreshed": string;
    "4. Output Size": string;
    "5. Time Zone": string;
  };
  "Time Series (Daily)": Record<
    string,
    {
      "1. open": string;
      "2. high": string;
      "3. low": string;
      "4. close": string;
      "5. volume": string;
    }
  >;
}

/**
 * Digital Currency Daily response
 * GET: /query?function=DIGITAL_CURRENCY_DAILY&symbol=BTC&market=USD
 */
export interface AlphaVantageCryptoDaily {
  "Meta Data": {
    "1. Information": string;
    "2. Digital Currency Code": string;
    "3. Digital Currency Name": string;
    "4. Market Code": string;
    "5. Market Name": string;
    "6. Last Refreshed": string;
    "7. Time Zone": string;
  };
  "Time Series (Digital Currency Daily)": Record<
    string,
    {
      "1. open": string;
      "2. high": string;
      "3. low": string;
      "4. close": string;
      "5. volume": string;
      "6. market cap (USD)": string;
    }
  >;
}

/**
 * Error response from Alpha Vantage
 */
export interface AlphaVantageError {
  "Error Message"?: string;
  Note?: string; // Rate limit message
  Information?: string;
}

export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  latestTradingDay: string;
  previousClose: number;
}

export interface CryptoQuote {
  symbol: string;
  price: number;
  lastRefreshed: string;
}

export interface SymbolSearchMatch {
  symbol: string;
  name: string;
  type: string; // "Equity", "ETF", etc.
  region: string;
  currency: string;
  matchScore: number;
}

export interface PriceHistoryPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const COMMON_CRYPTO_SYMBOLS = [
  { symbol: "BTC", name: "Bitcoin" },
  { symbol: "ETH", name: "Ethereum" },
  { symbol: "SOL", name: "Solana" },
  { symbol: "XRP", name: "XRP" },
  { symbol: "DOGE", name: "Dogecoin" },
  { symbol: "ADA", name: "Cardano" },
  { symbol: "AVAX", name: "Avalanche" },
  { symbol: "DOT", name: "Polkadot" },
  { symbol: "MATIC", name: "Polygon" },
  { symbol: "LINK", name: "Chainlink" },
  { symbol: "UNI", name: "Uniswap" },
  { symbol: "LTC", name: "Litecoin" },
  { symbol: "ATOM", name: "Cosmos" },
  { symbol: "XLM", name: "Stellar" },
  { symbol: "ALGO", name: "Algorand" },
] as const;
