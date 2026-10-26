"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Ban, ShieldCheck } from "lucide-react";
import {
  bulkModerateUsersAction,
  moderateUserAction,
  userModerationDetailAction,
} from "@/app/(admin)/users/actions";
import { BulkBar, SelectAllCell, SelectCell, type BulkAction } from "@/components/moderation/bulk-bar";
import { Card, CardHeader } from "@/components/ui/card";
import { SearchBox } from "@/components/ui/search-box";
import { Segmented } from "@/components/ui/segmented";
import { UserStatusBadge } from "@/components/ui/status-badge";
import { Field, RowDetail, expandableRowProps } from "@/components/ui/row-detail";
import { ModerationHistory } from "@/components/moderation/moderation-history";
import { ReasonForm } from "@/components/moderation/reason-form";
import { closureNote } from "@/lib/account-closure";
import { USER_STATUS_LABELS, statusTabs } from "@/lib/labels";
import {
  BAN_DURATIONS,
  PRESET_REASONS,
  banDaysOf,
  userDecision,
  type BanDuration,
} from "@/lib/moderation";
import type { AdminUserResponse, UserStatus } from "@/lib/api/types";
import { formatDateTime, relativeTime } from "@/lib/format";
import { hrefWith } from "@/lib/url";
import { useBulkPropagation, usePropagation } from "@/lib/use-propagation";
import { useRowDetail } from "@/lib/use-row-detail";
import { useSelection, type Selection } from "@/lib/use-selection";
import { cn } from "@/lib/utils";

type StatusFilter = UserStatus | "ALL";

