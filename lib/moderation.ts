import type { ModerationActionType } from "@/lib/api/types";

/**
 * Action types with a live downstream consumer today:
 * video-service (takedown/restore), auth-service (ban/unban),
 * interaction-service (comment removal). The rest are recorded in
 * moderation_actions and published to admin.moderation-events with no
 * subscriber, so the log says so rather than implying the action landed.
 *
 * Lives outside the client component so server components can read the
 * array itself instead of a client reference proxy.
 */
export const ENFORCED: ModerationActionType[] = [
  "TAKEDOWN_VIDEO",
  "RESTORE_VIDEO",
  "BAN_USER",
  "UNBAN_USER",
  "REMOVE_COMMENT",
];
