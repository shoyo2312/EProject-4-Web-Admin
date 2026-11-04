export interface SortState<F extends string> {
  field: F;
  ascending: boolean;
}

/**
 * A column header press, as on TikTok Studio's posts table: a new column starts high to low
 * (newest, largest, last), the same column flips, and there is no way back to "unsorted".
 */
export function nextSort<F extends string>(current: SortState<F> | undefined, field: F): SortState<F> {
  return { field, ascending: current?.field === field && !current.ascending };
}

/**
 * A fully fetched list in a column's order — only for lists the page holds whole. A server-paged
 * list is ordered by the backend instead: sorting one page could only reorder the rows that won.
 * Missing values go last either way, so a flip never puts the blanks on top.
 */
export function sortRows<T>(
  rows: readonly T[],
  value: (row: T) => string | number | null | undefined,
  ascending: boolean,
): T[] {
  const sign = ascending ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1;
    const order = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
    return order * sign;
  });
}
