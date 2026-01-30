import { auth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { SettingsForm } from "./settings-form";

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

  return {
    user,
    appSettings: appSettings
      ? {
          primaryCurrency: appSettings.primaryCurrency,
          emergencyFundMonths: appSettings.emergencyFundMonths,
          lastSyncAt: appSettings.lastSyncAt?.toISOString() || null,
        }
      : null,
    lastSyncStatus: lastSync?.status || null,
    wiseConfigured: !!process.env.WISE_API_TOKEN,
  };
}

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const { user, appSettings, lastSyncStatus, wiseConfigured } =
    await getSettingsData(session.user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and application settings
        </p>
      </div>

      <SettingsForm
        user={user}
        appSettings={appSettings}
        lastSyncStatus={lastSyncStatus}
        wiseConfigured={wiseConfigured}
      />
    </div>
  );
}
