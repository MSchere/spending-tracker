"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { usePrivateMode } from "@/components/providers/private-mode-provider";

function formatCurrency(amount: number): string {
  return amount.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
}

function PrivateValue({ children }: { children: React.ReactNode }) {
  const { isPrivate } = usePrivateMode();
  if (isPrivate) {
    return <span>••••••</span>;
  }
  return <>{children}</>;
}

interface Budget {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string | null;
  amount: number;
  spent: number;
  period: string;
  isActive: boolean;
}

interface Category {
  id: string;
  name: string;
  color: string | null;
}

interface BudgetsListProps {
  budgets: Budget[];
  categories: Category[];
}

export function BudgetsList({ budgets, categories }: BudgetsListProps) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState("MONTHLY");

  async function handleCreate() {
    if (!categoryId || !amount) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId,
          amount: parseFloat(amount),
          period,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create budget");
      }

      toast.success("Budget created");
      setIsDialogOpen(false);
      setCategoryId("");
      setAmount("");
      setPeriod("MONTHLY");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create budget"
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);

    try {
      const response = await fetch(`/api/budgets/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete budget");
      }

      toast.success("Budget deleted");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete budget"
      );
    } finally {
      setDeletingId(null);
    }
  }

  // Filter out categories that already have a budget
  const availableCategories = categories.filter(
    (cat) => !budgets.some((b) => b.categoryId === cat.id)
  );

  return (
    <>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Budget
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Budget</DialogTitle>
            <DialogDescription>
              Set a spending limit for a category
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Combobox
                options={availableCategories.map((cat) => ({
                  value: cat.id,
                  label: cat.name,
                  color: cat.color || undefined,
                }))}
                value={categoryId}
                onValueChange={setCategoryId}
                placeholder="Select a category"
                searchPlaceholder="Search categories..."
                emptyText="No categories available"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Budget Amount (EUR)</Label>
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
              <Label htmlFor="period">Period</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="YEARLY">Yearly</SelectItem>
                </SelectContent>
              </Select>
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

      {budgets.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              No budgets yet. Create one to start tracking your spending limits.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {budgets.map((budget) => {
            const percentage = Math.min(
              100,
              (budget.spent / budget.amount) * 100
            );
            const isOverBudget = budget.spent > budget.amount;

            return (
              <Card key={budget.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: budget.categoryColor || undefined,
                          color: budget.categoryColor || undefined,
                        }}
                      >
                        {budget.categoryName}
                      </Badge>
                      {!budget.isActive && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDelete(budget.id)}
                      disabled={deletingId === budget.id}
                    >
                      {deletingId === budget.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      )}
                    </Button>
                  </div>
                  <CardDescription>
                    {budget.period.charAt(0) +
                      budget.period.slice(1).toLowerCase()}{" "}
                    budget
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span
                        className={isOverBudget ? "text-red-600 font-medium" : ""}
                      >
                        <PrivateValue>{formatCurrency(budget.spent)}</PrivateValue>
                      </span>
                      <span className="text-muted-foreground">
                        of{" "}
                        <PrivateValue>{formatCurrency(budget.amount)}</PrivateValue>
                      </span>
                    </div>
                    <Progress
                      value={percentage}
                      className={isOverBudget ? "[&>div]:bg-red-600" : ""}
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      <PrivateValue>
                        {isOverBudget
                          ? `${formatCurrency(budget.spent - budget.amount)} over budget`
                          : `${formatCurrency(budget.amount - budget.spent)} remaining`}
                      </PrivateValue>
                    </p>
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
