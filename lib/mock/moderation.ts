import type {
  DailyAdminStatsResponse,
  ModerationActionResponse,
  ModerationActionType,
  ReportGroupResponse,
  ReportResponse,
  ReportStatus,
  ReportTargetType,
  StatsSummaryResponse,
} from "@/lib/api/types";
import { mockCommentPage } from "./comments";
import { mockUsers } from "./users";
import { mockVideos } from "./videos";
import { MOCK_NOW, between, pick, seededRandom } from "./random";

/**
 * The scenario labels the viewer-facing client actually sends (tiktok-cloned
 * `lib/api/reports.ts`), stored verbatim as the report's reason. Fixtures use the real strings
 * because admin-service ranks the queue by joining them against `report_reason_weights` — a
 * made-up label would rank at the unknown-scenario default and the mock queue would come back
 * in an order the live one never produces.
 */
const REASONS = [
  "Suicide and self-harm",
  "Violence, abuse, and criminal exploitation",
  "Nudity and sexual content",
  "Sharing personal information",
  "Hate and harassment",
  "Shocking and graphic content",
  "Dangerous activities and challenges",
  "Illegal activities and regulated goods",
  "Frauds and scams",
  "Deceptive behavior and spam",
  "Misinformation",
  "Intellectual property violation",
] as const;

/** Mirrors the `report_reason_weights` seed in admin-service `V5__report_queue.sql`. */
const REASON_WEIGHTS: Record<string, number> = {
  "Suicide and self-harm": 10,
  "Violence, abuse, and criminal exploitation": 9,
  "Nudity and sexual content": 8,
  "Sharing personal information": 7,
  "Hate and harassment": 6,
  "Shocking and graphic content": 5,
  "Dangerous activities and challenges": 4,
  "Illegal activities and regulated goods": 4,
  "Regulated goods and activities": 4,
  "Frauds and scams": 3,
  "Deceptive behavior and spam": 2,
  Misinformation: 2,
  "Intellectual property violation": 1,
  "Counterfeits and intellectual property": 1,
};

const TARGET_TYPES: ReportTargetType[] = ["VIDEO", "USER", "COMMENT"];

/**
 * A report points at something that exists in the other fixtures rather than at a loose id: the
 * queue's expanded row fetches the target back to show what is being judged, and an id matching
 * nothing would render every preview as a gap.
 *
 * A COMMENT target is "videoId:commentId" — the shape admin-service's CommentTarget parses, and
 * what the client sends, because Cassandra partitions comments by video.
 */
function mockTargetId(rand: () => number, type: ReportTargetType): string {
  if (type === "USER") return pick(rand, mockUsers).id;
  const video = pick(rand, mockVideos);
  if (type === "VIDEO") return video.id;
  return `${video.id}:${pick(rand, mockCommentPage(video.id, "THREAD", null, 25).items).commentId}`;
}

/** Reporter handles are display-only; the API returns a numeric reporterId. */
const HANDLES = [
  "ryan_korsgaard",
  "madelyn.lubin",
  "abram_bergson",
  "phillip.mango",
  "tara_nguyen",
  "kenji.watanabe",
  "lucia_moreno",
  "omar_haddad",
  "sofia.ricci",
  "dev_null",
  "minh.hoang",
  "grace_tan",
] as const;

/** Snowflake-shaped ids: 19 digits, kept as strings end to end. */
function snowflake(rand: () => number, offset: number) {
  return String(7_250_000_000_000_000_000n + BigInt(offset * 104_729 + between(rand, 1, 9_999)));
}

export const MOCK_REPORTER_HANDLES: Record<string, string> = {};

