"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { NotificationRow } from "@/components/notifications/notification-row";
import { countUnread, newestAt, type AdminNotification } from "@/lib/notifications";
import { rememberNotificationsSeen } from "@/lib/notifications-seen";
import { cn } from "@/lib/utils";

export function NotificationBell({
  items,
  seenAt: initialSeenAt,
  now,
}: {
  /** Null when the feed could not be loaded — shown as such, not as an empty inbox. */
  items: AdminNotification[] | null;
  seenAt: number;
  now: number;
}) {
  const [open, setOpen] = useState(false);
  const [seenAt, setSeenAt] = useState(initialSeenAt);
  // What was unread when the panel opened, so those rows stay marked while it is open.
  const [highlightAfter, setHighlightAfter] = useState(initialSeenAt);
  const ref = useRef<HTMLDivElement>(null);
  // The notification centre marks the feed seen too, and its reload hands the newer cookie back in.
  if (initialSeenAt > seenAt) setSeenAt(initialSeenAt);
  const unread = items ? countUnread(items, seenAt) : 0;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setHighlightAfter(seenAt);
    const seen = Math.max(seenAt, newestAt(items ?? []));
    if (seen === seenAt) return;
    setSeenAt(seen);
    rememberNotificationsSeen(seen);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-controls="notification-panel"
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink",
          open && "bg-surface-muted text-ink",
        )}
      >
        <Bell className="h-4 w-4" />
        {unread ? (
          <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-on-accent ring-2 ring-canvas">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          id="notification-panel"
          role="dialog"
          aria-label="Notifications"
          className="fixed inset-x-4 top-[72px] z-20 overflow-hidden rounded-2xl border border-line bg-surface shadow-pop sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-[380px]"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-[14px] font-semibold">Notifications</span>
            {unread ? (
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
                {unread} new
              </span>
            ) : null}
          </div>

          {items === null ? (
            <p className="px-4 py-8 text-center text-[13px] text-ink-faint">
              Couldn&apos;t load notifications. The next refresh will try again.
            </p>
          ) : items.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-ink-faint">
              Nothing is waiting on you.
            </p>
          ) : (
            <ul className="max-h-[420px] divide-y divide-line overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <NotificationRow
                    item={item}
                    fresh={Date.parse(item.at) > highlightAfter}
                    now={now}
                    onOpen={() => setOpen(false)}
                  />
                </li>
              ))}
            </ul>
          )}

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-line px-4 py-2.5 text-center text-[12px] font-medium text-accent transition-colors hover:bg-surface-muted"
          >
            See all notifications
          </Link>
        </div>
      ) : null}
    </div>
  );
}
