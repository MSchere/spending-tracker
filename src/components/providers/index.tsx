"use client";

import { ThemeProvider } from "./theme-provider";
import { AuthProvider } from "./auth-provider";
import { SyncProvider } from "./sync-provider";
import { Toaster } from "@/components/ui/sonner";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AuthProvider>
        <SyncProvider>
          {children}
          <Toaster richColors position="top-right" />
        </SyncProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export { useSync } from "./sync-provider";
