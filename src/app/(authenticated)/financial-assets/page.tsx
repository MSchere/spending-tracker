import { auth } from "@/lib/server/auth";
import {
  getFinancialAssets,
  getFinancialAssetsTotals,
  isAlphaVantageConfigured,
} from "@/lib/server/alphavantage";
import { FinancialAssetsContent } from "./financial-assets-content";

export default async function FinancialAssetsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const [assets, totals] = await Promise.all([
    getFinancialAssets(session.user.id),
    getFinancialAssetsTotals(session.user.id),
  ]);

  const isApiConfigured = isAlphaVantageConfigured();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Stocks & Crypto</h1>
        <p className="text-muted-foreground">Track your stock, ETF, and cryptocurrency holdings</p>
      </div>

      <FinancialAssetsContent
        initialAssets={assets}
        initialTotals={totals}
        isApiConfigured={isApiConfigured}
      />
    </div>
  );
}
