"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Loader2,
  Trash2,
  Pencil,
  Car,
  Home,
  Laptop,
  Sofa,
  Gem,
  Package,
  TrendingDown,
  Wallet,
  DollarSign,
} from "lucide-react";
import { usePrivateMode } from "@/components/providers/private-mode-provider";
import { usePreferences } from "@/components/providers/preferences-provider";
import type { TangibleAssetSummary, TangibleAssetsTotals } from "@/lib/server/assets";

// Category configuration
const CATEGORIES = [
  { value: "VEHICLE", label: "Vehicle", icon: Car },
  { value: "REAL_ESTATE", label: "Real Estate", icon: Home },
  { value: "ELECTRONICS", label: "Electronics", icon: Laptop },
  { value: "FURNITURE", label: "Furniture", icon: Sofa },
  { value: "JEWELRY", label: "Jewelry", icon: Gem },
  { value: "COLLECTIBLES", label: "Collectibles", icon: Package },
  { value: "OTHER", label: "Other", icon: Package },
] as const;

const DEPRECIATION_METHODS = [
  { value: "STRAIGHT_LINE", label: "Straight Line", description: "Equal depreciation each year" },
  {
    value: "DECLINING_BALANCE",
    label: "Declining Balance",
    description: "Higher depreciation early",
  },
  { value: "NONE", label: "No Depreciation", description: "Value stays constant" },
] as const;

// Category defaults (matching server-side)
const CATEGORY_DEFAULTS: Record<
  string,
  { usefulLifeYears: number | null; salvagePercent: number; method: string }
> = {
  VEHICLE: { usefulLifeYears: 15, salvagePercent: 40, method: "STRAIGHT_LINE" },
  REAL_ESTATE: { usefulLifeYears: null, salvagePercent: 100, method: "NONE" },
  ELECTRONICS: { usefulLifeYears: 5, salvagePercent: 10, method: "DECLINING_BALANCE" },
  FURNITURE: { usefulLifeYears: 10, salvagePercent: 20, method: "STRAIGHT_LINE" },
  JEWELRY: { usefulLifeYears: null, salvagePercent: 100, method: "NONE" },
  COLLECTIBLES: { usefulLifeYears: null, salvagePercent: 100, method: "NONE" },
  OTHER: { usefulLifeYears: 10, salvagePercent: 10, method: "STRAIGHT_LINE" },
};

interface AssetsContentProps {
  initialAssets: TangibleAssetSummary[];
  initialTotals: TangibleAssetsTotals;
}

function getCategoryIcon(category: string) {
  const cat = CATEGORIES.find((c) => c.value === category);
  return cat?.icon ?? Package;
}

function getCategoryLabel(category: string): string {
  const cat = CATEGORIES.find((c) => c.value === category);
  return cat?.label ?? category;
}

