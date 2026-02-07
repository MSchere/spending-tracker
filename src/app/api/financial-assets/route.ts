import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/server/auth";
import {
  getFinancialAssets,
  getFinancialAssetsTotals,
  createFinancialAsset,
  getFinancialAssetBySymbol,
  updateAssetPrice,
  getAlphaVantageClient,
  isAlphaVantageConfigured,
} from "@/lib/server/alphavantage";
import { FinancialAssetType } from "@prisma/client";

const VALID_TYPES: FinancialAssetType[] = ["STOCK", "CRYPTO", "ETF"];

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
    const { symbol, name, type, shares, avgCostBasis, currency } = body;

    // Validate required fields
    if (!symbol || !name || !type || shares === undefined || avgCostBasis === undefined) {
      return NextResponse.json(
        { error: "symbol, name, type, shares, and avgCostBasis are required" },
        { status: 400 }
      );
    }

    // Validate type
    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    // Check if asset already exists
    const existing = await getFinancialAssetBySymbol(
      session.user.id,
      symbol,
      type as FinancialAssetType
    );

    if (existing) {
      return NextResponse.json(
        { error: `Asset ${symbol} (${type}) already exists. Edit the existing asset instead.` },
        { status: 409 }
      );
    }

    const asset = await createFinancialAsset({
      userId: session.user.id,
      symbol: symbol.toUpperCase(),
      name,
      type: type as FinancialAssetType,
      shares: Number(shares),
      avgCostBasis: Number(avgCostBasis),
      currency: currency,
    });

    // Try to fetch initial price (non-blocking, don't fail if it errors)
    if (isAlphaVantageConfigured()) {
      try {
        const client = getAlphaVantageClient();
        let price: number;

        if (type === "CRYPTO") {
          const quote = await client.getCryptoQuote(symbol, currency);
          price = quote.price;
        } else {
          const quote = await client.getStockQuote(symbol, currency);
          price = quote.price;
        }

        await updateAssetPrice(asset.id, price);
      } catch (priceError) {
        // Log but don't fail - asset was created successfully
        console.warn(`Failed to fetch initial price for ${symbol}:`, priceError);
      }
    }

    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    console.error("Create financial asset error:", error);
    return NextResponse.json({ error: "Failed to create financial asset" }, { status: 500 });
  }
}
