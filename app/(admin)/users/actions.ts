"use server";

import { revalidatePath } from "next/cache";
import { getModerationDetail, type ModerationDetail } from "@/lib/api/moderation";
import { moderateUser } from "@/lib/api/users";
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