export function AssetsContent({ initialAssets, initialTotals }: AssetsContentProps) {
  const router = useRouter();
  const { isPrivate } = usePrivateMode();
  const { formatCurrency, formatDate } = usePreferences();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingAsset, setEditingAsset] = useState<TangibleAssetSummary | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("VEHICLE");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [depreciationMethod, setDepreciationMethod] = useState("STRAIGHT_LINE");
  const [usefulLifeYears, setUsefulLifeYears] = useState("");
  const [salvageValue, setSalvageValue] = useState("");

  function resetForm() {
    setName("");
    setDescription("");
    setCategory("VEHICLE");
    setPurchaseDate("");
    setPurchasePrice("");
    setDepreciationMethod("STRAIGHT_LINE");
    setUsefulLifeYears("");
    setSalvageValue("");
    setEditingAsset(null);
  }

  function handleCategoryChange(newCategory: string) {
    setCategory(newCategory);
    // Auto-fill defaults based on category
    const defaults = CATEGORY_DEFAULTS[newCategory];
    if (defaults) {
      setDepreciationMethod(defaults.method);
      if (defaults.usefulLifeYears) {
        setUsefulLifeYears(defaults.usefulLifeYears.toString());
      } else {
        setUsefulLifeYears("");
      }
      // Calculate salvage value if we have a purchase price
      if (purchasePrice && defaults.salvagePercent < 100) {
        const sv = (parseFloat(purchasePrice) * defaults.salvagePercent) / 100;
        setSalvageValue(sv.toFixed(2));
      }
    }
  }

  function handlePurchasePriceChange(value: string) {
    setPurchasePrice(value);
    // Auto-calculate salvage value based on category
    const defaults = CATEGORY_DEFAULTS[category];
    if (defaults && value && defaults.salvagePercent < 100) {
      const sv = (parseFloat(value) * defaults.salvagePercent) / 100;
      setSalvageValue(sv.toFixed(2));
    }
  }

  function openEditDialog(asset: TangibleAssetSummary) {
    setEditingAsset(asset);
    setName(asset.name);
    setDescription(asset.description ?? "");
    setCategory(asset.category);
    setPurchaseDate(asset.purchaseDate.split("T")[0]);
    setPurchasePrice(asset.purchasePrice.toString());
    setDepreciationMethod(asset.depreciationMethod);
    setUsefulLifeYears(asset.usefulLifeYears?.toString() ?? "");
    setSalvageValue(asset.salvageValue?.toString() ?? "");
    setIsDialogOpen(true);
  }

  async function handleSubmit() {
    if (!name || !category || !purchaseDate || !purchasePrice) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        name,
        description: description || undefined,
        category,
        purchaseDate,
        purchasePrice: parseFloat(purchasePrice),
        depreciationMethod,
        usefulLifeYears: usefulLifeYears ? parseInt(usefulLifeYears) : undefined,
        salvageValue: salvageValue ? parseFloat(salvageValue) : undefined,
      };

      const url = editingAsset ? `/api/assets/${editingAsset.id}` : "/api/assets";
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

      toast.success(editingAsset ? "Asset updated" : "Asset created");
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
      const response = await fetch(`/api/assets/${id}`, {
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

  const showDepreciationSettings = depreciationMethod !== "NONE";

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          title="Total Current Value"
          value={isPrivate ? "••••" : formatCurrency(initialTotals.totalCurrentValue)}
          description="Current estimated worth"
          icon={Wallet}
        />

        <SummaryCard
          title="Total Purchase Price"
          value={isPrivate ? "••••" : formatCurrency(initialTotals.totalPurchasePrice)}
          description="Original cost"
          icon={DollarSign}
        />

        <SummaryCard
          title="Total Depreciation"
          value={
            isPrivate
              ? "••••"
              : `-${formatCurrency(initialTotals.totalDepreciation)} (${initialTotals.depreciationPercent.toFixed(1)}%)`
          }
          description="Value decrease over time"
          icon={TrendingDown}
          iconColor="text-orange-500"
          valueColor="text-orange-600"
        />
      </div>

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
            <DialogTitle>{editingAsset ? "Edit Asset" : "Add Tangible Asset"}</DialogTitle>
            <DialogDescription>
              Track physical assets and their depreciation over time
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <div className="space-y-2">
              <Label htmlFor="name">Asset Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., 2015 Peugeot 308, MacBook Pro 16"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional notes about this asset"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select value={category} onValueChange={handleCategoryChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <div className="flex items-center gap-2">
                        <cat.icon className="h-4 w-4" />
                        {cat.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="purchaseDate">Purchase Date *</Label>
                <Input
                  id="purchaseDate"
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchasePrice">Purchase Price (EUR) *</Label>
                <Input
                  id="purchasePrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={purchasePrice}
                  onChange={(e) => handlePurchasePriceChange(e.target.value)}
                  placeholder="8000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="depreciationMethod">Depreciation Method</Label>
              <Select value={depreciationMethod} onValueChange={setDepreciationMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEPRECIATION_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      <div>
                        <div>{method.label}</div>
                        <div className="text-xs text-muted-foreground">{method.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {showDepreciationSettings && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="usefulLifeYears">Useful Life (Years)</Label>
                  <Input
                    id="usefulLifeYears"
                    type="number"
                    min="1"
                    value={usefulLifeYears}
                    onChange={(e) => setUsefulLifeYears(e.target.value)}
                    placeholder="15"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salvageValue">Salvage Value (EUR)</Label>
                  <Input
                    id="salvageValue"
                    type="number"
                    min="0"
                    step="0.01"
                    value={salvageValue}
                    onChange={(e) => setSalvageValue(e.target.value)}
                    placeholder="3200"
                  />
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

      {initialAssets.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <Package className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">
                No tangible assets yet. Add your first asset to start tracking depreciation.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {initialAssets.map((asset) => {
            const CategoryIcon = getCategoryIcon(asset.category);
            const isDepreciating = asset.depreciation > 0;

            return (
              <Card key={asset.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <CategoryIcon className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-lg">{asset.name}</CardTitle>
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
                  <CardDescription className="flex items-center gap-2">
                    <Badge variant="secondary">{getCategoryLabel(asset.category)}</Badge>
                    <span className="text-xs">
                      Purchased{" "}
                      {formatDate(asset.purchaseDate, { month: "short", year: "numeric" })}
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Current Value</span>
                    <span className="font-semibold">
                      {isPrivate ? "***" : formatCurrency(asset.currentValue, asset.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Purchase Price</span>
                    <span className="text-sm">
                      {isPrivate ? "***" : formatCurrency(asset.purchasePrice, asset.currency)}
                    </span>
                  </div>
                  {isDepreciating && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Depreciation</span>
                      <span className="text-sm text-orange-600">
                        {isPrivate
                          ? "***"
                          : `-${formatCurrency(asset.depreciation, asset.currency)} (${asset.depreciationPercent.toFixed(1)}%)`}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Owned for {asset.yearsOwned.toFixed(1)} years</span>
                    {asset.remainingLifeYears !== null && (
                      <span>{asset.remainingLifeYears.toFixed(1)} years remaining</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
