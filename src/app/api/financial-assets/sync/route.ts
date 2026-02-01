import { NextResponse } from "next/server";
import { auth } from "@/lib/server/auth";
import {
  getAlphaVantageClient,
  isAlphaVantageConfigured,
  getFinancialAssets,
  updateAssetPrice,
} from "@/lib/server/alphavantage";

/**
 * POST /api/financial-assets/sync
 * Sync prices for all user's financial assets
 *
 * Due to Alpha Vantage free tier limits (25 req/day), this should be used sparingly
 */
export async function POST() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAlphaVantageConfigured()) {
      return NextResponse.json({ error: "Alpha Vantage API not configured" }, { status: 503 });
    }

    const assets = await getFinancialAssets(session.user.id);

    if (assets.length === 0) {
      return NextResponse.json({ updated: 0, message: "No assets to sync" });
    }

    const client = getAlphaVantageClient();
    let updated = 0;
    const errors: string[] = [];

    // Process assets sequentially to respect rate limits
    for (const asset of assets) {
      try {
        let price: number;

        if (asset.type === "CRYPTO") {
          const quote = await client.getCryptoQuote(asset.symbol);
          price = quote.price;
        } else {
          // STOCK or ETF
          const quote = await client.getStockQuote(asset.symbol);
          price = quote.price;
        }

        await updateAssetPrice(asset.id, price);
        updated++;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        errors.push(`${asset.symbol}: ${message}`);

        // If rate limited, stop processing
        if (message.includes("Rate limit")) {
          errors.push("Rate limit reached - remaining assets skipped");
          break;
        }
      }
    }

    return NextResponse.json({
      updated,
      total: assets.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Sync financial assets error:", error);
    return NextResponse.json({ error: "Failed to sync prices" }, { status: 500 });
  }
}
