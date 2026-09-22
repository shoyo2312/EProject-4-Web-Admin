"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Ban, ShieldCheck } from "lucide-react";
import {
  moderateUserAction,
  userModerationDetailAction,
  type ModerationDetail,
} from "@/app/(admin)/users/actions";
import { Card, CardHeader } from "@/components/ui/card";
import { SearchBox } from "@/components/ui/search-box";
import { Segmented } from "@/components/ui/segmented";
import { UserStatusBadge } from "@/components/ui/status-badge";
import { Field, RowDetail, expandableRowProps } from "@/components/ui/row-detail";
import { ModerationHistory } from "@/components/moderation/moderation-history";
import { ReasonForm } from "@/components/moderation/reason-form";
import { PRESET_REASONS } from "@/lib/moderation";
import type { AdminUserResponse, UserStatus } from "@/lib/api/types";
import { formatDateTime, relativeTime } from "@/lib/format";
import { hrefWith } from "@/lib/url";
import { usePropagation } from "@/lib/use-propagation";
import { cn } from "@/lib/utils";

type StatusFilter = UserStatus | "ALL";

const STATUS_FILTERS = [
  { value: "ALL" as const, label: "All" },
  { value: "ACTIVE" as const, label: "Active" },
  { value: "BANNED" as const, label: "Banned" },
  { value: "LOCKED" as const, label: "Locked" },
];

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

  return (
    <Card>
      <CardHeader
        title="User Directory"
        hint="GET /api/v1/auth/admin/users — served by auth-service, which owns status and role"
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

      <div className={cn("overflow-x-auto transition-opacity", navigating && "opacity-50")}>
        <table className="w-full border-collapse text-[12px] xl:min-w-[840px]">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="label-caps px-5 py-3 text-ink-soft">Username</th>
              <th className="label-caps hidden px-3 py-3 text-ink-soft xl:table-cell">Email</th>
              <th className="label-caps px-3 py-3 text-ink-soft">Role</th>
              <th className="label-caps px-3 py-3 text-ink-soft">Status</th>
              <th className="label-caps hidden px-3 py-3 text-ink-soft xl:table-cell">Joined</th>
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

function UserRow({
  user,
}: {
  user: AdminUserResponse;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [detail, setDetail] = useState(false);
  const [modHistory, setModHistory] = useState<ModerationDetail | null>(null);
  const [modLoading, setModLoading] = useState(false);
  const [submitting, startSubmit] = useTransition();

  // Opening the row is what triggers the fetch — once, lazily.
  function toggleDetail() {
    const opening = !detail;
    setDetail(opening);
    if (opening && !modHistory && !modLoading) {
      setModLoading(true);
      userModerationDetailAction(user.id)
        .then(setModHistory)
        .finally(() => setModLoading(false));
    }
  }
  const { pending, stalled, watch } = usePropagation(
    user.status,
    "Still the old status — auth-service has not consumed the event yet. The action is recorded; reload in a moment.",
  );

  const action = user.status === "BANNED" ? "unban" : "ban";
  const presets = PRESET_REASONS[action];

  // An admin who bans themselves loses the console with no way back in — the bootstrap
  // account is provisioned at startup and there is no second admin to undo it.
  const selfDestructive = user.role === "ADMIN" && action === "ban";

  function submit() {
    startSubmit(async () => {
      const outcome = await moderateUserAction(user.id, action, reason ?? "");
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
        {...expandableRowProps(toggleDetail, detail)}
        className={cn(
          "border-b border-line transition-colors last:border-b-0 hover:bg-surface-muted",
          "cursor-pointer",
        )}
      >
        <td className="px-5 py-3 whitespace-nowrap">
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
          <span className="rounded border border-line bg-surface-muted px-1.5 py-0.5 text-[10px] tracking-wider text-ink-soft">
            {user.role}
          </span>
        </td>
        <td className="px-3 py-3">
          <UserStatusBadge status={user.status} dimmed={pending} />
          {pending ? (
            <span className="ml-2 text-[10px] text-ink-faint">applying…</span>
          ) : null}
        </td>
        <td className="hidden px-3 py-3 whitespace-nowrap text-ink-faint xl:table-cell">
          {relativeTime(user.createdAt)}
        </td>
        <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
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

      {detail ? (
        <RowDetail colSpan={6}>
          <Field label="Email" wide>
            {user.email ?? "— social login"}
            {user.email && !user.emailVerified ? " (unverified)" : ""}
            {user.emailVerifiedAt
              ? ` · verified ${formatDateTime(user.emailVerifiedAt)}`
              : ""}
          </Field>
          <Field label="Role">{user.role}</Field>
          <Field label="Status">{user.status}</Field>
          <Field label="Sign-in">
            {user.provider
              ? user.linkedProviders.join(", ")
              : "email / password"}
          </Field>
          <Field label="Joined">{formatDateTime(user.createdAt)}</Field>
          <Field label="Last login">
            {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "never"}
          </Field>
          <Field label="Updated">{formatDateTime(user.updatedAt)}</Field>
          <Field label="User ID">#{user.id.slice(-12)}</Field>
          {user.bannedAt ? (
            <Field label="Banned" wide>
              {formatDateTime(user.bannedAt)}
              {/* A temporary ban reads as a permanent one without this, and the account
                  coming back by itself a week later reads as a bug. */}
              {user.bannedUntil ? ` until ${formatDateTime(user.bannedUntil)}` : " — permanent"}
              {user.banReason ? ` — ${user.banReason}` : ""}
            </Field>
          ) : null}
          <Field label="Moderation history" wide>
            <ModerationHistory
              reportCount={modHistory?.reportCount ?? null}
              actions={modHistory?.actions ?? null}
              loading={modLoading}
            />
          </Field>
          <Field label="" wide>
            <Link
              href={`/users/${user.id}` as never}
              className="text-[11px] text-ink-soft underline-offset-4 hover:underline"
            >
              Open this account&apos;s page →
            </Link>
          </Field>
        </RowDetail>
      ) : null}

      {reason !== null ? (
        <tr className="border-b border-line bg-surface-muted">
          <td colSpan={6} className="px-5 py-3">
            <ReasonForm
              presets={presets}
              reason={reason}
              onReason={setReason}
              onSubmit={submit}
              onCancel={() => setReason(null)}
              submitting={submitting}
              placeholder={`Reason for ${action}ning @${user.username} — pick one above or write your own`}
              confirmLabel={`Confirm ${action}`}
            />
          </td>
        </tr>
      ) : null}

      {(stalled ?? result) ? (
        <tr className="border-b border-line">
          <td colSpan={6} className="px-5 py-2 text-[11px] text-ink-soft">
            {stalled ?? result}
          </td>
        </tr>
      ) : null}
    </>
  );
}