export const mockReports: ReportResponse[] = (() => {
  const rand = seededRandom(20260813);
  return Array.from({ length: 42 }, (_, i) => {
    const id = snowflake(rand, i);
    const reporterId = snowflake(rand, i + 500);
    MOCK_REPORTER_HANDLES[reporterId] = HANDLES[i % HANDLES.length];

    // Most of the queue is unresolved — that is what makes the queue worth looking at.
    const roll = rand();
    const status: ReportStatus =
      roll < 0.55 ? "PENDING" : roll < 0.82 ? "RESOLVED" : "DISMISSED";
    const createdAt = new Date(MOCK_NOW - between(rand, 5, 60 * 24 * 9) * 60_000);
    const resolved = status !== "PENDING";

    const targetType = pick(rand, TARGET_TYPES);

    return {
      id,
      reporterId,
      targetType,
      targetId: mockTargetId(rand, targetType),
      reason: pick(rand, REASONS),
      status,
      resolvedBy: resolved ? snowflake(rand, 7) : null,
      resolvedAt: resolved
        ? new Date(createdAt.getTime() + between(rand, 20, 900) * 60_000).toISOString()
        : null,
      createdAt: createdAt.toISOString(),
    };
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
})();

const ACTION_TYPES: ModerationActionType[] = [
  "TAKEDOWN_VIDEO",
  "RESTORE_VIDEO",
  "BAN_USER",
  "UNBAN_USER",
  "WARN_USER",
  "REMOVE_COMMENT",
  "DISMISS_REPORT",
];

export const mockModerationActions: ModerationActionResponse[] = (() => {
  const rand = seededRandom(88117);
  return Array.from({ length: 30 }, (_, i) => {
    const actionType = pick(rand, ACTION_TYPES);
    const targetType: ReportTargetType = actionType.includes("VIDEO")
      ? "VIDEO"
      : actionType.includes("USER")
        ? "USER"
        : actionType.includes("COMMENT")
          ? "COMMENT"
          : pick(rand, TARGET_TYPES);

    return {
      id: snowflake(rand, i + 3000),
      adminId: snowflake(rand, 7),
      actionType,
      targetType,
      targetId: mockTargetId(rand, targetType),
      reason: pick(rand, REASONS),
      reportId: rand() < 0.75 ? snowflake(rand, i) : null,
      createdAt: new Date(MOCK_NOW - between(rand, 10, 60 * 24 * 6) * 60_000).toISOString(),
    };
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
})();

/**
 * The worklist the way admin-service builds it: standing reports grouped by target, ordered by
 * `reportCount × severity` with the longest wait breaking ties. Derived from mockReports rather
 * than generated separately, so the grouped queue and the report ledger cannot disagree about
 * how many reports stand against one target.
 */
export const mockReportQueue: ReportGroupResponse[] = (() => {
  const groups = new Map<string, ReportResponse[]>();
  for (const report of mockReports) {
    if (report.status !== "PENDING") continue;
    const key = `${report.targetType}\u0000${report.targetId}`;
    groups.set(key, [...(groups.get(key) ?? []), report]);
  }

  return [...groups.values()]
    .map((reports) => {
      // Newest first, as the ledger fixture is sorted.
      const dates = reports.map((r) => r.createdAt).sort();
      // 2 for an unrecognised scenario — the same default the queue query applies.
      const severity = Math.max(...reports.map((r) => REASON_WEIGHTS[r.reason] ?? 2));
      return {
        targetType: reports[0].targetType,
        targetId: reports[0].targetId,
        reportCount: reports.length,
        firstReportedAt: dates[0],
        lastReportedAt: dates[dates.length - 1],
        latestReason: reports[0].reason,
        severity,
        priority: reports.length * severity,
      };
    })
    .sort(
      (a, b) =>
        b.priority - a.priority || a.firstReportedAt.localeCompare(b.firstReportedAt),
    );
})();

export const mockStatsSummary: StatsSummaryResponse = {
  pendingReports: mockReports.filter((r) => r.status === "PENDING").length,
  resolvedReports: mockReports.filter((r) => r.status === "RESOLVED").length,
  dismissedReports: mockReports.filter((r) => r.status === "DISMISSED").length,
  actionsLast24h: mockModerationActions.filter(
    (a) => MOCK_NOW - Date.parse(a.createdAt) < 24 * 60 * 60_000,
  ).length,
};

/** Reports filed and actions taken per day — bucketed from the same fixtures the tables read. */
export function mockDailyAdminStats(days = 7): DailyAdminStatsResponse[] {
  const dayString = (daysAgo: number) =>
    new Date(MOCK_NOW - daysAgo * 24 * 60 * 60_000).toISOString().slice(0, 10);
  const rows: DailyAdminStatsResponse[] = [];
  for (let d = days - 1; d >= 0; d--) {
    const day = dayString(d);
    rows.push({
      day,
      reportsCreated: mockReports.filter((r) => r.createdAt.slice(0, 10) === day).length,
      actionsTaken: mockModerationActions.filter((a) => a.createdAt.slice(0, 10) === day).length,
    });
  }
  return rows;
}
