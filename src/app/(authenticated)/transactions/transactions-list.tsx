"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import {
  Search,
  ArrowUpDown,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { usePrivateMode } from "@/components/providers/private-mode-provider";

function formatCurrency(amount: number, currency: string = "EUR"): string {
  return amount.toLocaleString("de-DE", {
    style: "currency",
    currency,
  });
}

function PrivateValue({ children }: { children: React.ReactNode }) {
  const { isPrivate } = usePrivateMode();
  if (isPrivate) {
    return <span>••••••</span>;
  }
  return <>{children}</>;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  amountEur: number;
  type: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
}

interface Category {
  id: string;
  name: string;
  type: string;
  color: string | null;
}

interface Pagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
}

interface TransactionsListProps {
  transactions: Transaction[];
  categories: Category[];
  pagination: Pagination;
  initialFilters: {
    type: string;
    category: string;
  };
}

type SortField = "date" | "amount" | "description";
type SortOrder = "asc" | "desc";

export function TransactionsList({
  transactions,
  categories,
  pagination,
  initialFilters,
}: TransactionsListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>(initialFilters.type);
  const [categoryFilter, setCategoryFilter] = useState<string>(
    initialFilters.category
  );
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Edit dialog state
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [applyToSimilar, setApplyToSimilar] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Navigate with filters
  function updateFilters(updates: {
    page?: number;
    type?: string;
    category?: string;
  }) {
    const params = new URLSearchParams(searchParams.toString());

    if (updates.page !== undefined) {
      if (updates.page === 1) {
        params.delete("page");
      } else {
        params.set("page", updates.page.toString());
      }
    }

    if (updates.type !== undefined) {
      if (updates.type === "all") {
        params.delete("type");
      } else {
        params.set("type", updates.type);
      }
      // Reset to page 1 when filter changes
      params.delete("page");
    }

    if (updates.category !== undefined) {
      if (updates.category === "all") {
        params.delete("category");
      } else {
        params.set("category", updates.category);
      }
      // Reset to page 1 when filter changes
      params.delete("page");
    }

    router.push(`/transactions?${params.toString()}`);
  }

  // Client-side search and sort (within current page)
  const filteredTransactions = useMemo(() => {
    let result = [...transactions];

    // Search filter (client-side, within current page)
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter((t) =>
        t.description.toLowerCase().includes(searchLower)
      );
    }

    // Sort (client-side, within current page)
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "date":
          comparison =
            new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case "amount":
          comparison = a.amountEur - b.amountEur;
          break;
        case "description":
          comparison = a.description.localeCompare(b.description);
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [transactions, search, sortField, sortOrder]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  }

  function openEditDialog(transaction: Transaction) {
    setEditingTransaction(transaction);
    setSelectedCategoryId(transaction.categoryId || "none");
    setApplyToSimilar(false);
    // Pre-fill keyword with the transaction description
    setKeyword(transaction.description);
  }

  async function handleSaveCategory() {
    if (!editingTransaction) return;

    setIsSaving(true);

    try {
      const response = await fetch(
        `/api/transactions/${editingTransaction.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoryId: selectedCategoryId === "none" ? null : selectedCategoryId,
            applyToSimilar,
            keyword: applyToSimilar ? keyword : undefined,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update transaction");
      }

      const result = await response.json();
      
      if (applyToSimilar && result.updatedCount > 1) {
        toast.success(`Updated ${result.updatedCount} transactions`);
      } else {
        toast.success("Transaction updated");
      }
      
      setEditingTransaction(null);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update"
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleTypeChange(value: string) {
    setTypeFilter(value);
    updateFilters({ type: value });
  }

  function handleCategoryChange(value: string) {
    setCategoryFilter(value);
    updateFilters({ category: value });
  }

  return (
    <>
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search in current page..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={typeFilter} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="INCOME">Income</SelectItem>
            <SelectItem value="EXPENSE">Expense</SelectItem>
            <SelectItem value="TRANSFER">Transfer</SelectItem>
          </SelectContent>
        </Select>

        <Combobox
          options={[
            { value: "all", label: "All Categories" },
            { value: "uncategorized", label: "Uncategorized" },
            ...categories.map((cat) => ({
              value: cat.id,
              label: cat.name,
              color: cat.color || undefined,
            })),
          ]}
          value={categoryFilter}
          onValueChange={handleCategoryChange}
          placeholder="Category"
          searchPlaceholder="Search categories..."
          emptyText="No category found."
          className="w-[180px]"
        />
      </div>

      {/* Transactions Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8"
                  onClick={() => toggleSort("date")}
                >
                  Date
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8"
                  onClick={() => toggleSort("description")}
                >
                  Description
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-mr-3 h-8"
                  onClick={() => toggleSort("amount")}
                >
                  Amount
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  <p className="text-muted-foreground">No transactions found</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredTransactions.map((transaction) => (
                <TableRow
                  key={transaction.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => openEditDialog(transaction)}
                >
                  <TableCell className="font-medium">
                    {format(new Date(transaction.date), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{transaction.description}</p>
                  </TableCell>
                  <TableCell>
                    {transaction.categoryName ? (
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: transaction.categoryColor || undefined,
                          color: transaction.categoryColor || undefined,
                        }}
                      >
                        {transaction.categoryName}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Uncategorized</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`font-medium ${
                        transaction.type === "INCOME"
                          ? "text-green-600"
                          : transaction.type === "EXPENSE"
                          ? "text-red-600"
                          : ""
                      }`}
                    >
                      <PrivateValue>
                        {transaction.type === "INCOME" ? "+" : "-"}
                        {formatCurrency(Math.abs(transaction.amountEur))}
                      </PrivateValue>
                    </span>
                    {transaction.currency !== "EUR" && (
                      <p className="text-xs text-muted-foreground">
                        <PrivateValue>
                          {formatCurrency(Math.abs(transaction.amount), transaction.currency)}
                        </PrivateValue>
                      </p>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalCount.toLocaleString()} transactions)
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => updateFilters({ page: 1 })}
            disabled={pagination.currentPage === 1}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => updateFilters({ page: pagination.currentPage - 1 })}
            disabled={pagination.currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => updateFilters({ page: pagination.currentPage + 1 })}
            disabled={pagination.currentPage === pagination.totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => updateFilters({ page: pagination.totalPages })}
            disabled={pagination.currentPage === pagination.totalPages}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingTransaction}
        onOpenChange={(open) => !open && setEditingTransaction(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
            <DialogDescription>
              Update the category for this transaction
            </DialogDescription>
          </DialogHeader>

          {editingTransaction && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Description</Label>
                <p className="text-sm">{editingTransaction.description}</p>
              </div>

              <div className="space-y-2">
                <Label>Date</Label>
                <p className="text-sm">
                  {format(new Date(editingTransaction.date), "dd MMMM yyyy")}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Amount</Label>
                <p
                  className={`text-sm font-medium ${
                    editingTransaction.type === "INCOME"
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  <PrivateValue>
                    {editingTransaction.type === "INCOME" ? "+" : "-"}
                    {formatCurrency(Math.abs(editingTransaction.amountEur))}
                  </PrivateValue>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Combobox
                  options={[
                    { value: "none", label: "None" },
                    ...categories.map((cat) => ({
                      value: cat.id,
                      label: cat.name,
                      color: cat.color || undefined,
                    })),
                  ]}
                  value={selectedCategoryId}
                  onValueChange={setSelectedCategoryId}
                  placeholder="Select a category"
                  searchPlaceholder="Search categories..."
                  emptyText="No category found."
                />
              </div>

              {/* Apply to similar transactions */}
              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="applyToSimilar"
                    checked={applyToSimilar}
                    onCheckedChange={(checked) =>
                      setApplyToSimilar(checked === true)
                    }
                  />
                  <Label
                    htmlFor="applyToSimilar"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Apply to all similar transactions
                  </Label>
                </div>

                {applyToSimilar && (
                  <div className="space-y-2">
                    <Label htmlFor="keyword" className="text-sm text-muted-foreground">
                      Match transactions containing:
                    </Label>
                    <Input
                      id="keyword"
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      placeholder="Enter keyword to match"
                    />
                    <p className="text-xs text-muted-foreground">
                      All transactions with descriptions containing this keyword will be updated.
                      This keyword will also be saved for auto-categorizing future transactions.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingTransaction(null)}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveCategory} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
