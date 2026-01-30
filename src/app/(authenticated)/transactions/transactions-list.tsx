"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
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
import { Search, ArrowUpDown, Loader2 } from "lucide-react";

interface Transaction {
  id: string;
  date: string;
  description: string;
  merchant: string | null;
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

interface TransactionsListProps {
  transactions: Transaction[];
  categories: Category[];
}

type SortField = "date" | "amount" | "description";
type SortOrder = "asc" | "desc";

export function TransactionsList({
  transactions,
  categories,
}: TransactionsListProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Edit dialog state
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // Filter and sort transactions
  const filteredTransactions = useMemo(() => {
    let result = [...transactions];

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.description.toLowerCase().includes(searchLower) ||
          t.merchant?.toLowerCase().includes(searchLower)
      );
    }

    // Type filter
    if (typeFilter !== "all") {
      result = result.filter((t) => t.type === typeFilter);
    }

    // Category filter
    if (categoryFilter !== "all") {
      if (categoryFilter === "uncategorized") {
        result = result.filter((t) => !t.categoryId);
      } else {
        result = result.filter((t) => t.categoryId === categoryFilter);
      }
    }

    // Sort
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
  }, [transactions, search, typeFilter, categoryFilter, sortField, sortOrder]);

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
    setSelectedCategoryId(transaction.categoryId || "");
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
            categoryId: selectedCategoryId || null,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update transaction");
      }

      toast.success("Transaction updated");
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

  return (
    <>
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
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

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="uncategorized">Uncategorized</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                    <div>
                      <p className="font-medium">{transaction.description}</p>
                      {transaction.merchant &&
                        transaction.merchant !== transaction.description && (
                          <p className="text-sm text-muted-foreground">
                            {transaction.merchant}
                          </p>
                        )}
                    </div>
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
                      {transaction.type === "INCOME" ? "+" : "-"}
                      {Math.abs(transaction.amountEur).toLocaleString("de-DE", {
                        style: "currency",
                        currency: "EUR",
                      })}
                    </span>
                    {transaction.currency !== "EUR" && (
                      <p className="text-xs text-muted-foreground">
                        {Math.abs(transaction.amount).toLocaleString("de-DE", {
                          style: "currency",
                          currency: transaction.currency,
                        })}
                      </p>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-sm text-muted-foreground">
        Showing {filteredTransactions.length} of {transactions.length}{" "}
        transactions
      </p>

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
                  {editingTransaction.type === "INCOME" ? "+" : "-"}
                  {Math.abs(editingTransaction.amountEur).toLocaleString(
                    "de-DE",
                    {
                      style: "currency",
                      currency: "EUR",
                    }
                  )}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={selectedCategoryId}
                  onValueChange={setSelectedCategoryId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
