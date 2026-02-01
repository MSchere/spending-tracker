"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  PiggyBank,
  Target,
  CalendarClock,
  Settings,
  LogOut,
  Loader2,
  TrendingUp,
  RefreshCw,
  Package,
  Coins,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useSync } from "@/components/providers";

const navigation = [
  {
    title: "Overview",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { name: "Transactions", href: "/transactions", icon: Receipt },
    ],
  },
  {
    title: "Assets",
    items: [
      { name: "Investments", href: "/investments", icon: TrendingUp },
      { name: "Stocks & Crypto", href: "/financial-assets", icon: Coins },
      { name: "Tangible Assets", href: "/assets", icon: Package },
    ],
  },
  {
    title: "Planning",
    items: [
      { name: "Budgets", href: "/budgets", icon: PiggyBank },
      { name: "Savings Goals", href: "/savings", icon: Target },
      { name: "Recurring", href: "/recurring", icon: CalendarClock },
    ],
  },
  {
    title: "System",
    items: [{ name: "Settings", href: "/settings", icon: Settings }],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isSyncing, triggerSync } = useSync();

  async function handleSync() {
    try {
      await triggerSync("light");
      toast.success("Sync completed");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to sync");
    }
  }

  return (
    <Sidebar>
      <SidebarContent className="pt-4">
        {navigation.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton asChild isActive={pathname === item.href}>
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <div className="flex flex-col gap-2">
          <Button
            size="sm"
            className="w-full justify-start gap-4 bg-gold hover:bg-gold/90 text-black"
            onClick={handleSync}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {isSyncing ? "Syncing..." : "Sync Data"}
          </Button>
          <Separator />
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
