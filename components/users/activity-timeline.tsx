import Link from "next/link";
import {
  Ban,
  CircleCheck,
  CircleSlash,
  Flag,
  KeyRound,
  LogIn,
  LogOut,
  MailCheck,
  MonitorCheck,
  ShieldAlert,
  ShieldX,
  Smartphone,
  Trash2,
  TriangleAlert,
  UserPlus,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { ActivityCategory, ActivityEvent } from "@/lib/activity";
import { formatDate, formatDateTime, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * One account's history as a dated list, newest first. Purely presentational — the route owns
 * the fetching, the merge and the slice, and hands down the page it wants drawn.
 */

const CATEGORY_STYLES: Record<ActivityCategory, { label: string; dot: string }> = {
  security: { label: "Security", dot: "border-pending/30 bg-pending-bg text-pending" },
  content: { label: "Content", dot: "border-line bg-neutral-bg text-neutral" },
  moderation: { label: "Moderation", dot: "border-danger/30 bg-danger-bg text-danger" },
};

/** Falls back to the category's own icon, so an unmapped kind still draws a row. */
const KIND_ICONS: Record<string, LucideIcon> = {
  "account.created": UserPlus,
  "account.email_verified": MailCheck,
  "account.last_login": LogIn,
  "account.banned": Ban,
  "security.login_succeeded": LogIn,
  "security.login_failed": TriangleAlert,
  "security.logout": LogOut,
  "security.password_reset_requested": KeyRound,
  "security.password_reset_completed": KeyRound,
  "security.email_changed": MailCheck,
  "security.email_verified": MailCheck,
  "security.mfa_challenged": Smartphone,
  "security.device_remembered": MonitorCheck,
  "security.sessions_revoked": ShieldX,
  "moderation.ban_user": Ban,
  "moderation.unban_user": CircleCheck,
  "moderation.takedown_video": ShieldAlert,
  "moderation.restore_video": CircleCheck,
  "moderation.remove_comment": CircleSlash,
  "moderation.warn_user": ShieldAlert,
  "video.uploaded": Video,
  "video.deleted": Trash2,
  "video.taken_down": ShieldAlert,
  "report.filed": Flag,
  "report.received": Flag,
};

const CATEGORY_FALLBACK: Record<ActivityCategory, LucideIcon> = {
  security: ShieldAlert,
  content: Video,
  moderation: Flag,
};

export function ActivityTimeline({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-[12px] text-ink-faint">
        Nothing recorded for this account in the categories selected.
      </p>
    );
  }

  return (
    <ol className="px-5 py-2">
      {events.map((event) => (
        <ActivityRow key={event.id} event={event} />
      ))}
    </ol>
  );
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  const style = CATEGORY_STYLES[event.category];
  const Icon = KIND_ICONS[event.kind] ?? CATEGORY_FALLBACK[event.category];
  // relativeTime gives up past 30 days and returns the date, which most of a history is —
  // printing it next to the exact timestamp would be the same date twice.
  const relative = relativeTime(event.at);
  const isRelative = relative !== formatDate(event.at);

  return (
    <li className="group relative flex gap-3 py-3">
      {/* The spine: a rule behind the markers, stopped at the last one so the list reads as
          ending rather than trailing off. */}
      <span
        aria-hidden
        className="absolute top-8 bottom-0 left-[13px] w-px bg-line group-last:hidden"
      />

      {/* `relative` and no z-index: the marker only has to cover the spine, and it already
          does — the spine is the earlier sibling and both are positioned, so DOM order paints
          this on top. A z-index here would make it compete with the sticky topbar's own z-10
          and ride over it while scrolling. Static would lose to the absolutely-positioned
          spine, which would draw the line across the icon. */}
      <span
        className={cn(
          "relative flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-full border",
          style.dot,
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[12px] font-medium wrap-anywhere">
            {event.href ? (
              <Link href={event.href as never} className="underline-offset-4 hover:underline">
                {event.summary}
              </Link>
            ) : (
              event.summary
            )}
          </span>
          <span className="label-caps text-[10px] text-ink-faint">{style.label}</span>
        </div>

        {event.detail ? (
          <p className="mt-0.5 text-[11px] text-ink-soft wrap-anywhere">{event.detail}</p>
        ) : null}

        <p className="mt-0.5 text-[11px] text-ink-faint">
          {/* Exact moment first, relative second: a compliance trail is read by date, and the
              relative form is the orientation, not the record. */}
          <time dateTime={event.at} title={event.at}>
            {formatDateTime(event.at)}
          </time>
          {isRelative ? <span> · {relative}</span> : null}
          {event.actor ? <span> · {event.actor}</span> : null}
          {event.approximate ? (
            <span
              className="text-pending"
              title="The exact moment is not recorded; this is the closest timestamp the service keeps."
            >
              {" "}
              · approximate
            </span>
          ) : null}
        </p>
      </div>
    </li>
  );
}
