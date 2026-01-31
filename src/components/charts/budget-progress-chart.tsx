"use client";

import { Bar, BarChart, XAxis, YAxis, Cell, LabelList } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export type BudgetProgressData = {
  name: string;
  spent: number;
  budget: number;
  percentage: number;
};

interface BudgetProgressChartProps {
  data: BudgetProgressData[];
}

const chartConfig = {
  spent: {
    label: "Spent",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

function getBarColor(percentage: number): string {
  if (percentage >= 100) return "hsl(0, 84%, 60%)"; // red - over budget
  if (percentage >= 80) return "hsl(38, 92%, 50%)"; // orange - warning
  return "hsl(142, 76%, 36%)"; // green - healthy
}

export function BudgetProgressChart({ data }: BudgetProgressChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        No budgets configured
      </div>
    );
  }

  // Sort by percentage (highest first) and take top 6
  const sortedData = [...data]
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 6);

  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <BarChart
        data={sortedData}
        layout="vertical"
        margin={{ left: 0, right: 60 }}
        accessibilityLayer
      >
        <XAxis
          type="number"
          domain={[0, (dataMax: number) => Math.ceil(Math.max(dataMax * 1.1, 100))]}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${Math.round(value)}%`}
        />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          width={100}
          tickFormatter={(value) =>
            value.length > 12 ? `${value.slice(0, 12)}...` : value
          }
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name, props) => {
                const item = props.payload as BudgetProgressData;
                return (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-8">
                      <span className="text-muted-foreground">Spent</span>
                      <span className="font-mono font-medium">
                        {item.spent.toLocaleString("de-DE", {
                          style: "currency",
                          currency: "EUR",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-8">
                      <span className="text-muted-foreground">Budget</span>
                      <span className="font-mono font-medium">
                        {item.budget.toLocaleString("de-DE", {
                          style: "currency",
                          currency: "EUR",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-8">
                      <span className="text-muted-foreground">Usage</span>
                      <span className="font-mono font-medium">
                        {item.percentage.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                );
              }}
            />
          }
        />
        <Bar dataKey="percentage" radius={4}>
          {sortedData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getBarColor(entry.percentage)} />
          ))}
          <LabelList
            dataKey="percentage"
            position="right"
            formatter={(value: number) => `${value.toFixed(0)}%`}
            className="fill-foreground text-xs"
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
