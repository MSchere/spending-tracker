"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SummaryCard } from "@/components/ui/summary-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PortfolioEvolutionChart } from "@/components/charts/portfolio-evolution-chart";
import { HoldingsChart } from "@/components/charts/holdings-chart";
import { useTableSort } from "@/hooks/use-table-sort";
import {
  Plus,
  Loader2,
  Trash2,
  Pencil,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertTriangle,
  Search,
  Wallet,
  DollarSign,
  Landmark,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrivateMode } from "@/components/providers/private-mode-provider";
import { usePreferences } from "@/components/providers/preferences-provider";
import type { FinancialAssetSummary } from "@/lib/server/alphavantage";
import type { SourceBreakdown, PortfolioHistoryPoint } from "@/lib/server/portfolio";
import type { AssetSource } from "@prisma/client";

// Asset type configuration
const ASSET_TYPES = [
  { value: "STOCK", label: "Stock", description: "Individual company shares" },
  { value: "ETF", label: "ETF", description: "Exchange-traded fund" },
  { value: "FUND", label: "Fund", description: "Mutual / index fund" },
  { value: "CRYPTO", label: "Crypto", description: "Cryptocurrency" },
] as const;

const SOURCE_LABELS: Record<AssetSource, string> = {
  MANUAL: "Manual",
  INDEXA: "Indexa",
  IBKR: "IBKR",
};

type HoldingsSortKey =
  "name" | "type" | "source" | "shares" | "price" | "value" | "gainLoss" | "weight";

interface SearchResult {
  symbol: string;
  name: string;
  type: "STOCK" | "ETF" | "CRYPTO";
  region: string;
  currency: string;
  matchScore: number;
}

interface Integrations {
  alphaVantage: boolean;
  indexa: boolean;
  ibkr: boolean;
  ibkrAuthenticated: boolean;
}

interface FinancialAssetsContentProps {
  assets: FinancialAssetSummary[];
  totalValue: number;
  totalCost: number | null;
  totalGainLoss: number | null;
  totalGainLossPercent: number | null;
  bySource: SourceBreakdown[];
  history: PortfolioHistoryPoint[];
  integrations: Integrations;
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function FinancialAssetsContent({
  assets,
  totalValue,
  totalCost,
  totalGainLoss,
  totalGainLossPercent,
  bySource,
  history,
  integrations,
}: FinancialAssetsContentProps) {
  const router = useRouter();
  const { isPrivate } = usePrivateMode();
  const { formatCurrency, preferences } = usePreferences();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingAsset, setEditingAsset] = useState<FinancialAssetSummary | null>(null);
  const [sourceFilter, setSourceFilter] = useState<"ALL" | AssetSource>("ALL");

