"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Combobox } from "@/components/ui/combobox";
import { Plus, Loader2, Trash2, CalendarClock, ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { usePrivateMode } from "@/components/providers/private-mode-provider";
import { usePreferences } from "@/components/providers/preferences-provider";

interface RecurringItem {
  id: string;
  name: string;
  type: "EXPENSE" | "INCOME";
  amount: number;
  frequency: string;
  nextDueDate: string;
  categoryId: string | null;
  categoryName: string | null;
  isActive: boolean;
}

interface Category {
  id: string;
  name: string;
  color: string | null;
}

interface RecurringListProps {
  recurring: RecurringItem[];
  categories: Category[];
}

const frequencyLabels: Record<string, string> = {
  WEEKLY: "Weekly",
  BIWEEKLY: "Bi-weekly",
  MONTHLY: "Monthly",
  BIMONTHLY: "Bi-monthly",
  QUARTERLY: "Quarterly",
  YEARLY: "Yearly",
};

/**
 * Calculate monthly equivalent amount from any frequency
 */
function calculateMonthlyAmount(amount: number, frequency: string): number {
  switch (frequency) {
    case "WEEKLY":
      return amount * 4.33;
    case "BIWEEKLY":
      return amount * 2.17;
    case "MONTHLY":
      return amount;
    case "BIMONTHLY":
      return amount / 2;
    case "QUARTERLY":
      return amount / 3;
    case "YEARLY":
      return amount / 12;
    default:
      return amount;
  }
}

export function RecurringList({ recurring, categories }: RecurringListProps) {
  const router = useRouter();
  const { isPrivate } = usePrivateMode();
  const { formatCurrency, formatDate, preferences } = usePreferences();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [type, setType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("MONTHLY");
  const [nextDueDate, setNextDueDate] = useState("");
  const [categoryId, setCategoryId] = useState("");

  function resetForm() {
    setName("");
    setType("EXPENSE");
    setAmount("");
    setFrequency("MONTHLY");
    setNextDueDate("");
    setCategoryId("");
  }

  async function handleCreate() {
    if (!name || !amount || !nextDueDate) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type,
          amount: parseFloat(amount),
          frequency,
          nextDueDate,
          categoryId: categoryId === "none" ? null : categoryId || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create recurring item");
      }

      toast.success(`Recurring ${type.toLowerCase()} created`);
      setIsDialogOpen(false);
      resetForm();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create recurring item");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);

    try {
      const response = await fetch(`/api/recurring/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete recurring item");
      }

      toast.success("Recurring item deleted");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete item");
    } finally {
      setDeletingId(null);
    }
  }

  // Calculate monthly totals by type
  const activeItems = recurring.filter((r) => r.isActive);

  const monthlyExpenseTotal = activeItems
    .filter((r) => r.type === "EXPENSE")
    .reduce((sum, r) => sum + calculateMonthlyAmount(r.amount, r.frequency), 0);

  const monthlyIncomeTotal = activeItems
    .filter((r) => r.type === "INCOME")
    .reduce((sum, r) => sum + calculateMonthlyAmount(r.amount, r.frequency), 0);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Recurring Expenses</CardTitle>
            <ArrowUpIcon className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {isPrivate ? "••••" : `-${formatCurrency(monthlyExpenseTotal)}`}
            </p>
            <p className="text-xs text-muted-foreground">Fixed monthly outgoing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Recurring Income</CardTitle>
            <ArrowDownIcon className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {isPrivate ? "••••" : `+${formatCurrency(monthlyIncomeTotal)}`}
            </p>
            <p className="text-xs text-muted-foreground">Expected monthly incoming</p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Recurring Item
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Recurring Item</DialogTitle>
            <DialogDescription>Track a recurring expense or income</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as "EXPENSE" | "INCOME")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXPENSE">Expense</SelectItem>
                  <SelectItem value="INCOME">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  type === "INCOME" ? "e.g., Salary, Freelance" : "e.g., Netflix, Rent, Gym"
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount ({preferences.currency})</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="frequency">Frequency</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                    <SelectItem value="BIWEEKLY">Bi-weekly</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                    <SelectItem value="BIMONTHLY">Bi-monthly</SelectItem>
                    <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                    <SelectItem value="YEARLY">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nextDueDate">Next Due Date</Label>
              <Input
                id="nextDueDate"
                type="date"
                value={nextDueDate}
                onChange={(e) => setNextDueDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category (optional)</Label>
              <Combobox
                options={[
                  { value: "none", label: "None" },
                  ...categories.map((cat) => ({
                    value: cat.id,
                    label: cat.name,
                    color: cat.color || undefined,
                  })),
                ]}
                value={categoryId}
                onValueChange={setCategoryId}
                placeholder="Select a category"
                searchPlaceholder="Search categories..."
                emptyText="No category found."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {recurring.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <CalendarClock className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">
                No recurring items yet. Add one to start tracking your subscriptions and income.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Next Due</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recurring.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    <Badge variant={item.type === "INCOME" ? "default" : "secondary"}>
                      {item.type === "INCOME" ? "Income" : "Expense"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {item.categoryName ? (
                      <Badge variant="outline">{item.categoryName}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>{frequencyLabels[item.frequency] || item.frequency}</TableCell>
                  <TableCell>
                    {formatDate(item.nextDueDate, {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {isPrivate
                      ? "••••"
                      : `${item.type === "INCOME" ? "+" : "-"}${formatCurrency(item.amount)}`}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                    >
                      {deletingId === item.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
