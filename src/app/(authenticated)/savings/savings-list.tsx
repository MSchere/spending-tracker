"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Trash2, Check, Target } from "lucide-react";
import { usePrivateMode } from "@/components/providers/private-mode-provider";

interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null;
  type: string;
  isCompleted: boolean;
}

interface SavingsGoalsListProps {
  savingsGoals: SavingsGoal[];
}

const goalTypeLabels: Record<string, string> = {
  EMERGENCY_FUND: "Emergency Fund",
  SAVINGS: "General Savings",
  INDEX_FUND: "Index Fund",
  ETF: "ETF",
  STOCK: "Stocks",
  CRYPTO: "Crypto",
};

export function SavingsGoalsList({ savingsGoals }: SavingsGoalsListProps) {
  const router = useRouter();
  const { isPrivate } = usePrivateMode();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("");
  const [type, setType] = useState("SAVINGS");
  const [deadline, setDeadline] = useState("");

  async function handleCreate() {
    if (!name || !targetAmount) {
      toast.error("Please fill in name and target amount");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/savings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          targetAmount: parseFloat(targetAmount),
          currentAmount: currentAmount ? parseFloat(currentAmount) : 0,
          type,
          deadline: deadline || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create goal");
      }

      toast.success("Savings goal created");
      setIsDialogOpen(false);
      setName("");
      setTargetAmount("");
      setCurrentAmount("");
      setType("SAVINGS");
      setDeadline("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create goal");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);

    try {
      const response = await fetch(`/api/savings/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete goal");
      }

      toast.success("Savings goal deleted");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete goal");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleMarkComplete(id: string) {
    setUpdatingId(id);

    try {
      const response = await fetch(`/api/savings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted: true }),
      });

      if (!response.ok) {
        throw new Error("Failed to update goal");
      }

      toast.success("Goal marked as complete!");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update goal");
    } finally {
      setUpdatingId(null);
    }
  }

  const activeGoals = savingsGoals.filter((g) => !g.isCompleted);
  const completedGoals = savingsGoals.filter((g) => g.isCompleted);

  return (
    <>
      {/* Create Goal Button */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Goal
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Savings Goal</DialogTitle>
            <DialogDescription>Set a target to track your savings progress</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Goal Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Emergency Fund, Vacation"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMERGENCY_FUND">Emergency Fund</SelectItem>
                  <SelectItem value="SAVINGS">General Savings</SelectItem>
                  <SelectItem value="INDEX_FUND">Index Fund</SelectItem>
                  <SelectItem value="ETF">ETF</SelectItem>
                  <SelectItem value="STOCK">Stocks</SelectItem>
                  <SelectItem value="CRYPTO">Crypto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="targetAmount">Target Amount (EUR)</Label>
                <Input
                  id="targetAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  placeholder="10000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currentAmount">Current Amount (EUR)</Label>
                <Input
                  id="currentAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={currentAmount}
                  onChange={(e) => setCurrentAmount(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deadline">Deadline (optional)</Label>
              <Input
                id="deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
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

      {/* Active Goals */}
      {activeGoals.length === 0 && completedGoals.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <Target className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">
                No savings goals yet. Create one to start tracking your progress.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {activeGoals.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeGoals.map((goal) => {
                const percentage = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);
                const isComplete = goal.currentAmount >= goal.targetAmount;

                return (
                  <Card key={goal.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{goal.name}</CardTitle>
                        <div className="flex gap-1">
                          {isComplete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleMarkComplete(goal.id)}
                              disabled={updatingId === goal.id}
                            >
                              {updatingId === goal.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4 text-green-600" />
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDelete(goal.id)}
                            disabled={deletingId === goal.id}
                          >
                            {deletingId === goal.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <CardDescription className="flex items-center gap-2">
                        <Badge variant="secondary">{goalTypeLabels[goal.type] || goal.type}</Badge>
                        {goal.deadline && (
                          <span className="text-xs">
                            Due {format(new Date(goal.deadline), "MMM yyyy")}
                          </span>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">
                            {isPrivate
                              ? "••••"
                              : goal.currentAmount.toLocaleString("de-DE", {
                                  style: "currency",
                                  currency: "EUR",
                                })}
                          </span>
                          <span className="text-muted-foreground">
                            of{" "}
                            {isPrivate
                              ? "••••"
                              : goal.targetAmount.toLocaleString("de-DE", {
                                  style: "currency",
                                  currency: "EUR",
                                })}
                          </span>
                        </div>
                        <Progress
                          value={isPrivate ? 0 : percentage}
                          className={isComplete ? "[&>div]:bg-green-600" : ""}
                        />
                        <p className="text-xs text-muted-foreground text-right">
                          {isPrivate ? "••••" : `${percentage.toFixed(0)}% complete`}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Completed Goals */}
          {completedGoals.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-muted-foreground">Completed Goals</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {completedGoals.map((goal) => (
                  <Card key={goal.id} className="opacity-75">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-600" />
                          {goal.name}
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDelete(goal.id)}
                          disabled={deletingId === goal.id}
                        >
                          {deletingId === goal.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          )}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Saved{" "}
                        {isPrivate
                          ? "••••"
                          : goal.targetAmount.toLocaleString("de-DE", {
                              style: "currency",
                              currency: "EUR",
                            })}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
