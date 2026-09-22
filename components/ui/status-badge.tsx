import type { UserStatus, VideoStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const OK = "border-success/25 bg-success-bg text-success";
const HELD = "border-pending/25 bg-pending-bg text-pending";
const BAD = "border-danger/25 bg-danger-bg text-danger";
const NEUTRAL = "border-line bg-neutral-bg text-neutral";

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
        "inline-flex items-center rounded-md border px-2 text-[11px] font-medium",
        dense ? "py-0.5" : "py-1",
        style,
        dimmed && "opacity-50",
      )}
    >
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
      {status}
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
      {status}
    </Pill>
  );
}
