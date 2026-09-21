import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { EnforcePanel } from "@/components/moderation/enforce-panel";
import { ModerationHistory } from "@/components/moderation/moderation-history";
import { AvatarBody } from "@/components/users/avatar-body";
import { UserUploads } from "@/components/users/user-uploads";
import { Card, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/row-detail";
import {
  getAdminUser,
  getReportCount,
  getStrikeCount,
  getUserProfiles,
  listTargetActions,
  listVideos,
} from "@/lib/api/admin";
import { formatCount, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  AdminUserResponse,
  ModerationActionResponse,
  UserProfileResponse,
  UserStatus,
} from "@/lib/api/types";

const STATUS_STYLES: Record<UserStatus, string> = {
  ACTIVE: "border-success/25 bg-success-bg text-success",
  BANNED: "border-danger/25 bg-danger-bg text-danger",
  LOCKED: "border-line bg-neutral-bg text-neutral",
};

/** How many uploads to show inline before pointing at the full, filterable Videos page. */
const INLINE_UPLOADS = 16;

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
  let profile: UserProfileResponse | undefined;
  let uploads: Awaited<ReturnType<typeof listVideos>> | null;
  try {
    user = await getAdminUser(id);
    // Not fetched before the account is known to exist: four calls thrown away on every bad id.
    [reportCount, actions, strikes, profile, uploads] = user
      ? await Promise.all([
          getReportCount("USER", id),
          listTargetActions("USER", id),
          getStrikeCount("USER", id),
          getUserProfiles([id]).then((profiles) => profiles[id]),
          // ponytail: no owner-videos aggregate endpoint exists, so "total likes" is summed
          // over this one page rather than the account's whole history. Fine at admin-console
          // scale; add a real aggregate if an account with hundreds of uploads makes it lie.
          listVideos({ ownerIds: [id], size: 100 }),
        ])
      : [0, [], 0, undefined, null];
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
  const totalLikes = (uploads?.content ?? []).reduce((sum, v) => sum + v.likeCount, 0);

  return (
    <>
      <Link
        href="/users"
        className="mb-3 inline-flex items-center gap-1.5 text-[11px] text-ink-soft underline-offset-4 hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All accounts
      </Link>

      <div className="mb-5 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Avatar avatarUrl={profile?.avatarUrl ?? null} username={user.username} />
          <div>
            <h1 className="text-[26px] leading-tight font-bold tracking-tight">
              @{user.username}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-soft">
              <span
                className={cn(
                  "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium",
                  STATUS_STYLES[user.status],
                )}
              >
                {user.status}
              </span>
              <span>
                · {user.role} · joined {formatDate(user.createdAt)}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <Stat label="Following" value={profile?.followingCount ?? 0} />
          <Stat label="Followers" value={profile?.followerCount ?? 0} />
          <Stat label="Likes" value={totalLikes} />
        </div>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader
            title="Account"
            hint="GET /api/v1/auth/admin/users — served by auth-service, which owns status and role"
          />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 px-5 py-4 text-[12px] xl:grid-cols-4">
            <Field label="Handle">@{user.username}</Field>
            <Field label="Status">
              <span
                className={cn(
                  "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium",
                  STATUS_STYLES[user.status],
                )}
              >
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
        </Card>

        <Card>
          <CardHeader
            title={`Uploads by @${user.username}`}
            hint="GET /api/v1/videos/admin?ownerId= — served by video-service"
            actions={
              uploads && uploads.totalElements > INLINE_UPLOADS ? (
                <Link
                  href={{ pathname: "/videos", query: { q: user.username } } as never}
                  className="text-[11px] text-ink-soft underline-offset-4 hover:underline"
                >
                  All {uploads.totalElements} →
                </Link>
              ) : undefined
            }
          />
          <UserUploads videos={(uploads?.content ?? []).slice(0, INLINE_UPLOADS)} />
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

/** Round avatar image, or the handle's initials over a neutral fill when there is none — also
 * the fallback once a broken CDN url 404s, which a bare `<img>` cannot recover from itself. */
function Avatar({ avatarUrl, username }: { avatarUrl: string | null; username: string }) {
  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-surface-muted text-[16px] font-semibold text-ink-soft uppercase">
      <AvatarBody avatarUrl={avatarUrl} initials={username.slice(0, 2)} />
    </span>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-right">
      <div className="figure text-[18px] font-bold leading-tight" title={String(value)}>
        {formatCount(value)}
      </div>
      <div className="label-caps text-[10px] text-ink-faint">{label}</div>
    </div>
  );
}
