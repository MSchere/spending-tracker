import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/server/auth";
import {
  getFinancialAssets,
  getFinancialAssetsTotals,
  createFinancialAsset,
  getFinancialAssetByTicker,
  updateAssetPrice,
  getAlphaVantageClient,
  isAlphaVantageConfigured,
} from "@/lib/server/alphavantage";
import { FinancialAssetType, type Currency } from "@prisma/client";
import { db } from "@/lib/server/db";

const VALID_TYPES: FinancialAssetType[] = ["STOCK", "CRYPTO", "ETF", "FUND"];

/**
 * GET /api/financial-assets - Get all financial assets for the user
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [assets, totals] = await Promise.all([
      getFinancialAssets(session.user.id),
      getFinancialAssetsTotals(session.user.id),
    ]);

    return NextResponse.json({ assets, totals });
  } catch (error) {
    console.error("Get financial assets error:", error);
    return NextResponse.json({ error: "Failed to get financial assets" }, { status: 500 });
  }
}

/**
 * POST /api/financial-assets - Create a new financial asset
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { ticker, isin, name, type, shares, avgCostBasis, currency } = body;

    if (!ticker || !name || !type || shares === undefined || avgCostBasis === undefined) {
      return NextResponse.json(
        { error: "ticker, name, type, shares, and avgCostBasis are required" },
        { status: 400 }
      );
    }

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    const existing = await getFinancialAssetByTicker(
      session.user.id,
      ticker,
      type as FinancialAssetType
    );

    if (existing) {
      return NextResponse.json(
        { error: `Asset ${ticker} (${type}) already exists. Edit the existing asset instead.` },
        { status: 409 }
      );
    }

    const preferences = await db.userPreferences.findUnique({
      where: { userId: session.user.id },
      select: { currency: true },
    });
    const resolvedCurrency = (currency as Currency) || preferences?.currency || "EUR";

    const asset = await createFinancialAsset({
      userId: session.user.id,
      ticker: ticker.toUpperCase(),
      isin: typeof isin === "string" && isin.length > 0 ? isin.toUpperCase() : undefined,
      name,
      type: type as FinancialAssetType,
      shares: Number(shares),
      avgCostBasis: Number(avgCostBasis),
      currency: resolvedCurrency,
    });

    if (isAlphaVantageConfigured() && type !== "FUND") {
      try {
        const client = getAlphaVantageClient();
        let price: number;

        if (type === "CRYPTO") {
          const quote = await client.getCryptoQuote(ticker, asset.currency);
          price = quote.price;
        } else {
          const quote = await client.getStockQuote(ticker, asset.currency);
          price = quote.price;
        }

        await updateAssetPrice(asset.id, price, asset.currency);
      } catch (priceError) {
        console.warn(`Failed to fetch initial price for ${ticker}:`, priceError);
      }
    }

    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    console.error("Create financial asset error:", error);
    return NextResponse.json({ error: "Failed to create financial asset" }, { status: 500 });
  }
}
