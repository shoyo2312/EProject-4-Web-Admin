/**
 * CSV serialisation for the console's Export buttons.
 *
 * Deliberately RFC 4180 rather than "join with commas": a moderation reason is free
 * text a user typed, so it routinely contains commas, quotes and newlines. Getting the
 * quoting wrong does not throw — it silently shifts every later column of that row.
 */

type Cell = unknown;

/**
 * Plain `object`, not `Record<string, unknown>`: the DTOs come back as interfaces,
 * and an interface has no index signature, so it never satisfies a Record type.
 */
export type CsvRow = object;

function cellsOf(row: CsvRow): Record<string, Cell> {
  return row as Record<string, Cell>;
}

function serialiseCell(value: Cell): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function quote(field: string): string {
  // Leading whitespace matters too: Excel trims an unquoted field.
  return /[",\r\n]/.test(field) || field !== field.trim()
    ? `"${field.replace(/"/g, '""')}"`
    : field;
}

/**
 * Columns are the union of every row's keys, in first-seen order — an optional field
 * that only appears on row 40 would be dropped if the header came from row 0 alone.
 */
export function csvColumns(rows: readonly CsvRow[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) seen.add(key);
  }
  return [...seen];
}

export function toCsv(rows: readonly CsvRow[], columns = csvColumns(rows)): string {
  const lines = [columns.map(quote).join(",")];
  for (const row of rows) {
    const cells = cellsOf(row);
    lines.push(columns.map((c) => quote(serialiseCell(cells[c]))).join(","));
  }
  // CRLF per the spec; Excel on Windows needs it, everything else tolerates it.
  return lines.join("\r\n");
}

/** e.g. "moderation-actions-2026-09-06.csv" */
export function csvFilename(name: string, now = new Date()): string {
  return `${name}-${now.toISOString().slice(0, 10)}.csv`;
}
