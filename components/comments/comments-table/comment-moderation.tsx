import { TextFlags } from "@/components/moderation/text-flags";
import type { AdminCommentResponse } from "@/lib/api/types";
import { reasonFlags } from "@/lib/text-flags";

/**
 * What text moderation made of a comment. A held one was never public: it waits for the video's
 * owner, and the flags say why. A posted one with flags is something a filter let through — a link
 * its owner waived, a classifier's note — which is where a filter's misses and false alarms show,
 * so it has to stand out from the rows nothing fired on.
 */
export function CommentModeration({ comment }: { comment: AdminCommentResponse }) {
  const held = comment.status === "HELD";
  const flags = reasonFlags(comment.moderationReason);
  if (!held && flags.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
      <span
        title={
          held
            ? "Never public: it waits for the video's owner to approve it."
            : "Text moderation flagged it and let it through anyway."
        }
        className="rounded border border-pending/25 bg-pending-bg px-1.5 py-0.5 font-medium text-pending"
      >
        {held ? "Held for the creator" : comment.deletedAt ? "Flagged" : "Flagged, still public"}
      </span>
      {flags.length > 0 ? <TextFlags flags={flags} /> : null}
    </div>
  );
}
