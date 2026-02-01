import { auth } from "@/lib/server/auth";
import {
  getIndexaPortfolioSummary,
  getIndexaPortfolioHistory,
  getIndexaHoldings,
  isIndexaConfigured,
} from "@/lib/server/indexa";
import { InvestmentsContent } from "./investments-content";

export default async function InvestmentsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  // Check if Indexa is configured
  const indexaEnabled = isIndexaConfigured();

  if (!indexaEnabled) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
        <h2 className="text-xl font-semibold mb-2">Investments Not Configured</h2>
        <p className="text-muted-foreground max-w-md">
          To view your investment portfolio, configure Indexa Capital integration in your
          environment variables.
        </p>
      </div>
    );
  }

  // Fetch all investment data in parallel
  const [portfolioSummary, portfolioHistory, holdings] = await Promise.all([
    getIndexaPortfolioSummary(session.user.id),
    getIndexaPortfolioHistory(session.user.id, 365),
    getIndexaHoldings(session.user.id),
  ]);

  // Serialize dates for client component
  const serializedHistory = portfolioHistory.map((point) => ({
    ...point,
    date: point.date.toISOString(),
  }));

  const serializedAccounts = portfolioSummary?.accounts.map((account) => ({
    ...account,
    lastSyncAt: account.lastSyncAt?.toISOString() || null,
  }));

  return (
    <InvestmentsContent
      summary={
        portfolioSummary
          ? {
              ...portfolioSummary,
              accounts: serializedAccounts || [],
            }
          : null
      }
      history={serializedHistory}
      holdings={holdings}
    />
  );
}
