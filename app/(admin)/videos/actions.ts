"use server";

import { revalidatePath } from "next/cache";
import { moderateVideo } from "@/lib/api/admin";

export interface ModerationResult {
  ok: boolean;
  message: string;
}

/**
 * The status change is not visible the moment this returns. admin-service writes an outbox row,
 * the dispatcher publishes it, and video-service applies it from admin.moderation-events — so the
 * revalidated page can still show the old status for a beat. Saying so beats a spinner that lies.
 */
export async function moderateVideoAction(
  videoId: string,
  action: "takedown" | "restore",
  reason: string,
): Promise<ModerationResult> {
  if (!reason.trim()) {
    return { ok: false, message: "A reason is required — it goes into the audit log." };
  }

  try {
    await moderateVideo(videoId, action, reason.trim());
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }

  revalidatePath("/videos");
  return {
    ok: true,
    message:
      action === "takedown"
        ? "Takedown recorded. The video leaves the feed once video-service consumes the event."
        : "Restore recorded. The video returns to whatever state it was in before the takedown, not necessarily PUBLISHED.",
  };
}
