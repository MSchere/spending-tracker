"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { SortDir } from "@/hooks/use-table-sort";

interface SortableTableHeadProps<K extends string> {
  label: string;
  column: K;
  sortKey: K;
  sortDir: SortDir;
  onSort: (column: K) => void;
  className?: string;
}

/**
 * Sortable table header for the shadcn Table. Renders a ghost button with a
 * direction-aware indicator; align with className="text-right" for numerics.
 */
export function SortableTableHead<K extends string>({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  className,
}: SortableTableHeadProps<K>) {
  const active = sortKey === column;
  const isRightAligned = className?.includes("text-right");

  return (
    <TableHead className={className}>
      <Button
        variant="ghost"
        size="sm"
        className={cn("h-8", isRightAligned ? "-mr-3" : "-ml-3")}
        onClick={() => onSort(column)}
      >
        {label}
        {active ? (
          sortDir === "asc" ? (
            <ArrowUp className="ml-2 h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="ml-2 h-3.5 w-3.5" />
          )
        ) : (
          <ArrowUpDown className="ml-2 h-3.5 w-3.5 opacity-50" />
        )}
      </Button>
    </TableHead>
  );
}
