"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SummaryCard } from "@/components/ui/summary-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Plus,
  Loader2,
  Trash2,
  Pencil,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Coins,
  BarChart3,
  AlertTriangle,
  Search,
  Wallet,
  DollarSign,
} from "lucide-react";
import { usePrivateMode } from "@/components/providers/private-mode-provider";
import type { FinancialAssetSummary, FinancialAssetsTotals } from "@/lib/server/alphavantage";

// Asset type configuration
const ASSET_TYPES = [
  { value: "STOCK", label: "Stock", description: "Individual company shares" },
  { value: "ETF", label: "ETF", description: "Exchange-traded fund" },
  { value: "CRYPTO", label: "Crypto", description: "Cryptocurrency" },
] as const;

interface SearchResult {
  symbol: string;
  name: string;
  type: "STOCK" | "ETF" | "CRYPTO";
  region: string;
  currency: string;
  matchScore: number;
}

interface FinancialAssetsContentProps {
  initialAssets: FinancialAssetSummary[];
  initialTotals: FinancialAssetsTotals;
  isApiConfigured: boolean;
}

function formatCurrency(value: number, currency = "USD"): string {
  return value.toLocaleString("en-US", { style: "currency", currency });
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function getAssetTypeIcon(type: string) {
  switch (type) {
    case "CRYPTO":
      return Coins;
    case "ETF":
      return BarChart3;
    default:
      return TrendingUp;
  }
}

export function FinancialAssetsContent({
  initialAssets,
  initialTotals,
  isApiConfigured,
}: FinancialAssetsContentProps) {
  const router = useRouter();
  const { isPrivate } = usePrivateMode();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingAsset, setEditingAsset] = useState<FinancialAssetSummary | null>(null);

  // Form state
  const [assetType, setAssetType] = useState<"STOCK" | "ETF" | "CRYPTO">("STOCK");
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [shares, setShares] = useState("");
  const [avgCostBasis, setAvgCostBasis] = useState("");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  function resetForm() {
    setAssetType("STOCK");
    setSymbol("");
    setName("");
    setShares("");
    setAvgCostBasis("");
    setSearchQuery("");
    setSearchResults([]);
    setEditingAsset(null);
  }

  // Debounced search
  const searchSymbols = useCallback(async (query: string, type: string) => {
    if (query.length < 1) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `/api/financial-assets/search?q=${encodeURIComponent(query)}&type=${type}`
      );
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
      }
    } catch {
      // Search failed silently
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery && !editingAsset) {
        searchSymbols(searchQuery, assetType);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, assetType, searchSymbols, editingAsset]);

  function selectSearchResult(result: SearchResult) {
    setSymbol(result.symbol);
    setName(result.name);
    setAssetType(result.type);
    setSearchResults([]);
    setSearchQuery("");
  }

  function openEditDialog(asset: FinancialAssetSummary) {
    setEditingAsset(asset);
    setAssetType(asset.type as "STOCK" | "ETF" | "CRYPTO");
    setSymbol(asset.symbol);
    setName(asset.name);
    setShares(String(asset.shares));
    setAvgCostBasis(String(asset.avgCostBasis));
    setIsDialogOpen(true);
  }

  async function handleSubmit() {
    if (!symbol || !name || !shares || !avgCostBasis) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        symbol: symbol.toUpperCase(),
        name,
        type: assetType,
        shares: parseFloat(shares),
        avgCostBasis: parseFloat(avgCostBasis),
      };

      const url = editingAsset
        ? `/api/financial-assets/${editingAsset.id}`
        : "/api/financial-assets";
      const method = editingAsset ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save asset");
      }

      toast.success(editingAsset ? "Asset updated" : "Asset added");
      setIsDialogOpen(false);
      resetForm();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save asset");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);

    try {
      const response = await fetch(`/api/financial-assets/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete asset");
      }

      toast.success("Asset deleted");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete asset");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSyncPrices() {
    if (!isApiConfigured) {
      toast.error("Alpha Vantage API key not configured");
      return;
    }

    setIsSyncing(true);

    try {
      const response = await fetch("/api/financial-assets/sync", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to sync prices");
      }

      if (data.errors && data.errors.length > 0) {
        toast.warning(`Synced ${data.updated}/${data.total} assets. Some failed.`);
      } else {
        toast.success(`Synced prices for ${data.updated} assets`);
      }

      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to sync prices");
    } finally {
      setIsSyncing(false);
    }
  }

  const isGain = initialTotals.totalGainLoss >= 0;

  return (
    <>
      {/* API Warning */}
      {!isApiConfigured && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Alpha Vantage API key not configured. Price syncing is disabled. Add
            ALPHA_VANTAGE_API_KEY to your environment variables.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          title="Total Value"
          value={isPrivate ? "••••" : formatCurrency(initialTotals.totalValue)}
          description="Current market value"
          icon={Wallet}
        />

        <SummaryCard
          title="Total Cost Basis"
          value={isPrivate ? "••••" : formatCurrency(initialTotals.totalCost)}
          description="Amount invested"
          icon={DollarSign}
        />

        <SummaryCard
          title="Total Gain/Loss"
          value={
            isPrivate
              ? "••••"
              : `${formatCurrency(initialTotals.totalGainLoss)} (${formatPercent(initialTotals.totalGainLossPercent)})`
          }
          description="Overall performance"
          icon={isGain ? TrendingUp : TrendingDown}
          iconColor={isGain ? "text-green-500" : "text-red-500"}
          valueColor={isGain ? "text-green-600" : "text-red-600"}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Asset
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingAsset ? "Edit Asset" : "Add Financial Asset"}</DialogTitle>
              <DialogDescription>
                {editingAsset
                  ? "Update your position details"
                  : "Add stocks, ETFs, or cryptocurrencies to your portfolio"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Asset Type */}
              <div className="space-y-2">
                <Label htmlFor="assetType">Asset Type *</Label>
                <Select
                  value={assetType}
                  onValueChange={(v) => {
                    setAssetType(v as "STOCK" | "ETF" | "CRYPTO");
                    setSearchResults([]);
                  }}
                  disabled={!!editingAsset}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div>
                          <div>{type.label}</div>
                          <div className="text-xs text-muted-foreground">{type.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Symbol Search (only when adding new) */}
              {!editingAsset && isApiConfigured && (
                <div className="space-y-2">
                  <Label htmlFor="search">Search Symbol</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="search"
                      className="pl-9"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={
                        assetType === "CRYPTO" ? "Search BTC, ETH..." : "Search AAPL, VOO..."
                      }
                    />
                    {isSearching && (
                      <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin" />
                    )}
                  </div>
                  {searchResults.length > 0 && (
                    <div className="rounded-md border bg-popover max-h-48 overflow-auto">
                      {searchResults.map((result) => (
                        <button
                          key={`${result.symbol}-${result.type}`}
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-accent flex justify-between items-center"
                          onClick={() => selectSearchResult(result)}
                        >
                          <div>
                            <div className="font-medium">{result.symbol}</div>
                            <div className="text-sm text-muted-foreground">{result.name}</div>
                          </div>
                          <Badge variant="secondary">{result.type}</Badge>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Symbol (manual entry or from search) */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="symbol">Symbol *</Label>
                  <Input
                    id="symbol"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    placeholder="AAPL"
                    disabled={!!editingAsset}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Apple Inc."
                    disabled={!!editingAsset}
                  />
                </div>
              </div>

              {/* Position Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shares">{assetType === "CRYPTO" ? "Amount *" : "Shares *"}</Label>
                  <Input
                    id="shares"
                    type="number"
                    min="0"
                    step="any"
                    value={shares}
                    onChange={(e) => setShares(e.target.value)}
                    placeholder={assetType === "CRYPTO" ? "0.5" : "10"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="avgCostBasis">Avg Cost (USD) *</Label>
                  <Input
                    id="avgCostBasis"
                    type="number"
                    min="0"
                    step="0.01"
                    value={avgCostBasis}
                    onChange={(e) => setAvgCostBasis(e.target.value)}
                    placeholder="150.00"
                  />
                </div>
              </div>

              {/* Total Cost Preview */}
              {shares && avgCostBasis && (
                <div className="rounded-lg bg-muted p-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Cost Basis</span>
                    <span className="font-medium">
                      {formatCurrency(parseFloat(shares) * parseFloat(avgCostBasis))}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingAsset ? "Save Changes" : "Add Asset"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Sync Prices Button */}
        {isApiConfigured && initialAssets.length > 0 && (
          <Button variant="outline" onClick={handleSyncPrices} disabled={isSyncing}>
            {isSyncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {isSyncing ? "Syncing..." : "Sync Prices"}
          </Button>
        )}
      </div>

      {/* Assets List */}
      {initialAssets.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <Coins className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">
                No financial assets yet. Add stocks, ETFs, or crypto to start tracking.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {initialAssets.map((asset) => {
            const TypeIcon = getAssetTypeIcon(asset.type);
            const isGain = asset.gainLoss >= 0;
            const gainLossColorClass = isGain ? "text-green-600" : "text-red-600";
            const lastUpdated = asset.lastPriceAt
              ? format(new Date(asset.lastPriceAt), "MMM d, HH:mm")
              : null;

            return (
              <Card key={asset.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <TypeIcon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <CardTitle className="text-lg">{asset.symbol}</CardTitle>
                        <CardDescription className="truncate max-w-[180px]">
                          {asset.name}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(asset)}
                      >
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDelete(asset.id)}
                        disabled={deletingId === asset.id}
                      >
                        {deletingId === asset.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <Badge variant="secondary" className="w-fit">
                    {asset.type}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Current Value</span>
                    <span className="font-semibold">
                      {isPrivate ? "••••" : formatCurrency(asset.currentValue, asset.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      {asset.type === "CRYPTO" ? "Amount" : "Shares"}
                    </span>
                    <span className="text-sm">
                      {isPrivate ? "••••" : Number(asset.shares).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Avg Cost</span>
                    <span className="text-sm">
                      {isPrivate
                        ? "••••"
                        : formatCurrency(Number(asset.avgCostBasis), asset.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Last Price</span>
                    <span className="text-sm">
                      {isPrivate
                        ? "••••"
                        : asset.lastPrice
                          ? formatCurrency(Number(asset.lastPrice), asset.currency)
                          : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Gain/Loss</span>
                    <span className={`text-sm font-medium ${gainLossColorClass}`}>
                      {isPrivate
                        ? "••••"
                        : `${formatCurrency(asset.gainLoss, asset.currency)} (${formatPercent(asset.gainLossPercent)})`}
                    </span>
                  </div>
                  {lastUpdated && (
                    <div className="text-xs text-muted-foreground text-right">
                      Updated: {lastUpdated}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
