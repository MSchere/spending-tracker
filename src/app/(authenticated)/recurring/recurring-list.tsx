"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Plus, Loader2, Trash2, CalendarClock } from "lucide-react";

interface RecurringExpense {
  id: string;
  name: string;
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
  recurring: RecurringExpense[];
  categories: Category[];
}

const frequencyLabels: Record<string, string> = {
  WEEKLY: "Weekly",
  BIWEEKLY: "Bi-weekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  YEARLY: "Yearly",
};

export function RecurringList({ recurring, categories }: RecurringListProps) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("MONTHLY");
  const [nextDueDate, setNextDueDate] = useState("");
  const [categoryId, setCategoryId] = useState("");

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
          amount: parseFloat(amount),
          frequency,
          nextDueDate,
          categoryId: categoryId === "none" ? null : categoryId || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create recurring expense");
      }

      toast.success("Recurring expense created");
      setIsDialogOpen(false);
      setName("");
      setAmount("");
      setFrequency("MONTHLY");
      setNextDueDate("");
      setCategoryId("");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create expense"
      );
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
        throw new Error("Failed to delete recurring expense");
      }

      toast.success("Recurring expense deleted");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete expense"
      );
    } finally {
      setDeletingId(null);
    }
  }

  // Calculate monthly total
  const monthlyTotal = recurring
    .filter((r) => r.isActive)
    .reduce((sum, r) => {
      switch (r.frequency) {
        case "WEEKLY":
          return sum + r.amount * 4.33;
        case "BIWEEKLY":
          return sum + r.amount * 2.17;
        case "MONTHLY":
          return sum + r.amount;
        case "QUARTERLY":
          return sum + r.amount / 3;
        case "YEARLY":
          return sum + r.amount / 12;
        default:
          return sum;
      }
    }, 0);

  return (
    <>
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Recurring Total</CardTitle>
          <CardDescription>
            Estimated monthly cost of all active recurring expenses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">
            {monthlyTotal.toLocaleString("de-DE", {
              style: "currency",
              currency: "EUR",
            })}
          </p>
        </CardContent>
      </Card>

      {/* Create Button */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Recurring Expense
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Recurring Expense</DialogTitle>
            <DialogDescription>
              Track a subscription or regular bill
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Netflix, Rent, Gym"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (EUR)</Label>
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

      {/* Recurring Expenses Table */}
      {recurring.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <CalendarClock className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">
                No recurring expenses yet. Add one to start tracking your
                subscriptions.
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
                <TableHead>Category</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Next Due</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recurring.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="font-medium">{expense.name}</TableCell>
                  <TableCell>
                    {expense.categoryName ? (
                      <Badge variant="outline">{expense.categoryName}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {frequencyLabels[expense.frequency] || expense.frequency}
                  </TableCell>
                  <TableCell>
                    {format(new Date(expense.nextDueDate), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {expense.amount.toLocaleString("de-DE", {
                      style: "currency",
                      currency: "EUR",
                    })}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDelete(expense.id)}
                      disabled={deletingId === expense.id}
                    >
                      {deletingId === expense.id ? (
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
