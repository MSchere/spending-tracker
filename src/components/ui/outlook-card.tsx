"use client";

import { usePrivateMode } from "@/components/providers/private-mode-provider";

interface OutlookCardProps {
  label: string;
  value: React.ReactNode;
  percentage?: number;
  targetPercentage?: number;
  subtext: React.ReactNode;
  colorClass: string;
  bgClass: string;
  /** For savings cards, being over target is good. For expense cards, being under is good. */
  invertDeviation?: boolean;
}

function PrivateValue({ children }: { children: React.ReactNode }) {
  const { isPrivate } = usePrivateMode();
  if (isPrivate) {
    return <span>••••••</span>;
  }
  return <>{children}</>;
}

export function OutlookCard({
  label,
  value,
  percentage,
  targetPercentage,
  subtext,
  colorClass,
  bgClass,
  invertDeviation = false,
}: OutlookCardProps) {
  const showPercentage = percentage !== undefined && targetPercentage !== undefined;
  const deviation = showPercentage ? percentage - targetPercentage : 0;

  // For expenses: under target = good (green), over = bad (red)
  // For savings: over target = good (green), under = bad (red)
  const isGood = invertDeviation ? deviation >= 0 : deviation <= 0;
  const percentageColorClass = isGood ? "text-green-600" : "text-red-600";

  return (
    <div className={`flex flex-col gap-1 p-3 rounded-lg ${bgClass}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        {showPercentage && (
          <PrivateValue>
            <span className={`text-xs font-medium ${percentageColorClass}`}>
              {percentage.toFixed(0)}% / {targetPercentage}%
            </span>
          </PrivateValue>
        )}
      </div>
      <span className={`text-lg font-semibold ${colorClass}`}>
        <PrivateValue>{value}</PrivateValue>
      </span>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          <PrivateValue>{subtext}</PrivateValue>
        </span>
        {showPercentage && (
          <PrivateValue>
            <span className={`text-xs font-medium ${percentageColorClass}`}>
              {deviation >= 0 ? "+" : ""}
              {deviation.toFixed(0)}%
            </span>
          </PrivateValue>
        )}
      </div>
    </div>
  );
}
