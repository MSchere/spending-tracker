import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/server/auth";
import {
  getAlphaVantageClient,
  isAlphaVantageConfigured,
  COMMON_CRYPTO_SYMBOLS,
} from "@/lib/server/alphavantage";

/**
 * GET /api/financial-assets/search?q=apple&type=stock
 * Search for stock/crypto symbols
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");
    const type = searchParams.get("type"); // "stock", "crypto", or undefined for both

    if (!query || query.length < 1) {
      return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 });
    }

    // For crypto, search our predefined list (no API call needed)
    if (type === "crypto" || type === "CRYPTO") {
      const lowerQuery = query.toLowerCase();
      const matches = COMMON_CRYPTO_SYMBOLS.filter(
        (c) =>
          c.symbol.toLowerCase().includes(lowerQuery) || c.name.toLowerCase().includes(lowerQuery)
      ).map((c) => ({
        symbol: c.symbol,
        name: c.name,
        type: "CRYPTO" as const,
        region: "Global",
        currency: "USD",
        matchScore: c.symbol.toLowerCase() === lowerQuery ? 1 : 0.8,
      }));

      return NextResponse.json({ results: matches });
    }

    // For stocks/ETFs, use Alpha Vantage API
    if (!isAlphaVantageConfigured()) {
      return NextResponse.json({ error: "Alpha Vantage API not configured" }, { status: 503 });
    }

    const client = getAlphaVantageClient();
    const results = await client.searchSymbols(query);

    // Map to our format and filter by type if specified
    const mappedResults = results
      .filter((r) => {
        if (!type || type === "all") return true;
        if (type === "stock" || type === "STOCK") return r.type === "Equity";
        if (type === "etf" || type === "ETF") return r.type === "ETF";
        return true;
      })
      .map((r) => ({
        symbol: r.symbol,
        name: r.name,
        type: r.type === "ETF" ? ("ETF" as const) : ("STOCK" as const),
        region: r.region,
        currency: r.currency,
        matchScore: r.matchScore,
      }))
      .slice(0, 10); // Limit results

    return NextResponse.json({ results: mappedResults });
  } catch (error) {
    console.error("Symbol search error:", error);

    // Handle rate limit errors gracefully
    if (error instanceof Error && error.message.includes("Rate limit")) {
      return NextResponse.json(
        { error: "API rate limit reached. Please try again later." },
        { status: 429 }
      );
    }

    return NextResponse.json({ error: "Failed to search symbols" }, { status: 500 });
  }
}
