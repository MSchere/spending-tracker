"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShieldCheck,
  User,
  WifiOff,
  RefreshCw,
  Loader2,
  TrendingUp,
  Coins,
  Settings,
} from "lucide-react";
import { WiseIcon } from "@/components/icons/wise-icon";
import { toast } from "sonner";
import {
  usePreferences,
  AVAILABLE_LOCALES,
  AVAILABLE_CURRENCIES,
} from "@/components/providers/preferences-provider";

interface SettingsFormProps {
  user: {
    id: string;
    email: string;
    name: string | null;
    twoFactorEnabled: boolean;
  } | null;
  appSettings: {
    primaryCurrency: string;
    lastSyncAt: string | null;
  } | null;
  lastSyncStatus: string | null;
  wiseConfigured: boolean;
  indexaConfigured: boolean;
  alphaVantageConfigured: boolean;
}

export function SettingsForm({
  user,
  appSettings,
  lastSyncStatus,
  wiseConfigured,
  indexaConfigured,
  alphaVantageConfigured,
}: SettingsFormProps) {
  const router = useRouter();
  const { preferences, updatePreferences } = usePreferences();
  const [isFullSyncing, setIsFullSyncing] = useState(false);

  async function handleFullSync() {
    setIsFullSyncing(true);
    try {
      const response = await fetch("/api/sync?mode=full", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Full sync failed");
      }

      toast.success("Full sync completed", {
        description: data.summary,
      });
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Full sync failed");
    } finally {
      setIsFullSyncing(false);
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5" />
            <CardTitle>Account</CardTitle>
          </div>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p className="text-sm">{user?.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Name</p>
              <p className="text-sm">{user?.name || "Not set"}</p>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-green-600" />
              <span className="text-sm">Two-Factor Authentication</span>
            </div>
            <Badge variant={user?.twoFactorEnabled ? "default" : "secondary"}>
              {user?.twoFactorEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <CardTitle>Preferences</CardTitle>
          </div>
          <CardDescription>Customize your display settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Display Language</label>
              <Select
                value={preferences.locale}
                onValueChange={(value) => updatePreferences({ locale: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_LOCALES.map((locale) => (
                    <SelectItem key={locale.value} value={locale.value}>
                      {locale.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Used for date and number formatting</p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Default Currency</label>
              <Select
                value={preferences.currency}
                onValueChange={(value) => updatePreferences({ currency: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_CURRENCIES.map((currency) => (
                    <SelectItem key={currency.value} value={currency.value}>
                      {currency.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Used for displaying amounts</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            {wiseConfigured ? (
              <WiseIcon className="h-5 w-5 text-[#9FE870]" />
            ) : (
              <WifiOff className="h-5 w-5 text-muted-foreground" />
            )}
            <CardTitle>Wise Integration</CardTitle>
          </div>
          <CardDescription>Connect to your Wise account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm">API Status</span>
            <Badge variant={wiseConfigured ? "default" : "destructive"}>
              {wiseConfigured ? "Connected" : "Not Configured"}
            </Badge>
          </div>

          {wiseConfigured && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm">Last Sync</span>
                <span className="text-sm text-muted-foreground">
                  {appSettings?.lastSyncAt
                    ? new Date(appSettings.lastSyncAt).toLocaleString(preferences.locale)
                    : "Never"}
                </span>
              </div>

              {lastSyncStatus && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Last Sync Status</span>
                  <Badge variant={lastSyncStatus === "SUCCESS" ? "default" : "destructive"}>
                    {lastSyncStatus}
                  </Badge>
                </div>
              )}
            </>
          )}

          {!wiseConfigured && (
            <p className="text-sm text-muted-foreground">
              To connect Wise, add your API token to the WISE_API_TOKEN environment variable.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp
              className={`h-5 w-5 ${indexaConfigured ? "text-blue-500" : "text-muted-foreground"}`}
            />
            <CardTitle>Indexa Capital Integration</CardTitle>
          </div>
          <CardDescription>Connect to your Indexa Capital investment portfolio</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm">API Status</span>
            <Badge variant={indexaConfigured ? "default" : "destructive"}>
              {indexaConfigured ? "Connected" : "Not Configured"}
            </Badge>
          </div>

          {!indexaConfigured && (
            <p className="text-sm text-muted-foreground">
              To connect Indexa Capital, add your credentials to the environment variables:
              INDEXA_API_TOKEN or INDEXA_USERNAME, INDEXA_PASSWORD, and INDEXA_DOCUMENT.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Coins
              className={`h-5 w-5 ${alphaVantageConfigured ? "text-gold" : "text-muted-foreground"}`}
            />
            <CardTitle>Alpha Vantage Integration</CardTitle>
          </div>
          <CardDescription>Get real-time stock and crypto prices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm">API Status</span>
            <Badge variant={alphaVantageConfigured ? "default" : "destructive"}>
              {alphaVantageConfigured ? "Connected" : "Not Configured"}
            </Badge>
          </div>

          {!alphaVantageConfigured && (
            <p className="text-sm text-muted-foreground">
              To enable stock and crypto price updates, add your API key to the
              ALPHA_VANTAGE_API_KEY environment variable. Get a free API key at{" "}
              <a
                href="https://www.alphavantage.co/support/#api-key"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                alphavantage.co
              </a>
              .
            </p>
          )}

          {alphaVantageConfigured && (
            <p className="text-sm text-muted-foreground">
              Prices for your stocks and crypto assets will be updated automatically during sync.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            <CardTitle>Data Sync</CardTitle>
          </div>
          <CardDescription>Sync all your financial data from connected services</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Full Sync</p>
              <p className="text-xs text-muted-foreground">
                Re-sync all historical data (may take a few minutes)
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleFullSync}
              disabled={
                isFullSyncing || (!wiseConfigured && !indexaConfigured && !alphaVantageConfigured)
              }
            >
              {isFullSyncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Run Full Sync
                </>
              )}
            </Button>
          </div>

          <Separator />

          <p className="text-xs text-muted-foreground">
            Light sync happens automatically on every page load. Use full sync to re-fetch all
            historical data if something is missing.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
