"use client";

import { Pie, PieChart, Cell } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { usePreferences } from "@/components/providers/preferences-provider";

export type CategorySpendingData = {
  name: string;
  value: number;
  color: string;
};

interface CategorySpendingChartProps {
  data: CategorySpendingData[];
}

export function CategorySpendingChart({ data }: CategorySpendingChartProps) {
  const { formatCurrency } = usePreferences();

  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        No spending data available
      </div>
    );
  }

  // Build dynamic chart config from data
  const chartConfig = data.reduce((acc, item) => {
    acc[item.name] = {
      label: item.name,
      color: item.color,
    };
    return acc;
  }, {} as ChartConfig);

  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <PieChart accessibilityLayer>
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <div className="flex items-center justify-between gap-8">
                  <span className="text-muted-foreground">{name}</span>
                  <span className="font-mono font-medium">{formatCurrency(Number(value))}</span>
                </div>
              )}
            />
          }
        />
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius="40%"
          outerRadius="70%"
          paddingAngle={2}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <ChartLegend
          content={<ChartLegendContent nameKey="name" />}
          className="flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
        />
      </PieChart>
    </ChartContainer>
  );
}
