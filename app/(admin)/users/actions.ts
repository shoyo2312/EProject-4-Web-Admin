"use server";

import { revalidatePath } from "next/cache";
import { moderateUser } from "@/lib/api/admin";

export interface ModerationResult {
  ok: boolean;
  message: string;
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
): Promise<ModerationResult> {
  if (!reason.trim()) {
    return { ok: false, message: "A reason is required — it goes into the audit log." };
  }

  try {
    await moderateUser(userId, action, reason.trim());
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }

  revalidatePath("/users");
  return {
    ok: true,
    message:
      action === "ban"
        ? "Ban recorded. Sessions are revoked once auth-service consumes the event."
        : "Unban recorded. The account can sign in again once the event is consumed.",
  };
}
