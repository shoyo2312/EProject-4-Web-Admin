"use server";

import { revalidatePath } from "next/cache";
import { removeComment } from "@/lib/api/admin";

export interface ModerationResult {
  ok: boolean;
  message: string;
}

/**
 * The comment does not disappear the moment this returns. admin-service writes an outbox row, the
 * dispatcher publishes it, and interaction-service applies the soft delete when it consumes
 * admin.moderation-events — so the revalidated page can still list the comment for a beat. Saying
 * so beats a spinner that lies.
 */
export async function removeCommentAction(
  videoId: string,
  commentId: string,
  reason: string,
): Promise<ModerationResult> {
  if (!reason.trim()) {
    return { ok: false, message: "A reason is required — it goes into the audit log." };
  }

  try {
    await removeComment(videoId, commentId, reason.trim());
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }

  revalidatePath("/comments");
  return {
    ok: true,
    message:
      "Removal recorded. The comment leaves the thread once interaction-service consumes the event, and the video's comment count drops with it.",
  };
}
