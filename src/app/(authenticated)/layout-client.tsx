"use client";

import Link from "next/link";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { PrivateModeProvider, usePrivateMode } from "@/components/providers/private-mode-provider";
import {
  PreferencesProvider,
  type UserPreferences,
} from "@/components/providers/preferences-provider";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, PiggyBank } from "lucide-react";

function PrivateModeToggle() {
  const { isPrivate, togglePrivateMode } = usePrivateMode();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={togglePrivateMode}
      title={isPrivate ? "Show balances" : "Hide balances"}
    >
      {isPrivate ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      <span className="sr-only">{isPrivate ? "Show balances" : "Hide balances"}</span>
    </Button>
  );
}

interface AuthenticatedLayoutClientProps {
  children: React.ReactNode;
  initialPreferences: UserPreferences;
}

export function AuthenticatedLayoutClient({
  children,
  initialPreferences,
}: AuthenticatedLayoutClientProps) {
  return (
    <PreferencesProvider initialPreferences={initialPreferences}>
      <PrivateModeProvider>
        <SidebarProvider>
          <header className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center gap-4 border-b bg-sidebar px-4 lg:px-6">
            <SidebarTrigger className="-ml-1" />
            <Link href="/dashboard" className="flex items-center gap-2">
              <PiggyBank className="h-6 w-6 text-gold" />
              <span className="font-semibold text-gold text-lg">Spending Tracker</span>
            </Link>
            <div className="flex-1" />
            <PrivateModeToggle />
            <ThemeToggle />
          </header>
          <AppSidebar />
          <div className="flex-1 flex flex-col min-h-screen w-full pt-14 overflow-x-hidden">
            <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">{children}</main>
          </div>
        </SidebarProvider>
      </PrivateModeProvider>
    </PreferencesProvider>
  );
}
