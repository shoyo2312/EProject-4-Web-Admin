import type {
  ModerationActionResponse,
  ModerationActionType,
  ReportResponse,
  ReportStatus,
  ReportTargetType,
  StatsSummaryResponse,
} from "@/lib/api/types";
import { mockCommentPage } from "./comments";
import { mockUsers } from "./users";
import { mockVideos } from "./videos";
import { MOCK_NOW, between, pick, seededRandom } from "./random";

const REASONS = [
  "Spam or misleading content",
  "Harassment or bullying",
  "Hate speech",
  "Nudity or sexual content",
  "Dangerous acts / challenges",
  "Sharing someone's private information",
  "Intellectual property violation",
  "Impersonation of another account",
  "Scam or fraudulent promotion",
  "Violent or graphic content",
] as const;

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

export const mockStatsSummary: StatsSummaryResponse = {
  pendingReports: mockReports.filter((r) => r.status === "PENDING").length,
  resolvedReports: mockReports.filter((r) => r.status === "RESOLVED").length,
  dismissedReports: mockReports.filter((r) => r.status === "DISMISSED").length,
  actionsLast24h: mockModerationActions.filter(
    (a) => MOCK_NOW - Date.parse(a.createdAt) < 24 * 60 * 60_000,
  ).length,
};
