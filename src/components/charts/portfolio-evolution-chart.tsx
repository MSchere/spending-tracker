"use client";

import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { format } from "date-fns";

export type PortfolioHistoryData = {
  date: Date;
  totalValue: number;
  totalInvested: number;
  returns: number;
  returnsPercent: number;
};

interface PortfolioEvolutionChartProps {
  data: PortfolioHistoryData[];
}

const chartConfig = {
  totalValue: {
    label: "Portfolio Value",
    color: "hsl(221, 83%, 53%)", // blue
  },
  totalInvested: {
    label: "Amount Invested",
    color: "hsl(220, 14%, 46%)", // gray
  },
} satisfies ChartConfig;

export function PortfolioEvolutionChart({ data }: PortfolioEvolutionChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        No portfolio data available
      </div>
    );
  }

  // Format data for the chart
  const chartData = data.map((point) => ({
    ...point,
    dateLabel: format(new Date(point.date), "MMM yy"),
  }));

  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <LineChart data={chartData} accessibilityLayer>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="dateLabel" tickLine={false} tickMargin={10} axisLine={false} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) =>
            new Intl.NumberFormat("de-DE", {
              notation: "compact",
              compactDisplay: "short",
            }).format(value)
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
                  <span className="font-mono font-medium">
                    {Number(value).toLocaleString("de-DE", {
                      style: "currency",
                      currency: "EUR",
                    })}
                  </span>
                </div>
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          type="monotone"
          dataKey="totalInvested"
          stroke="var(--color-totalInvested)"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="totalValue"
          stroke="var(--color-totalValue)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
