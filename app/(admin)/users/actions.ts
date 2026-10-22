"use server";

import { revalidatePath } from "next/cache";
import { getModerationDetail, type ModerationDetail } from "@/lib/api/moderation";
import { liftCommentRestriction, moderateUser } from "@/lib/api/users";
import { bulkSummary, cleanReason, plainIds, runEach } from "@/lib/bulk";
import type { ModerationResult } from "@/lib/moderation";

/** One account's report count and moderation history, for its row in the users table. */
export async function userModerationDetailAction(userId: string): Promise<ModerationDetail> {
  return getModerationDetail("USER", userId);
}

/**
 * The status change is not visible the moment this returns. admin-service writes an outbox row,
 * the dispatcher publishes it, and auth-service applies it from the topic — so the revalidated
 * page can still show the old status for a beat. Saying so beats a spinner that lies.
 */
export async function moderateUserAction(
  userId: string,
  action: "ban" | "unban" | "warn" | "revokeSessions",
  reason: string,
  /** Days until the ban lapses; null is permanent. auth-service lifts it on a sweep. */
  banDays: number | null = null,
): Promise<ModerationResult> {
  if (!reason.trim()) {
    return { ok: false, message: "A reason is required — it goes into the audit log." };
  }

  try {
    await moderateUser(userId, action, reason.trim(), banDays);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }

  revalidatePath("/users");
  return { ok: true, message: recordedMessage(action, banDays) };
}

function recordedMessage(
  action: "ban" | "unban" | "warn" | "revokeSessions",
  banDays: number | null,
): string {
  switch (action) {
    case "ban":
      return banDays === null
        ? "Ban recorded. Sessions are revoked once auth-service consumes the event."
        : `Ban recorded for ${banDays} day${banDays === 1 ? "" : "s"}. It lifts on its own once the deadline passes.`;
    case "unban":
      return "Unban recorded. The account can sign in again once the event is consumed.";
    case "warn":
      return "Warning recorded. The account is notified once notification-service consumes the event.";
    case "revokeSessions":
      return "Sign-out recorded. Every session ends once auth-service consumes the event; the account stays active.";
  }
}

/**
 * No reason asked for, because none would be kept: this is not a decision against the account, so
 * admin-service records nothing and the Audit Log never shows it — interaction-service logs the
 * admin's id beside the account's. Unlike everything above, it applies at once; there is no event
 * to wait for.
 */
export async function liftCommentRestrictionAction(
  userId: string,
  /** Whether a restriction was in force, or only strikes counting toward one. */
  restricted: boolean,
): Promise<ModerationResult> {
  try {
    await liftCommentRestriction(userId);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }

  revalidatePath(`/users/${userId}`);
  return {
    ok: true,
    message: restricted
      ? "Restriction lifted — the account can comment again now, with no strikes against it. interaction-service logged it under your id; the Audit Log does not show it."
      : "Strikes cleared — the next restriction, if any, starts again from the shortest. interaction-service logged it under your id; the Audit Log does not show it.",
  };
}

/** One ban or unban for every ticked account, each written as its own audit entry. */
export async function bulkModerateUsersAction(
  userIds: string[],
  action: "ban" | "unban",
  reason: string,
  /** Days until the bans lapse; null is permanent. */
  banDays: number | null = null,
): Promise<ModerationResult> {
  const ids = plainIds(userIds);
  if (!ids || (action !== "ban" && action !== "unban")) {
    return { ok: false, message: "Nothing valid was selected." };
  }
  const why = cleanReason(reason);
  if (!why) {
    return { ok: false, message: "Give a reason of at most 1,000 characters — it goes into the audit log." };
  }
  if (banDays !== null && !(Number.isInteger(banDays) && banDays >= 1 && banDays <= 365)) {
    return { ok: false, message: "A ban lasts 1 to 365 days, or for good." };
  }

  const days = action === "ban" ? banDays : null;
  const outcome = await runEach(ids, (id) => moderateUser(id, action, why, days));

  revalidatePath("/users");
  return {
    ok: outcome.failed.length === 0,
    message:
      bulkSummary(outcome, action === "ban" ? "Banned" : "Unbanned", "account")
      + (outcome.done > 0 ? " Each status changes once auth-service consumes its event." : ""),
    failedIds: outcome.failed.map((failure) => failure.id),
  };
}
