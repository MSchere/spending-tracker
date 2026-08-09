import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { SettingsForm } from "./settings-form";
import { isIndexaConfigured } from "@/lib/server/indexa";
import { isAlphaVantageConfigured } from "@/lib/server/alphavantage";
import { isIbkrConfigured, getIbkrClient, getIbkrGatewayPublicUrl } from "@/lib/server/ibkr";

async function getSettingsData(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      twoFactorEnabled: true,
    },
  });

  const appSettings = await db.appSettings.findUnique({
    where: { id: "settings" },
  });

  const lastSync = await db.syncLog.findFirst({
    orderBy: { createdAt: "desc" },
  });

  // IBKR gateway/session status (never throws — gateway may be down)
  const ibkrConfigured = isIbkrConfigured();
  let ibkrReachable = false;
  let ibkrAuthenticated = false;
  if (ibkrConfigured) {
    try {
      const status = await getIbkrClient().getAuthStatus();
      ibkrReachable = true;
      ibkrAuthenticated = status.authenticated;
    } catch {
      ibkrReachable = false;
    }
  }

  const ibkrAssetStats = await db.financialAsset.aggregate({
    where: { userId, source: "IBKR" },
    _count: { id: true },
    _max: { lastPriceAt: true },
  });

  return {
    user,
    appSettings: appSettings
      ? {
          primaryCurrency: appSettings.primaryCurrency,
          lastSyncAt: appSettings.lastSyncAt?.toISOString() || null,
        }
      : null,
    lastSyncStatus: lastSync?.status || null,
    wiseConfigured: !!process.env.WISE_API_TOKEN,
    indexaConfigured: isIndexaConfigured(),
    alphaVantageConfigured: isAlphaVantageConfigured(),
    ibkrStatus: {
      configured: ibkrConfigured,
      gatewayUrl: getIbkrGatewayPublicUrl(),
      reachable: ibkrReachable,
      authenticated: ibkrAuthenticated,
      positionsTracked: ibkrAssetStats._count.id,
      lastUpdateAt: ibkrAssetStats._max.lastPriceAt?.toISOString() ?? null,
    },
  };
}

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const {
    user,
    appSettings,
    lastSyncStatus,
    wiseConfigured,
    indexaConfigured,
    alphaVantageConfigured,
    ibkrStatus,
  } = await getSettingsData(session.user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account and application settings</p>
      </div>

      <SettingsForm
        user={user}
        appSettings={appSettings}
        lastSyncStatus={lastSyncStatus}
        wiseConfigured={wiseConfigured}
        indexaConfigured={indexaConfigured}
        alphaVantageConfigured={alphaVantageConfigured}
        ibkrStatus={ibkrStatus}
      />
    </div>
  );
}
