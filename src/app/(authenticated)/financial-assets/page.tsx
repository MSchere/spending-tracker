import { auth } from "@/lib/server/auth";
import { isAlphaVantageConfigured } from "@/lib/server/alphavantage";
import { isIbkrConfigured, getIbkrClient } from "@/lib/server/ibkr";
import { isIndexaConfigured } from "@/lib/server/indexa";
import { getPortfolioOverview, getCombinedPortfolioHistory } from "@/lib/server/portfolio";
import { FinancialAssetsContent } from "./financial-assets-content";

export default async function FinancialAssetsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const [overview, history] = await Promise.all([
    getPortfolioOverview(session.user.id),
    getCombinedPortfolioHistory(session.user.id, 365),
  ]);

  // Integration status for banners/badges
  const ibkrEnabled = isIbkrConfigured();
  let ibkrAuthenticated = false;
  if (ibkrEnabled) {
    try {
      const status = await getIbkrClient().getAuthStatus();
      ibkrAuthenticated = status.authenticated;
    } catch {
      ibkrAuthenticated = false; // gateway unreachable
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Financial Assets</h1>
        <p className="text-muted-foreground">Your complete investment portfolio</p>
      </div>

      <FinancialAssetsContent
        assets={overview.assets}
        totalValue={overview.totalValue}
        totalCost={overview.totalCost}
        totalGainLoss={overview.totalGainLoss}
        totalGainLossPercent={overview.totalGainLossPercent}
        bySource={overview.bySource}
        history={history}
        integrations={{
          alphaVantage: isAlphaVantageConfigured(),
          indexa: isIndexaConfigured(),
          ibkr: ibkrEnabled,
          ibkrAuthenticated,
        }}
      />
    </div>
  );
}
