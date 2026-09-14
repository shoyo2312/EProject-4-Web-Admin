const numberFormat = new Intl.NumberFormat("en-US");

export function formatNumber(value: number) {
  return numberFormat.format(value);
}

export function formatCurrency(value: number | string) {
  const n = typeof value === "string" ? Number(value) : value;
  return `$${numberFormat.format(Math.round(n))}`;
}

export function formatCompact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}

/** TikTok's own abbreviation style: 1.2B, 355.8K, 20.1K, 6834 (no suffix under 10k). */
export function formatCount(n: number): string {
  if (n >= 1_000_000_000) {
    const b = n / 1_000_000_000;
    return `${b >= 100 ? Math.round(b) : b.toFixed(1).replace(/\.0$/, "")}B`;
  }
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m >= 100 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (n >= 10_000) {
    const k = n / 1000;
    return `${k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}K`;
  }
  return String(n);
}

/** Snowflake ids are long; the table only needs enough to eyeball-match a row. */
export function shortId(id: string, keep = 6) {
  return id.length <= keep ? id : `${id.slice(0, keep)}…`;
}

export function relativeTime(iso: string, now = Date.now()) {
  const diffMs = now - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

/**
 * DD/MM/YYYY everywhere, with the locale pinned rather than left to the viewer's
 * browser: 06/09 has to mean one date whoever opens the console, and a chart axis
 * that silently swaps day and month is a misreading nobody notices.
 */
export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    // The `day` fields are UTC calendar dates. Rendering them in the viewer's zone
    // shifts a bar's label to the day before west of Greenwich, and the label no
    // longer matches the value the filters and the CSV are keyed on.
    timeZone: "UTC",
  });
}
