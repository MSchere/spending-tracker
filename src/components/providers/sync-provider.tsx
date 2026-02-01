"use client";

import { createContext, useCallback, useContext, useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

interface SyncState {
  isSyncing: boolean;
  lastSyncAt: Date | null;
  error: string | null;
}

interface SyncContextValue extends SyncState {
  triggerSync: (mode?: "light" | "full") => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

// Minimum interval between auto light syncs (1 hour)
const AUTO_SYNC_INTERVAL_MS = 60 * 60 * 1000;

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const pathname = usePathname();
  const [syncState, setSyncState] = useState<SyncState>({
    isSyncing: false,
    lastSyncAt: null,
    error: null,
  });
  const hasCheckedSyncRef = useRef(false);
  const isMountedRef = useRef(true);

  const triggerSync = useCallback(
    async (mode: "light" | "full" = "light") => {
      // Prevent duplicate syncs
      if (syncState.isSyncing) return;

      setSyncState((prev) => ({ ...prev, isSyncing: true, error: null }));

      try {
        const response = await fetch(`/api/sync?mode=${mode}`, {
          method: "POST",
        });

        if (!isMountedRef.current) return;

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Sync failed");
        }

        setSyncState({
          isSyncing: false,
          lastSyncAt: new Date(),
          error: null,
        });
      } catch (error) {
        if (!isMountedRef.current) return;
        setSyncState((prev) => ({
          ...prev,
          isSyncing: false,
          error: error instanceof Error ? error.message : "Sync failed",
        }));
      }
    },
    [syncState.isSyncing]
  );

  // Check last sync time from server and auto-sync if stale
  useEffect(() => {
    // Only check once per session
    if (hasCheckedSyncRef.current) return;

    // Only sync for authenticated users
    if (status !== "authenticated") return;

    // Skip sync for auth pages
    if (pathname.startsWith("/login") || pathname.startsWith("/setup")) return;

    hasCheckedSyncRef.current = true;

    // Check server for last sync time
    const checkAndSync = async () => {
      try {
        const response = await fetch("/api/sync");
        if (!response.ok) return;

        const data = await response.json();
        const lastSyncAt = data.lastSyncAt ? new Date(data.lastSyncAt) : null;

        // Update local state with server's last sync time
        if (lastSyncAt) {
          setSyncState((prev) => ({ ...prev, lastSyncAt }));
        }

        // Only auto-sync if data is older than 1 hour
        const now = Date.now();
        const lastSyncTime = lastSyncAt?.getTime() ?? 0;

        if (now - lastSyncTime >= AUTO_SYNC_INTERVAL_MS) {
          triggerSync("light");
        }
      } catch {
        // Sync status check failed silently
      }
    };

    checkAndSync();
  }, [pathname, status, triggerSync]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return (
    <SyncContext.Provider value={{ ...syncState, triggerSync }}>{children}</SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error("useSync must be used within a SyncProvider");
  }
  return context;
}