const STATUS_FILTERS = statusTabs(
  ["ACTIVE", "BANNED", "LOCKED", "DEACTIVATED"],
  USER_STATUS_LABELS,
);

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
  const [navigating, startNavigation] = useTransition();

  function go(term: string, next: StatusFilter) {
    const href = hrefWith(pathname, params, {
      q: term || null,
      status: next === "ALL" ? null : next,
      page: null,
    });
    startNavigation(() => router.replace(href as never));
  }

  // Admins cannot be ticked: one banning themselves loses the console, and there is no second admin.
  const selection = useSelection();
  const bulk = useBulkPropagation();
  const [bulkDuration, setBulkDuration] = useState<BanDuration>("permanent");
  const selectable = users.filter(
    (user) => user.role !== "ADMIN" && !bulk.pending(user.id, user.status),
  );
  const ticked = selectable.filter((user) => selection.selected.has(user.id));
  const tickedFor = (action: "ban" | "unban") =>
    ticked.filter((user) => userDecision(user.status) === action);
  const bulkActions: BulkAction<"ban" | "unban">[] = [
    {
      key: "ban",
      label: "Ban",
      count: tickedFor("ban").length,
      presets: PRESET_REASONS.ban,
      confirm: bulkDuration === "permanent" ? "Confirm ban" : `Ban for ${bulkDuration}d`,
      tone: "danger",
      extra: (
        <div className="flex flex-wrap items-center gap-2">
          <span className="label text-ink-soft">Duration</span>
          <Segmented options={BAN_DURATIONS} value={bulkDuration} onChange={setBulkDuration} />
        </div>
      ),
    },
    {
      key: "unban",
      label: "Unban",
      count: tickedFor("unban").length,
      presets: PRESET_REASONS.unban,
      confirm: "Confirm unban",
      tone: "success",
    },
  ];

  async function runBulk(action: "ban" | "unban", reason: string) {
    const rows = tickedFor(action);
    const days = action === "ban" ? banDaysOf(bulkDuration) : null;
    const outcome = await bulkModerateUsersAction(rows.map((user) => user.id), action, reason, days);
    const failed = new Set(outcome.failedIds);
    bulk.watch(rows.filter((user) => !failed.has(user.id)).map((user) => [user.id, user.status]));
    selection.set(
      ticked.filter((user) => !rows.includes(user) || failed.has(user.id)).map((user) => user.id),
    );
    // Permanent is the deliberate default, as on a single row: a length is chosen each time.
    setBulkDuration("permanent");
    return outcome;
  }

  return (
    <Card>
      <CardHeader
        title="User Directory"
        hint="Every account. Click a row for its details; a ban is recorded in the audit log and signs the account out."
        actions={
          <>
            <SearchBox
              query={query}
              onCommit={(term) => go(term, status)}
              placeholder="Search username or email..."
            />
            <Segmented
              options={STATUS_FILTERS}
              value={status}
              onChange={(next) => go(query, next)}
            />
          </>
        }
      />

      <BulkBar
        count={ticked.length}
        actions={bulkActions}
        onRun={runBulk}
        onClear={selection.clear}
      />

      <div className={cn("overflow-x-auto transition-opacity", navigating && "opacity-50")}>
        <table className="w-full border-collapse text-[13px] xl:min-w-[840px]">
          <thead>
            <tr className="border-b border-line text-left">
              <SelectAllCell ids={selectable.map((user) => user.id)} selection={selection} />
              <th className="label px-3 py-3 text-ink-soft">Username</th>
              <th className="label hidden px-3 py-3 text-ink-soft xl:table-cell">Email</th>
              <th className="label px-3 py-3 text-ink-soft">Role</th>
              <th className="label px-3 py-3 text-ink-soft">Status</th>
              <th className="label hidden px-3 py-3 text-ink-soft xl:table-cell">Joined</th>
              <th className="label px-5 py-3 text-right text-ink-soft">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                selection={selection}
                bulkPending={bulk.pending(user.id, user.status)}
              />
            ))}

            {users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-ink-faint">
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

function UserRow({
  user,
  selection,
  bulkPending,
}: {
  user: AdminUserResponse;
  selection: Selection;
  /** A bulk action went out for this account and its status has not moved yet. */
  bulkPending: boolean;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [duration, setDuration] = useState<BanDuration>("permanent");
  const [result, setResult] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();
  // Opening the row is what triggers the fetch — once, lazily.
  const detail = useRowDetail(() => userModerationDetailAction(user.id));
  const { pending: propagating, stalled, watch } = usePropagation(
    user.status,
    "Still the old status — auth-service has not consumed the event yet. The action is recorded; reload in a moment.",
  );

  const pending = propagating || bulkPending;

  const action = userDecision(user.status);
  const presets = PRESET_REASONS[action];
  const closure = closureNote(user);

  // An admin who bans themselves loses the console with no way back in — the bootstrap
  // account is provisioned at startup and there is no second admin to undo it.
  const selfDestructive = user.role === "ADMIN" && action === "ban";

  function submit() {
    startSubmit(async () => {
      const outcome = await moderateUserAction(
        user.id,
        action,
        reason ?? "",
        action === "ban" ? banDaysOf(duration) : null,
      );
      setResult(outcome.message);
      if (outcome.ok) {
        setReason(null);
        watch();
      }
    });
  }

  return (
    <>
      <tr
        {...expandableRowProps(detail.toggle, detail.open)}
        className={cn(
          "border-b border-line transition-colors last:border-b-0 hover:bg-surface-muted",
          "cursor-pointer",
        )}
      >
        <SelectCell
          id={user.id}
          label={`Select @${user.username}`}
          selection={selection}
          disabledReason={
            user.role === "ADMIN"
              ? "Admin accounts cannot be banned from here"
              : bulkPending
                ? "Waiting for the last action to land"
                : null
          }
        />
        <td className="px-3 py-3 whitespace-nowrap">
          <span className="font-medium">@{user.username}</span>
        </td>
        <td className="hidden px-3 py-3 whitespace-nowrap xl:table-cell">
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
          <span className="rounded border border-line bg-surface-muted px-1.5 py-0.5 text-[11px] tracking-wider text-ink-soft">
            {user.role}
          </span>
        </td>
        <td className="px-3 py-3">
          <UserStatusBadge status={user.status} dimmed={pending} />
          {pending ? (
            <span className="ml-2 text-[11px] text-ink-faint">applying…</span>
          ) : null}
        </td>
        <td className="hidden px-3 py-3 whitespace-nowrap text-ink-faint xl:table-cell">
          {relativeTime(user.createdAt)}
        </td>
        <td
          className="px-5 py-3 text-right"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            // Disabled until the change lands, so a second click cannot queue the same
            // action twice against a status that has not moved yet.
            disabled={selfDestructive || pending}
            onClick={() => {
              setReason(reason === null ? "" : null);
              setDuration("permanent");
            }}
            title={
              selfDestructive
                ? "Banning an admin account would lock the console"
                : undefined
            }
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[12px] transition-colors",
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

      {detail.open ? (
        <RowDetail colSpan={7}>
          <Field label="Email" wide>
            {user.email ?? "— social login"}
            {user.email && !user.emailVerified ? " (unverified)" : ""}
            {user.emailVerifiedAt
              ? ` · verified ${formatDateTime(user.emailVerifiedAt)}`
              : ""}
          </Field>
          <Field label="Role">{user.role}</Field>
          <Field label="Status">{USER_STATUS_LABELS[user.status]}</Field>
          <Field label="Sign-in">
            {user.provider
              ? user.linkedProviders.join(", ")
              : "email / password"}
          </Field>
          <Field label="Joined">{formatDateTime(user.createdAt)}</Field>
          {/* lastLoginAt moves on every token refresh too, so it is use of the app, not sign-ins. */}
          <Field label="Last active">
            {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "never"}
          </Field>
          <Field label="Updated">{formatDateTime(user.updatedAt)}</Field>
          {/* Whole, and selected in one click: it is what gets pasted into a URL or a ticket. */}
          <Field label="User ID">
            <span className="select-all">{user.id}</span>
          </Field>
          {user.bannedAt ? (
            <Field label="Banned" wide>
              {formatDateTime(user.bannedAt)}
              {/* A temporary ban reads as a permanent one without this, and the account
                  coming back by itself a week later reads as a bug. */}
              {user.bannedUntil ? ` until ${formatDateTime(user.bannedUntil)}` : " — permanent"}
              {user.banReason ? ` — ${user.banReason}` : ""}
            </Field>
          ) : null}
          {closure ? (
            <Field label="Closed" wide>
              {closure}
            </Field>
          ) : null}
          <Field label="Moderation history" wide>
            <ModerationHistory
              reportCount={detail.data?.reportCount ?? null}
              actions={detail.data?.actions ?? null}
              handles={detail.data?.handles}
              loading={detail.loading}
              onRetry={detail.retry}
            />
          </Field>
          <Field label="" wide>
            <Link
              href={`/users/${user.id}` as never}
              className="text-[12px] text-ink-soft underline-offset-4 hover:underline"
            >
              Open this account&apos;s page →
            </Link>
          </Field>
        </RowDetail>
      ) : null}

      {reason !== null ? (
        <tr className="border-b border-line bg-surface-muted">
          <td colSpan={7} className="px-5 py-3">
            {/* The same choice the account's own page and a report's resolution offer: a ban
                from here was always permanent. */}
            {action === "ban" ? (
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="label text-ink-soft">Duration</span>
                <Segmented options={BAN_DURATIONS} value={duration} onChange={setDuration} />
              </div>
            ) : null}
            <ReasonForm
              presets={presets}
              reason={reason}
              onReason={setReason}
              onSubmit={submit}
              onCancel={() => setReason(null)}
              submitting={submitting}
              placeholder={`Reason for ${action}ning @${user.username} — pick one above or write your own`}
              confirmLabel={
                action === "ban" && duration !== "permanent" ? `Ban for ${duration}d` : `Confirm ${action}`
              }
            />
          </td>
        </tr>
      ) : null}

      {(stalled ?? result) ? (
        <tr className="border-b border-line">
          <td colSpan={7} className="px-5 py-2 text-[12px] text-ink-soft">
            {stalled ?? result}
          </td>
        </tr>
      ) : null}
    </>
  );
}
