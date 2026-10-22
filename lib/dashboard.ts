import type {
  DataExportSummaryResponse,
  ReportGroupResponse,
  ReportResponse,
} from "@/lib/api/types";
import { dataExportHealth } from "@/lib/data-exports";
import { formatNumber, plural, relativeTime } from "@/lib/format";

/** How long the oldest item may wait before its queue is marked as falling behind. */
export const STALE_AFTER_MS = 86_400_000;

/** The header line. `videos` is null when the held listing could not be read — not the same as none. */
export function waitingSummary(videos: number | null, reports: number): string {
  const parts = [
    videos ? `${formatNumber(videos)} ${plural(videos, "video")}` : null,
    reports > 0 ? `${formatNumber(reports)} ${plural(reports, "report")}` : null,
  ].filter(Boolean);
  const waiting = parts.length > 0 ? `${parts.join(" and ")} waiting for review.` : null;
  if (videos === null) return [waiting, "Held videos could not be read."].filter(Boolean).join(" ");
  return waiting ?? "Nothing is waiting for a decision.";
}

/** The earliest instant, compared as time: the backend writes some with fractions, some without. */
export function oldest(instants: readonly (string | null | undefined)[]): string | null {
  let result: string | null = null;
  for (const at of instants) {
    if (at && (result === null || Date.parse(at) < Date.parse(result))) result = at;
  }
  return result;
}

export function isStale(at: string | null, now: number): boolean {
  return at !== null && now - Date.parse(at) > STALE_AFTER_MS;
}

/**
 * How long a person took to decide, over the reports one did. admin-service also closes reports
 * itself, with nobody named — on arrival against a target already enforced, and in the stale
 * sweep — and those would pull the median towards zero.
 */
export function decisionPace(
  reports: readonly Pick<ReportResponse, "createdAt" | "resolvedAt" | "resolvedBy">[],
): { medianMs: number | null; decided: number } {
  const spans = reports
    .flatMap((r) =>
      r.resolvedAt && r.resolvedBy ? [Date.parse(r.resolvedAt) - Date.parse(r.createdAt)] : [],
    )
    .sort((a, b) => a - b);
  if (spans.length === 0) return { medianMs: null, decided: 0 };
  const mid = spans.length >> 1;
  return {
    medianMs: spans.length % 2 ? spans[mid] : (spans[mid - 1] + spans[mid]) / 2,
    decided: spans.length,
  };
}

export interface WatchedAccount {
  userId: string;
  /** Uploads of theirs held for review right now. */
  held: number;
  /** Standing reports against the account or one of its videos. */
  reports: number;
}

/** The accounts behind the most open work, heaviest first; ties go to the more reported one. */
export function accountsToWatch(input: {
  held: readonly { userId: string }[];
  queue: readonly Pick<ReportGroupResponse, "targetType" | "targetId" | "reportCount">[];
  /** videoId → owner, for reported videos; one missing here is left out rather than guessed. */
  videoOwners: Readonly<Record<string, string>>;
  limit?: number;
}): WatchedAccount[] {
  const { held, queue, videoOwners, limit = 5 } = input;
  const accounts = new Map<string, WatchedAccount>();
  const account = (userId: string) => {
    let row = accounts.get(userId);
    if (!row) accounts.set(userId, (row = { userId, held: 0, reports: 0 }));
    return row;
  };

  for (const video of held) account(video.userId).held += 1;
  for (const group of queue) {
    // Own keys only: the target id is whatever the reporter sent, "constructor" included.
    const owner =
      group.targetType === "USER"
        ? group.targetId
        : group.targetType === "VIDEO" && Object.hasOwn(videoOwners, group.targetId)
          ? videoOwners[group.targetId]
          : undefined;
    if (owner) account(owner).reports += group.reportCount;
  }

  return [...accounts.values()]
    .sort((a, b) => b.held + b.reports - (a.held + a.reports) || b.reports - a.reports)
    .slice(0, limit);
}

export interface WaitingTile {
  label: string;
  /** Null when its source could not be read: a dash, never a zero. */
  count: number | null;
  detail: string;
  tone: "ok" | "warn" | "bad";
  href: string;
}

/** The dashboard's queues as they stand: held videos, reports, and data exports that went wrong. */
export function waitingTiles(input: {
  /** Null when the held listing could not be read. */
  held: { total: number; since: string | null } | null;
  /** `targets` is null when the queue could not be read; `since` is the oldest pending report. */
  reports: { pending: number; targets: number | null; since: string | null };
  exports: Pick<DataExportSummaryResponse, "stalled" | "failed"> | null;
  now: number;
}): WaitingTile[] {
  const { held, reports, exports, now } = input;
  return [heldTile(held, now), reportsTile(reports, now), exportsTile(exports)];
}

function heldTile(held: { total: number; since: string | null } | null, now: number): WaitingTile {
  const base = { label: "Videos to review", href: "/moderation/review" };
  if (!held) return { ...base, count: null, detail: "Could not be read", tone: "ok" };
  if (held.total === 0 || !held.since) {
    return { ...base, count: held.total, detail: held.total === 0 ? "Queue is clear" : "Waiting", tone: "ok" };
  }
  const stale = isStale(held.since, now);
  return {
    ...base,
    count: held.total,
    detail: `Oldest held ${relativeTime(held.since, now)}${stale ? " — overdue" : ""}`,
    tone: stale ? "bad" : "ok",
  };
}

function reportsTile(
  reports: { pending: number; targets: number | null; since: string | null },
  now: number,
): WaitingTile {
  const base = { label: "Reports to decide", count: reports.pending, href: "/moderation/reports" };
  if (reports.pending === 0) return { ...base, detail: "Queue is clear", tone: "ok" };
  if (reports.targets === null && !reports.since) {
    return { ...base, detail: "Queue could not be read", tone: "ok" };
  }
  const stale = isStale(reports.since, now);
  const detail = [
    reports.targets !== null
      ? `${formatNumber(reports.targets)} ${plural(reports.targets, "target")}`
      : null,
    reports.since ? `oldest ${relativeTime(reports.since, now)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return { ...base, detail: stale ? `${detail} — overdue` : detail, tone: stale ? "bad" : "ok" };
}

function exportsTile(
  exports: Pick<DataExportSummaryResponse, "stalled" | "failed"> | null,
): WaitingTile {
  const base = { label: "Data export problems", href: "/system/queues" };
  if (!exports) return { ...base, count: null, detail: "Could not be read", tone: "ok" };
  const { tone } = dataExportHealth(exports);
  const count = exports.stalled + exports.failed;
  if (exports.stalled > 0) {
    const failed = exports.failed > 0 ? ` · ${formatNumber(exports.failed)} failed in 7 days` : "";
    return {
      ...base,
      count,
      detail: `${formatNumber(exports.stalled)} stalled past every retry${failed}`,
      tone,
    };
  }
  return {
    ...base,
    count,
    detail: exports.failed > 0 ? "Failed in the last 7 days" : "Running normally",
    tone,
  };
}
