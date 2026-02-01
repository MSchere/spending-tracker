import { type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SummaryCardProps {
  /** Card title (e.g., "Portfolio Value") */
  title: string;
  /** Main value - already masked if needed */
  value: React.ReactNode;
  /** Subtext below value */
  description?: string;
  /** Icon displayed on the right side of the header */
  icon?: LucideIcon;
  /** Icon color class (e.g., "text-green-500"). Defaults to "text-muted-foreground" */
  iconColor?: string;
  /** Value color class (e.g., "text-green-600") */
  valueColor?: string;
  /** Additional className for the card */
  className?: string;
}

export function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
  iconColor = "text-muted-foreground",
  valueColor,
  className,
}: SummaryCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {Icon && <Icon className={cn("h-4 w-4", iconColor)} />}
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold", valueColor)}>{value}</div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  );
}