  // Form state
  const [assetType, setAssetType] = useState<"STOCK" | "ETF" | "CRYPTO" | "FUND">("STOCK");
  const [ticker, setTicker] = useState("");
  const [isin, setIsin] = useState("");
  const [name, setName] = useState("");
  const [shares, setShares] = useState("");
  const [avgCostBasis, setAvgCostBasis] = useState("");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  function resetForm() {
    setAssetType("STOCK");
    setTicker("");
    setIsin("");
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

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery && !editingAsset) {
        searchSymbols(searchQuery, assetType);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, assetType, searchSymbols, editingAsset]);

  function selectSearchResult(result: SearchResult) {
    setTicker(result.symbol);
    setName(result.name);
    setAssetType(result.type);
    setSearchResults([]);
    setSearchQuery("");
  }

  function openEditDialog(asset: FinancialAssetSummary) {
    setEditingAsset(asset);
    setAssetType(asset.type as "STOCK" | "ETF" | "CRYPTO" | "FUND");
    setTicker(asset.ticker);
    setIsin(asset.isin ?? "");
    setName(asset.name);
    setShares(String(asset.shares));
    setAvgCostBasis(asset.avgCostBasis != null ? String(asset.avgCostBasis) : "");
    setIsDialogOpen(true);
  }

  async function handleSubmit() {
    if (!ticker || !name || !shares || !avgCostBasis) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        ticker: ticker.toUpperCase(),
        isin: isin ? isin.toUpperCase() : undefined,
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
        const data = await response.json();
        throw new Error(data.error || "Failed to delete asset");
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
    if (!integrations.alphaVantage) {
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

  const isGain = (totalGainLoss ?? 0) >= 0;
  const manualAssets = assets.filter((a) => a.source === "MANUAL");
  const filteredAssets =
    sourceFilter === "ALL" ? assets : assets.filter((a) => a.source === sourceFilter);

  const {
    sorted: sortedAssets,
    sortKey,
    sortDir,
    toggleSort,
  } = useTableSort<FinancialAssetSummary, HoldingsSortKey>(
    filteredAssets,
    (a, key): string | number | null => {
      switch (key) {
        case "name":
          return a.name.toLowerCase();
        case "type":
          return a.type;
        case "source":
          return a.source;
        case "shares":
          return a.shares;
        case "price":
          return a.lastPrice;
        case "value":
          return a.currentValue;
        case "gainLoss":
          return a.gainLoss;
        case "weight":
          return totalValue > 0 ? (a.currentValue / totalValue) * 100 : 0;
        default:
          return null;
      }
    },
    "value",
    "desc",
    { ascColumns: ["name", "type", "source"] }
  );

  // Allocation pie data (by asset, sorted desc)
  const allocationData = [...assets]
    .sort((a, b) => b.currentValue - a.currentValue)
    .map((asset) => ({
      instrumentName: asset.name,
      instrumentType: asset.type,
      totalValue: asset.currentValue,
      weight: totalValue > 0 ? (asset.currentValue / totalValue) * 100 : 0,
    }));

  // Evolution chart data
  const chartHistory = history
    .filter((point) => point.totalValue > 0)
    .map((point) => ({
      date: new Date(point.date),
      totalValue: point.totalValue,
      totalInvested: point.totalInvested ?? 0,
      returns: point.totalInvested != null ? point.totalValue - point.totalInvested : 0,
      returnsPercent: 0,
    }));

  return (
    <>
      {integrations.ibkr && !integrations.ibkrAuthenticated && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            IBKR gateway session expired or unreachable. Open the gateway URL (
            {typeof window !== "undefined" ? "https://localhost:5000" : "gateway"}) in a browser and
            log in again, then sync.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          title="Portfolio Value"
          value={isPrivate ? "••••" : formatCurrency(totalValue)}
          description="All investment accounts"
          icon={Wallet}
        />

        <SummaryCard
          title="Total Cost Basis"
          value={
            isPrivate ? "••••" : totalCost != null ? formatCurrency(totalCost) : "Partially known"
          }
          description="Amount invested"
          icon={DollarSign}
        />

        <SummaryCard
          title="Total Gain/Loss"
          value={
            isPrivate ? (
              "••••"
            ) : totalGainLoss != null ? (
              <>
                {formatCurrency(totalGainLoss)}
                <span
                  className={cn(
                    "text-xs font-normal ml-2",
                    isGain ? "text-green-600" : "text-red-600"
                  )}
                >
                  {formatPercent(totalGainLossPercent ?? 0)}
                </span>
              </>
            ) : (
              "N/A"
            )
          }
          description="Overall performance"
          icon={isGain ? TrendingUp : TrendingDown}
          iconColor={isGain ? "text-green-500" : "text-red-500"}
          valueColor={
            totalGainLoss != null ? (isGain ? "text-green-600" : "text-red-600") : undefined
          }
        />
      </div>

      <div className="grid gap-4">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Portfolio Evolution</CardTitle>
            <CardDescription>Value vs invested amount over the past year</CardDescription>
          </CardHeader>
          <CardContent className="overflow-hidden">
            <PortfolioEvolutionChart data={chartHistory} />
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Asset Allocation</CardTitle>
            <CardDescription>Current allocation by holding</CardDescription>
          </CardHeader>
          <CardContent className="overflow-hidden">
            <HoldingsChart data={allocationData} />
          </CardContent>
        </Card>
      </div>

      {bySource.length > 1 && (
        <div className="grid gap-4 md:grid-cols-3">
          {bySource.map((entry) => (
            <Card key={entry.source}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">{SOURCE_LABELS[entry.source]}</CardTitle>
                </div>
                <CardDescription>
                  {entry.assetCount} position{entry.assetCount !== 1 ? "s" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-semibold">
                    {isPrivate ? "••••" : formatCurrency(entry.totalValue)}
                  </span>
                  <span className="text-sm text-muted-foreground">{entry.weight.toFixed(1)}%</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
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
                  : "Add stocks, ETFs, funds, or cryptocurrencies to your portfolio"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="assetType">Asset Type *</Label>
                <Select
                  value={assetType}
                  onValueChange={(v) => {
                    setAssetType(v as "STOCK" | "ETF" | "CRYPTO" | "FUND");
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

              {!editingAsset && integrations.alphaVantage && assetType !== "FUND" && (
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ticker">Ticker *</Label>
                  <Input
                    id="ticker"
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value.toUpperCase())}
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

              <div className="space-y-2">
                <Label htmlFor="isin">ISIN (optional)</Label>
                <Input
                  id="isin"
                  value={isin}
                  onChange={(e) => setIsin(e.target.value.toUpperCase())}
                  placeholder="IE00B4L5Y983"
                  maxLength={12}
                />
              </div>

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
                  <Label htmlFor="avgCostBasis">Avg Cost ({preferences.currency}) *</Label>
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

        {integrations.alphaVantage && manualAssets.length > 0 && (
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

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold">Holdings</h2>
            <p className="text-sm text-muted-foreground">
              All positions across sources — synced positions are read-only
            </p>
          </div>
          <Select
            value={sourceFilter}
            onValueChange={(v) => setSourceFilter(v as "ALL" | AssetSource)}
          >
            <SelectTrigger className="w-35">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All sources</SelectItem>
              {bySource.map((entry) => (
                <SelectItem key={entry.source} value={entry.source}>
                  {SOURCE_LABELS[entry.source]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead
                  label="Holding"
                  column="name"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTableHead
                  label="Type"
                  column="type"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTableHead
                  label="Source"
                  column="source"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTableHead
                  label="Shares"
                  column="shares"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  className="text-right"
                />
                <SortableTableHead
                  label="Price"
                  column="price"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  className="text-right"
                />
                <SortableTableHead
                  label="Value"
                  column="value"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  className="text-right"
                />
                <SortableTableHead
                  label="Gain/Loss"
                  column="gainLoss"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  className="text-right"
                />
                <SortableTableHead
                  label="Weight"
                  column="weight"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  className="text-right"
                />
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAssets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <p className="text-muted-foreground">
                      No positions found. Add an asset or sync your integrations.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                sortedAssets.map((asset) => {
                  const assetGain = (asset.gainLoss ?? 0) >= 0;
                  const weight = totalValue > 0 ? (asset.currentValue / totalValue) * 100 : 0;

                  return (
                    <TableRow key={asset.id}>
                      <TableCell>
                        <div className="font-medium">{asset.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {asset.ticker}
                          {asset.isin && asset.isin !== asset.ticker ? ` · ${asset.isin}` : ""}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{asset.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={asset.source === "MANUAL" ? "outline" : "default"}
                          className="text-xs"
                        >
                          {SOURCE_LABELS[asset.source]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {isPrivate
                          ? "••••"
                          : asset.shares.toLocaleString(undefined, {
                              maximumFractionDigits: 4,
                            })}
                      </TableCell>
                      <TableCell className="text-right">
                        {isPrivate
                          ? "••••"
                          : asset.lastPrice
                            ? formatCurrency(asset.lastPrice, asset.currency)
                            : "N/A"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {isPrivate ? "••••" : formatCurrency(asset.currentValue)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right",
                          asset.gainLoss != null
                            ? assetGain
                              ? "text-green-600"
                              : "text-red-600"
                            : "text-muted-foreground"
                        )}
                      >
                        {isPrivate
                          ? "••••"
                          : asset.gainLoss != null
                            ? `${formatCurrency(asset.gainLoss)} (${formatPercent(asset.gainLossPercent ?? 0)})`
                            : "—"}
                      </TableCell>
                      <TableCell className="text-right">{weight.toFixed(1)}%</TableCell>
                      <TableCell className="text-right">
                        {asset.source === "MANUAL" ? (
                          <div className="flex justify-end gap-1">
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
                        ) : (
                          <span className="text-xs text-muted-foreground">Synced</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
