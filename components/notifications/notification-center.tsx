"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NotificationRow } from "@/components/notifications/notification-row";
import { Card, CardHeader } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { formatDate, formatNumber } from "@/lib/format";
import { NOTIFICATION_KIND_LABELS } from "@/lib/labels";
import {
  countByKind,
  countUnread,
  dayHeading,
  groupByDay,
  newestAt,
  type AdminNotification,
  type NotificationKind,
} from "@/lib/notifications";
import { rememberNotificationsSeen } from "@/lib/notifications-seen";

const KINDS = Object.keys(NOTIFICATION_KIND_LABELS) as NotificationKind[];

/**
 * The whole feed, by day, with a filter per kind. Opening it marks everything seen, as opening the
 * bell does; what was new on arrival keeps its dot until the page is left.
 */
export function NotificationCenter({
  items,
  seenAt,
  now,
}: {
  items: AdminNotification[];
  /** The seen cookie as the server read it for this render. */
  seenAt: number;
  now: number;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<NotificationKind | "all">("all");
  // Kept from the first render: after marking everything seen the cookie no longer says what was new.
  const [highlightAfter] = useState(seenAt);
  const newest = newestAt(items);

  useEffect(() => {
    if (newest <= seenAt) return;
    rememberNotificationsSeen(newest);
    // A reload carries the new cookie to the layout, which hands it to the bell and clears its count.
    router.refresh();
  }, [newest, seenAt, router]);

  // Counted against the first render's cookie too: once the page has marked the feed seen, the
  // server's own count is zero.
  const unread = countUnread(items, highlightAfter);
  const counts = countByKind(items);
  const options = [
    { value: "all" as const, label: `All ${items.length}` },
    ...KINDS.filter((k) => counts[k]).map((k) => ({
      value: k,
      label: `${NOTIFICATION_KIND_LABELS[k]} ${counts[k]}`,
    })),
  ];
  const days = groupByDay(kind === "all" ? items : items.filter((item) => item.kind === kind));

  return (
    <div className="stagger space-y-3">
      <p className="text-[13px] text-ink-soft">
        {unread > 0
          ? `${formatNumber(unread)} new since you last looked — marked as seen now.`
          : "Nothing new since you last looked."}
      </p>
      <Card>
        <CardHeader
          title="Waiting on an admin"
          hint="Built from the queues themselves: an item leaves once it is dealt with, so this is what is open now rather than a history."
          actions={<Segmented options={options} value={kind} onChange={setKind} />}
        />
        {days.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-ink-faint">
            Nothing is waiting on you.
          </p>
        ) : (
          days.map(({ day, items: onDay }) => (
            <section key={day}>
              <h3 className="label border-b border-line bg-surface-muted px-4 py-1.5 text-[11px] text-ink-faint">
                {dayHeading(day, now) ?? formatDate(day)}
              </h3>
              <ul className="divide-y divide-line border-b border-line last:border-b-0">
                {onDay.map((item) => (
                  <li key={item.id}>
                    <NotificationRow
                      item={item}
                      fresh={Date.parse(item.at) > highlightAfter}
                      now={now}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </Card>
    </div>
  );
}
