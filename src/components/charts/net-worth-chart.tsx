"use client";

import { Cell, Pie, PieChart } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { usePreferences } from "@/components/providers/preferences-provider";

export interface NetWorthSegment {
  name: string;
  value: number;
  color: string;
}

interface NetWorthChartProps {
  data: NetWorthSegment[];
}

export function NetWorthChart({ data }: NetWorthChartProps) {
  const { formatCurrency } = usePreferences();
  const chartData = data.filter((d) => d.value > 0);
  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  if (chartData.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-muted-foreground">
        No data available
      </div>
    );
  }

  const chartConfig = chartData.reduce((acc, item) => {
    acc[item.name] = { label: item.name, color: item.color };
    return acc;
  }, {} as ChartConfig);

  return (
    <ChartContainer config={chartConfig} className="h-48 w-full">
      <PieChart accessibilityLayer>
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-8">
                    <span className="text-muted-foreground">{name}</span>
                    <span className="font-mono font-medium">{formatCurrency(Number(value))}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {total > 0 ? ((Number(value) / total) * 100).toFixed(1) : 0}% of net worth
                  </div>
                </div>
              )}
            />
          }
        />
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius="55%"
          outerRadius="85%"
          paddingAngle={2}
        >
          {chartData.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}
