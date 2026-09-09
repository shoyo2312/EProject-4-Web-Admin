"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Ban, Search, ShieldCheck } from "lucide-react";
import { moderateUserAction } from "@/app/(admin)/users/actions";
import { Card, CardHeader } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import type { AdminUserResponse, UserStatus } from "@/lib/api/types";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type StatusFilter = UserStatus | "ALL";

const STATUS_FILTERS = [
  { value: "ALL" as const, label: "All" },
  { value: "ACTIVE" as const, label: "Active" },
  { value: "BANNED" as const, label: "Banned" },
  { value: "LOCKED" as const, label: "Locked" },
];

const STATUS_STYLES: Record<UserStatus, string> = {
  ACTIVE: "border-success/25 bg-success-bg text-success",
  BANNED: "border-danger/25 bg-danger-bg text-danger",
  LOCKED: "border-line bg-neutral-bg text-neutral",
};

/**
 * Preset reasons, per action. They are written to read on their own months later, because what
 * ends up in the audit row is this exact string and nothing else — "spam" alone tells a reviewer
 * nothing about what the account actually did.
 *
 * Shortcuts, not a closed list: a preset fills the box and the box stays editable, so an admin can
 * pick the closest one and add the specifics. That is also the "other" case — there is no separate
 * mode to switch into, just an empty box.
 */
const PRESET_REASONS: Record<"ban" | "unban", readonly string[]> = {
  ban: [
    "Repeated policy violations",
    "Spam or bot activity",
    "Harassment or hate speech",
    "Sexual content involving a minor",
    "Scam or fraudulent selling",
    "Impersonating another person",
    "Ban evasion — duplicate account",
    "Compromised account",
  ],
  unban: [
    "Appeal upheld — no violation",
    "Banned in error",
    "Reviewed again, within policy",
    "Account recovered by its owner",
  ],
};

/**
 * When to re-read after a successful action, in milliseconds from the submit.
 *
 * The write is not the state change: admin-service records the action and publishes it, and
 * auth-service applies it only when it consumes the event — so a refetch fired the instant the
 * POST returns reliably reads the old status back. Bounded rather than a live poll: if it has not
 * landed inside this window something is wrong with the pipeline, and retrying forever would hide
 * that rather than show it.
 */
const REFRESH_AT = [900, 2500, 6000];
const GIVE_UP_AT = 9000;

