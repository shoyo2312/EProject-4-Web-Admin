import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { EnforcePanel } from "@/components/moderation/enforce-panel";
import { ModerationHistory } from "@/components/moderation/moderation-history";
import { Card, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/row-detail";
import {
  getAdminUser,
  getReportCount,
  getStrikeCount,
  listTargetActions,
} from "@/lib/api/admin";
import { formatDate } from "@/lib/format";
import type { AdminUserResponse, ModerationActionResponse } from "@/lib/api/types";

/**
 * One account by id — what a report resolves to, since a report against a user carries the id
 * and nothing else.
 *
 * The directory can only be searched by handle and email, so until now the best link a report
 * could offer was a search for the handle: several rows for a common substring, and no link at
 * all for an account that has no handle yet. A decision about an account should not start with
 * picking it out of a result set.
 */
export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let user: AdminUserResponse | null;
  let reportCount: number;
  let actions: ModerationActionResponse[];
  let strikes: number;
  try {
    user = await getAdminUser(id);
    // Not fetched before the account is known to exist: three calls thrown away on every bad id.
    [reportCount, actions, strikes] = user
      ? await Promise.all([
          getReportCount("USER", id),
          listTargetActions("USER", id),
          getStrikeCount("USER", id),
        ])
      : [0, [], 0];
  } catch (error) {
    return (
      <>
        <DetailHeader title="Account" />
        <ErrorState error={error} />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <DetailHeader title="Account" />
        <Card className="px-5 py-10 text-center text-[12px] text-ink-faint">
          No account reachable at id <span className="figure">{id}</span>. Either nothing is
          registered there, or the account has no user-service profile — the directory is
          searched by handle, so an account without one cannot be opened by id yet.
        </Card>
      </>
    );
  }

  const action = user.status === "BANNED" ? "unban" : "ban";

  return (
    <>
      <DetailHeader
        title={`@${user.username}`}
        subtitle={`${user.status} · ${user.role} · joined ${formatDate(user.createdAt)}`}
      />

      <div className="space-y-4">
        <Card>
          <CardHeader
            title="Account"
            hint="GET /api/v1/auth/admin/users — served by auth-service, which owns status and role"
          />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 px-5 py-4 text-[12px] xl:grid-cols-4">
            <Field label="Handle">@{user.username}</Field>
            <Field label="Status">
              <span className={user.status === "BANNED" ? "text-danger" : undefined}>
                {user.status}
              </span>
            </Field>
            <Field label="Role">{user.role}</Field>
            <Field label="Reports against">{reportCount}</Field>
            <Field label="Email" wide>
              {user.email ? (
                <span className={user.emailVerified ? undefined : "text-pending"}>
                  {user.email}
                  {user.emailVerified
                    ? user.emailVerifiedAt
                      ? ` · verified ${formatDate(user.emailVerifiedAt)}`
                      : " · verified"
                    : " (unverified)"}
                </span>
              ) : (
                <span className="text-ink-faint">— social login, no address given</span>
              )}
            </Field>
            <Field label="Sign-in">
              {user.linkedProviders.length > 0
                ? user.linkedProviders.join(", ")
                : "email / password"}
            </Field>
            {/* The one field that says whether a banned account is still being reached for, and
                whether a quiet account was ever really in use at all. */}
            <Field label="Last login">
              {user.lastLoginAt ? formatDate(user.lastLoginAt) : "never"}
            </Field>
            <Field label="Joined">{formatDate(user.createdAt)}</Field>
            <Field label="Updated">{formatDate(user.updatedAt)}</Field>
            <Field label="User ID">
              <span className="figure break-all">{user.id}</span>
            </Field>
            {/* Enforcement against this account over its whole life, not just what is standing
                now: an account unbanned twice already is the fact a third decision turns on. */}
            <Field label="Strikes">
              {strikes === 0 ? (
                <span className="text-ink-faint">none</span>
              ) : (
                <span className="figure text-danger">{strikes}</span>
              )}
            </Field>
            {user.bannedAt ? (
              <Field label="Banned" wide>
                <span className="text-danger">
                  {formatDate(user.bannedAt)}
                  {user.bannedUntil
                    ? ` until ${formatDate(user.bannedUntil)}`
                    : " — permanent"}
                  {user.banReason ? ` — ${user.banReason}` : ""}
                </span>
              </Field>
            ) : null}
          </dl>
          <div className="border-t border-line px-5 py-3">
            {/* The video search resolves a handle to owner ids, so this lands on the account's
                uploads. It is still a search and not a filter: a video someone else titled after
                this handle comes back too. */}
            <Link
              href={{ pathname: "/videos", query: { q: user.username } } as never}
              className="text-[11px] text-ink-soft underline-offset-4 hover:underline"
            >
              Uploads by @{user.username} →
            </Link>
          </div>
        </Card>

        <Card>
          <CardHeader title="Moderation history" />
          <div className="px-5 py-4">
            <ModerationHistory reportCount={reportCount} actions={actions} loading={false} />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Decision"
            hint="Writes a moderation action and publishes it; auth-service applies it and revokes live sessions"
          />
          <div className="px-5 py-4">
            <EnforcePanel
              kind="user"
              targetId={user.id}
              action={action}
              subject={`@${user.username}`}
              // An admin banning an admin account can lock the console: the bootstrap account
              // is provisioned at startup and there may be no second one to undo it.
              blockedReason={
                user.role === "ADMIN" && action === "ban"
                  ? "Banning an admin account would lock the console — there may be no second admin to undo it."
                  : undefined
              }
            />
          </div>
        </Card>
      </div>
    </>
  );
}

function DetailHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <>
      <Link
        href="/users"
        className="mb-3 inline-flex items-center gap-1.5 text-[11px] text-ink-soft underline-offset-4 hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All accounts
      </Link>
      <PageHeader title={title} subtitle={subtitle} />
    </>
  );
}
