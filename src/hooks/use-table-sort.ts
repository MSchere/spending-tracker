"use client";

import { useMemo, useState } from "react";

export type SortDir = "asc" | "desc";

export interface UseTableSortOptions<K extends string> {
  /** Columns that default to ascending order when first clicked (e.g. text). Others default to descending. */
  ascColumns?: K[];
}

export interface UseTableSortResult<T, K extends string> {
  sorted: T[];
  sortKey: K;
  sortDir: SortDir;
  toggleSort: (column: K) => void;
}

/**
 * Shared client-side table sorting.
 *
 * - Clicking the active column toggles direction; clicking a new column sorts
 *   descending (numbers/dates) or ascending (columns listed in ascColumns).
 * - null/undefined values always sort last, regardless of direction.
 */
export function useTableSort<T, K extends string>(
  items: T[],
  getValue: (item: T, key: K) => string | number | null,
  defaultKey: K,
  defaultDir: SortDir = "desc",
  options: UseTableSortOptions<K> = {}
): UseTableSortResult<T, K> {
  const { ascColumns = [] } = options;
  const [sortKey, setSortKey] = useState<K>(defaultKey);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

  function toggleSort(column: K) {
    if (column === sortKey) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(column);
      setSortDir(ascColumns.includes(column) ? "asc" : "desc");
    }
  }

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const va = getValue(a, sortKey);
      const vb = getValue(b, sortKey);

      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;

      const cmp = typeof va === "string" ? va.localeCompare(String(vb)) : va - Number(vb);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [items, getValue, sortKey, sortDir]);

  return { sorted, sortKey, sortDir, toggleSort };
}
