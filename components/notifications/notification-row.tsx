import Link from "next/link";
import { Flag, Trash2, Upload, UserPlus, Video, type LucideIcon } from "lucide-react";
import { relativeTime } from "@/lib/format";
import type { AdminNotification, NotificationKind } from "@/lib/notifications";
import { cn } from "@/lib/utils";

const ICONS: Record<NotificationKind, LucideIcon> = {
  report: Flag,
  review: Video,
  trash: Trash2,
  signup: UserPlus,
  upload: Upload,
};

/** One feed item, linked to where it is dealt with — the same row in the bell and the centre. */
export function NotificationRow({
  item,
  fresh,
  now,
  onOpen,
}: {
  item: AdminNotification;
  /** Newer than what the admin had seen, so it carries the unread dot. */
  fresh: boolean;
  now: number;
  onOpen?: () => void;
}) {
  const Icon = ICONS[item.kind];

  return (
    <Link
      href={item.href}
      onClick={onOpen}
      className={cn(
        "flex gap-3 px-4 py-3 transition-colors hover:bg-surface-muted",
        fresh && "bg-accent-soft/50",
      )}
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-ink-soft">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium">{item.title}</span>
        <span className="block truncate text-[13px] text-ink-soft">{item.detail}</span>
        <span className="block text-[12px] text-ink-faint">{relativeTime(item.at, now)}</span>
      </span>
      {fresh ? (
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent">
          <span className="sr-only">Unread</span>
        </span>
      ) : null}
    </Link>
  );
}
