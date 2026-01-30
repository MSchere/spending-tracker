"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShieldCheck, User, Wifi, WifiOff } from "lucide-react";

interface SettingsFormProps {
  user: {
    id: string;
    email: string;
    name: string | null;
    twoFactorEnabled: boolean;
  } | null;
  appSettings: {
    primaryCurrency: string;
    emergencyFundMonths: number;
    lastSyncAt: string | null;
  } | null;
  lastSyncStatus: string | null;
  wiseConfigured: boolean;
}

export function SettingsForm({
  user,
  appSettings,
  lastSyncStatus,
  wiseConfigured,
}: SettingsFormProps) {
  return (
    <div className="grid gap-6">
      {/* Account Settings */}
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

      {/* Wise Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            {wiseConfigured ? (
              <Wifi className="h-5 w-5 text-green-600" />
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
                    ? new Date(appSettings.lastSyncAt).toLocaleString()
                    : "Never"}
                </span>
              </div>

              {lastSyncStatus && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Last Sync Status</span>
                  <Badge
                    variant={
                      lastSyncStatus === "SUCCESS" ? "default" : "destructive"
                    }
                  >
                    {lastSyncStatus}
                  </Badge>
                </div>
              )}
            </>
          )}

          {!wiseConfigured && (
            <p className="text-sm text-muted-foreground">
              To connect Wise, add your API token to the WISE_API_TOKEN
              environment variable.
            </p>
          )}
        </CardContent>
      </Card>

      {/* App Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Application Settings</CardTitle>
          <CardDescription>Configure your dashboard preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm">Primary Currency</span>
            <Badge variant="outline">
              {appSettings?.primaryCurrency || "EUR"}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm">Emergency Fund Target</span>
            <span className="text-sm text-muted-foreground">
              {appSettings?.emergencyFundMonths || 6} months of expenses
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
