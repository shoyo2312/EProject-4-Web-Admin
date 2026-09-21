"use server";

import { revalidatePath } from "next/cache";
import {
  getReportCount,
  listTargetActions,
  moderateUser,
} from "@/lib/api/admin";
import type { ModerationActionResponse } from "@/lib/api/types";

export interface ModerationResult {
  ok: boolean;
  message: string;
}

export interface ModerationDetail {
  reportCount: number;
  actions: ModerationActionResponse[];
}

/**
 * The report count and the moderation-action log for one account, fetched together. Called from
 * the table's expandable row so nothing loads until an admin opens it.
 */
export async function userModerationDetailAction(
  userId: string,
): Promise<ModerationDetail> {
  const [reportCount, actions] = await Promise.all([
    getReportCount("USER", userId),
    listTargetActions("USER", userId),
  ]);
  return { reportCount, actions };
}

/**
 * The status change is not visible the moment this returns. admin-service writes an outbox row,
 * the dispatcher publishes it, and auth-service applies it from the topic — so the revalidated
 * page can still show the old status for a beat. Saying so beats a spinner that lies.
 */
export async function moderateUserAction(
  userId: string,
  action: "ban" | "unban",
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
  return {
    ok: true,
    message:
      action === "ban"
        ? banDays === null
          ? "Ban recorded. Sessions are revoked once auth-service consumes the event."
          : `Ban recorded for ${banDays} day${banDays === 1 ? "" : "s"}. It lifts on its own once the deadline passes.`
        : "Unban recorded. The account can sign in again once the event is consumed.",
  };
}
