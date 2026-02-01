"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { usePreferences } from "@/components/providers/preferences-provider";

export type CashFlowData = {
  month: string;
  income: number;
  expenses: number;
};

interface CashFlowChartProps {
  data: CashFlowData[];
}

const chartConfig = {
  income: {
    label: "Income",
    color: "hsl(142, 76%, 36%)", // green
  },
  expenses: {
    label: "Expenses",
    color: "hsl(0, 84%, 60%)", // red
  },
} satisfies ChartConfig;

export function CashFlowChart({ data }: CashFlowChartProps) {
  const { formatCurrency, formatNumber } = usePreferences();

  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        No data available
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <BarChart data={data} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) =>
            formatNumber(value, { notation: "compact", compactDisplay: "short" })
          }
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <div className="flex items-center justify-between gap-8">
                  <span className="text-muted-foreground">
                    {chartConfig[name as keyof typeof chartConfig]?.label || name}
                  </span>
                  <span className="font-mono font-medium">{formatCurrency(Number(value))}</span>
                </div>
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="income" fill="var(--color-income)" radius={4} />
        <Bar dataKey="expenses" fill="var(--color-expenses)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
