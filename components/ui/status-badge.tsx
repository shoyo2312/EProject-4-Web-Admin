import type { UserStatus, VideoStatus } from "@/lib/api/types";
import { USER_STATUS_LABELS, VIDEO_STATUS_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

const OK = "bg-success-bg text-success";
const HELD = "bg-pending-bg text-pending";
const BAD = "bg-danger-bg text-danger";
const NEUTRAL = "bg-neutral-bg text-neutral";

/**
 * One colour per state, in one place: the same status has to read the same on the directory,
 * on the target's own page and on the thumbnail grid, or the colour stops meaning anything.
 * Exported for the few places that need the colour without the badge's own box.
 */
export const VIDEO_STATUS_STYLES: Record<VideoStatus, string> = {
  PUBLISHED: OK,
  PROCESSING: HELD,
  PENDING_MODERATION: HELD,
  PENDING_REVIEW: HELD,
  FAILED: BAD,
  REJECTED: BAD,
  TAKEN_DOWN: BAD,
};

export const USER_STATUS_STYLES: Record<UserStatus, string> = {
  ACTIVE: OK,
  BANNED: BAD,
  LOCKED: NEUTRAL,
  DEACTIVATED: NEUTRAL,
};

function Pill({
  style,
  dense,
  dimmed,
  children,
}: {
  style: string;
  dense?: boolean;
  /**
   * An enforcement is in flight. The badge is still showing the old state truthfully, and
   * pretending it already flipped would be a lie the next reload contradicts.
   */
  dimmed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium whitespace-nowrap",
        dense ? "py-0.5" : "py-1",
        style,
        dimmed && "opacity-50",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function VideoStatusBadge({
  status,
  dense,
  dimmed,
}: {
  status: VideoStatus;
  dense?: boolean;
  dimmed?: boolean;
}) {
  return (
    <Pill style={VIDEO_STATUS_STYLES[status]} dense={dense} dimmed={dimmed}>
      {VIDEO_STATUS_LABELS[status]}
    </Pill>
  );
}

export function UserStatusBadge({
  status,
  dense,
  dimmed,
}: {
  status: UserStatus;
  dense?: boolean;
  dimmed?: boolean;
}) {
  return (
    <Pill style={USER_STATUS_STYLES[status]} dense={dense} dimmed={dimmed}>
      {USER_STATUS_LABELS[status]}
    </Pill>
  );
}