export function UsersTable({
  users,
  query,
  status,
}: {
  users: AdminUserResponse[];
  query: string;
  status: StatusFilter;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [term, setTerm] = useState(query);
  const [navigating, startNavigation] = useTransition();

  // Filtering happens on the server, so the box drives the URL. Debounced because every
  // keystroke would otherwise be a round trip through the gateway to auth-service.
  useEffect(() => {
    if (term === query) return;
    const timer = setTimeout(() => {
      startNavigation(() => router.replace(buildHref(pathname, params, term, status)));
    }, 350);
    return () => clearTimeout(timer);
  }, [term, query, status, pathname, params, router]);

  function changeStatus(next: StatusFilter) {
    startNavigation(() => router.replace(buildHref(pathname, params, term, next)));
  }

  return (
    <Card>
      <CardHeader
        title="User Directory"
        hint="GET /api/v1/auth/admin/users — served by auth-service, which owns status and role"
        actions={
          <>
            <label className="flex w-[180px] items-center gap-2 rounded-lg border border-line bg-surface-muted px-2.5 py-1.5 lg:w-[240px]">
              <Search className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search username or email..."
                className="min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:text-ink-faint"
              />
            </label>
            <Segmented
              options={STATUS_FILTERS}
              value={status}
              onChange={changeStatus}
            />
          </>
        }
      />

      <div className={cn("overflow-x-auto transition-opacity", navigating && "opacity-50")}>
        <table className="w-full min-w-[860px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="label-caps px-5 py-3 text-ink-soft">Username</th>
              <th className="label-caps px-3 py-3 text-ink-soft">Email</th>
              <th className="label-caps px-3 py-3 text-ink-soft">Role</th>
              <th className="label-caps px-3 py-3 text-ink-soft">Status</th>
              <th className="label-caps px-3 py-3 text-ink-soft">Joined</th>
              <th className="label-caps px-5 py-3 text-right text-ink-soft">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <UserRow key={user.id} user={user} />
            ))}

            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-ink-faint">
                  No accounts match this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function UserRow({ user }: { user: AdminUserResponse }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();
  /**
   * The status this row had when its action was submitted, or null when nothing is in flight.
   *
   * Held as what the account is moving *away from*, not what it is moving *to*: an unban returns
   * the account to whatever it was before, which is not necessarily ACTIVE — a LOCKED account
   * stays locked. Any value other than this one means it landed.
   */
  const [awaiting, setAwaiting] = useState<UserStatus | null>(null);

  /** Still moving: the row is showing the status it had when the action went in. */
  const pending = awaiting !== null && user.status === awaiting;

  useEffect(() => {
    if (awaiting === null) return;
    const timers: ReturnType<typeof setTimeout>[] = [];

    if (pending) {
      REFRESH_AT.forEach((ms) => timers.push(setTimeout(() => router.refresh(), ms)));
      timers.push(
        setTimeout(() => {
          setAwaiting(null);
          setResult(
            "Still the old status — auth-service has not consumed the event yet. The action is recorded; reload in a moment.",
          );
        }, GIVE_UP_AT),
      );
    } else {
      // Landed. The marker is dropped on the next tick rather than inside the effect body,
      // so a later return to this same status is not read as a fresh action in flight.
      timers.push(setTimeout(() => setAwaiting(null), 0));
    }

    return () => timers.forEach(clearTimeout);
  }, [awaiting, pending, router]);

  const action = user.status === "BANNED" ? "unban" : "ban";
  const presets = PRESET_REASONS[action];

  function choosePreset(preset: string) {
    // Toggling off leaves an empty box rather than the previous text: clicking the highlighted
    // chip is how an admin says "not that one", and re-showing what they just rejected is wrong.
    setReason((current) => (current === preset ? "" : preset));
    inputRef.current?.focus();
  }
  // An admin who bans themselves loses the console with no way back in — the bootstrap
  // account is provisioned at startup and there is no second admin to undo it.
  const selfDestructive = user.role === "ADMIN" && action === "ban";

  function submit() {
    startSubmit(async () => {
      const outcome = await moderateUserAction(user.id, action, reason ?? "");
      setResult(outcome.message);
      if (outcome.ok) {
        setReason(null);
        setAwaiting(user.status);
      }
    });
  }

  return (
    <>
      <tr className="border-b border-line transition-colors last:border-b-0 hover:bg-surface-muted">
        <td className="px-5 py-3 whitespace-nowrap">
          <span className="font-medium">@{user.username}</span>
        </td>
        <td className="px-3 py-3 whitespace-nowrap">
          {user.email ? (
            <span className={cn(!user.emailVerified && "text-pending")}>
              {user.email}
              {!user.emailVerified ? " (unverified)" : ""}
            </span>
          ) : (
            <span className="text-ink-faint">— social login</span>
          )}
        </td>
        <td className="px-3 py-3">
          <span className="rounded border border-line bg-surface-muted px-1.5 py-0.5 text-[10px] tracking-wider text-ink-soft">
            {user.role}
          </span>
        </td>
        <td className="px-3 py-3">
          <span
            className={cn(
              "inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-medium",
              STATUS_STYLES[user.status],
              // Dimmed while the event is in flight: the badge is still showing the old
              // status truthfully, and pretending it already flipped would be a lie the
              // next reload contradicts.
              pending && "opacity-50",
            )}
          >
            {user.status}
          </span>
          {pending ? (
            <span className="ml-2 text-[10px] text-ink-faint">applying…</span>
          ) : null}
        </td>
        <td className="px-3 py-3 whitespace-nowrap text-ink-faint">
          {relativeTime(user.createdAt)}
        </td>
        <td className="px-5 py-3 text-right">
          <button
            type="button"
            // Disabled until the change lands, so a second click cannot queue the same
            // action twice against a status that has not moved yet.
            disabled={selfDestructive || pending}
            onClick={() => setReason(reason === null ? "" : null)}
            title={
              selfDestructive
                ? "Banning an admin account would lock the console"
                : undefined
            }
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[11px] transition-colors",
              selfDestructive || pending
                ? "cursor-not-allowed text-ink-faint"
                : "hover:bg-surface",
              action === "ban" && !selfDestructive && !pending && "text-danger",
            )}
          >
            {action === "ban" ? (
              <Ban className="h-3.5 w-3.5" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5" />
            )}
            {action === "ban" ? "Ban" : "Unban"}
          </button>
        </td>
      </tr>

      {reason !== null ? (
        <tr className="border-b border-line bg-surface-muted">
          <td colSpan={6} className="px-5 py-3">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={reason === preset}
                  onClick={() => choosePreset(preset)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                    reason === preset
                      ? "border-ink bg-ink text-surface"
                      : "border-line bg-surface text-ink-soft hover:bg-canvas",
                  )}
                >
                  {preset}
                </button>
              ))}
              <button
                type="button"
                onClick={() => choosePreset("")}
                className="rounded-full border border-dashed border-line px-2.5 py-1 text-[11px] text-ink-faint transition-colors hover:bg-canvas"
              >
                Other…
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={`Reason for ${action}ning @${user.username} — pick one above or write your own`}
                className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-[11px] outline-none placeholder:text-ink-faint"
              />
              <button
                type="button"
                onClick={submit}
                disabled={submitting || !reason.trim()}
                className="rounded-md bg-ink px-3 py-2 text-[11px] text-surface transition-opacity hover:opacity-85 disabled:opacity-40"
              >
                {submitting ? "Submitting..." : `Confirm ${action}`}
              </button>
              <button
                type="button"
                onClick={() => setReason(null)}
                className="rounded-md border border-line bg-surface px-3 py-2 text-[11px] transition-colors hover:bg-canvas"
              >
                Cancel
              </button>
            </div>
          </td>
        </tr>
      ) : null}

      {result ? (
        <tr className="border-b border-line">
          <td colSpan={6} className="px-5 py-2 text-[11px] text-ink-soft">
            {result}
          </td>
        </tr>
      ) : null}
    </>
  );
}

/**
 * Built from the current params rather than from scratch, so changing the status filter does not
 * silently drop the header's date filter — the page would then show rows the picker excludes.
 */
function buildHref(
  pathname: string,
  params: URLSearchParams,
  term: string,
  status: StatusFilter,
) {
  const next = new URLSearchParams(params);
  if (term.trim()) next.set("q", term.trim());
  else next.delete("q");
  if (status !== "ALL") next.set("status", status);
  else next.delete("status");
  const query = next.toString();
  return (query ? `${pathname}?${query}` : pathname) as never;
}
