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

/** "03 minutes 07 seconds" — uploads are capped under 10 minutes, so minutes always fits in 2 digits. */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")} minutes ${String(s).padStart(2, "0")} seconds`;
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

/** 33%, 4.5%, 0.4% — a decimal only under 10%, where a whole percent would round a real rate to 0%. */
export function formatPercent(part: number, whole: number): string {
  // An em dash, not 0%: with nothing to divide by there is no rate, and 0% would claim one.
  if (whole <= 0) return "—";
  const p = (part / whole) * 100;
  return `${p >= 10 ? Math.round(p) : p.toFixed(1).replace(/\.0$/, "")}%`;
}

/** Snowflake ids are long; the table only needs enough to eyeball-match a row. */
export function shortId(id: string, keep = 6) {
  return id.length <= keep ? id : `${id.slice(0, keep)}…`;
}

/**
 * "12 days" / "less than a day" left in the trash before video-service purges the video.
 * `retentionDays` is `TRASH_RETENTION_DAYS` and `now` is `referenceNow()` at every call site, so
 * the countdown agrees with the bell's warning and, in mock mode, with the mock clock.
 */
export function daysUntilPurge(deletedAtIso: string, retentionDays: number, now: number) {
  const daysLeft = retentionDays - (now - new Date(deletedAtIso).getTime()) / 86_400_000;
  return daysLeft < 1 ? "less than a day" : `${Math.ceil(daysLeft)} days`;
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

/**
 * DD/MM/YYYY HH:MM:SS for exact-moment fields (joined, last login, checked...).
 * Pinned to Asia/Ho_Chi_Minh — the admin team is Vietnam-based — rather than
 * formatDate()'s UTC pin, which exists only to keep calendar-bucket dates
 * (chart axes, CSV keys) matching their filter value, not to show a wall clock.
 */
export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Ho_Chi_Minh",
  });
}
