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

// Color palette for holdings
const COLORS = [
  "hsl(221, 83%, 53%)", // blue
  "hsl(142, 76%, 36%)", // green
  "hsl(280, 65%, 60%)", // purple
  "hsl(25, 95%, 53%)", // orange
  "hsl(340, 75%, 55%)", // pink
  "hsl(190, 90%, 45%)", // cyan
  "hsl(45, 93%, 47%)", // yellow
  "hsl(160, 60%, 45%)", // teal
];

export type HoldingData = {
  instrumentName: string;
  instrumentType: string;
  totalValue: number;
  weight: number;
};

interface HoldingsChartProps {
  data: HoldingData[];
}

export function HoldingsChart({ data }: HoldingsChartProps) {
  const { formatCurrency } = usePreferences();

  if (data.length === 0) {
    return (
      <div className="flex h-75 items-center justify-center text-muted-foreground">
        No holdings data available
      </div>
    );
  }

  const chartData = data.map((item, index) => ({
    ...item,
    color: COLORS[index % COLORS.length],
    name: item.instrumentName,
    value: item.totalValue,
  }));

  const chartConfig = chartData.reduce((acc, item) => {
    acc[item.name] = {
      label: item.name,
      color: item.color,
    };
    return acc;
  }, {} as ChartConfig);

  return (
    <ChartContainer config={chartConfig} className="h-120 w-full">
      <PieChart accessibilityLayer>
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name, props) => (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-8">
                    <span className="text-muted-foreground">{name}</span>
                    <span className="font-mono font-medium">{formatCurrency(Number(value))}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {props.payload?.weight?.toFixed(1)}% of portfolio
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
          innerRadius="40%"
          outerRadius="70%"
          paddingAngle={2}
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <ChartLegend
          content={<ChartLegendContent nameKey="name" />}
          className="flex-wrap gap-2 *:basis-1/3 sm:*:basis-1/4 *:justify-center"
        />
      </PieChart>
    </ChartContainer>
  );
}
