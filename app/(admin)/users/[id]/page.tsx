import Link from "next/link";
import { ErrorState } from "@/components/layout/error-state";
import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { EnforcePanel } from "@/components/moderation/enforce-panel";
import { ModerationHistory } from "@/components/moderation/moderation-history";
import { CommentRestriction } from "@/components/users/comment-restriction";
import { UserUploads } from "@/components/users/user-uploads";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/row-detail";
import { UserStatusBadge } from "@/components/ui/status-badge";
import { closureNote } from "@/lib/account-closure";
import { getStrikeCount, listTargetActions } from "@/lib/api/moderation";
import { getAdminHandles, getUserProfiles } from "@/lib/api/names";
import { getReportCount } from "@/lib/api/reports";
import { referenceNow } from "@/lib/api/shared";
import { getAdminUser, getCommentRestriction } from "@/lib/api/users";
import { listVideos } from "@/lib/api/videos";
import { formatCount, formatDateTime } from "@/lib/format";
import type {
  AdminUserResponse,
  CommentRestrictionResponse,
  ModerationActionResponse,
  UserProfileResponse,
} from "@/lib/api/types";

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
  let restriction: CommentRestrictionResponse | null;
  try {
    user = await getAdminUser(id);
    // Not fetched before the account is known to exist: six calls thrown away on every bad id.
    [reportCount, actions, strikes, profile, uploads, restriction] = user
      ? await Promise.all([
          getReportCount("USER", id),
          listTargetActions("USER", id),
          getStrikeCount("USER", id),
          getUserProfiles([id]).then((profiles) => profiles[id]),
          // ponytail: no owner-videos aggregate endpoint exists, so "total likes" is summed
          // over this one page rather than the account's whole history. Fine at admin-console
          // scale; add a real aggregate if an account with hundreds of uploads makes it lie.
          listVideos({ ownerIds: [id], size: 100 }),
          // Non-fatal: with interaction-service down, its card says so and the rest still loads.
          getCommentRestriction(id).catch(() => null),
        ])
      : [0, [], 0, undefined, null, null];
  } catch (error) {
    return (
      <>
        <BackLink href="/users">All accounts</BackLink>
        <PageHeader title="Account" />
        <ErrorState error={error} />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <BackLink href="/users">All accounts</BackLink>
        <PageHeader title="Account" />
        <Card className="px-5 py-10 text-center text-[13px] text-ink-faint">
          No account at id <span className="figure">{id}</span>. Either nothing is registered
          there, or the account has been deleted.
        </Card>
      </>
    );
  }

  // Who took each action, by @handle. Non-fatal: the history falls back to id tails.
  const adminHandles = await getAdminHandles(actions.map((a) => a.adminId));
  const action = user.status === "BANNED" ? "unban" : "ban";
  const closure = closureNote(user);
  const totalLikes = (uploads?.content ?? []).reduce((sum, v) => sum + v.likeCount, 0);

  return (
    <>
      <BackLink href="/users">All accounts</BackLink>

      <div className="mb-5 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Avatar src={profile?.avatarUrl} initials={user.username.slice(0, 2)} size="lg" />
          <div>
            <h1 className="text-[26px] leading-tight font-bold tracking-tight">
              @{user.username}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] text-ink-soft">
              <UserStatusBadge status={user.status} dense />
              <span>
                · {user.role} · joined {formatDateTime(user.createdAt)}
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
            hint="The account record: status, role, how it signs in, and when it last did."
          />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 px-5 py-4 text-[13px] xl:grid-cols-4">
            <Field label="Handle">@{user.username}</Field>
            <Field label="Status">
              <UserStatusBadge status={user.status} dense />
            </Field>
            <Field label="Role">{user.role}</Field>
            <Field label="Reports against">{reportCount}</Field>
            <Field label="Email" wide>
              {user.email ? (
                <span className={user.emailVerified ? undefined : "text-pending"}>
                  {user.email}
                  {user.emailVerified
                    ? user.emailVerifiedAt
                      ? ` · verified ${formatDateTime(user.emailVerifiedAt)}`
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
                whether a quiet account was ever really in use at all. "Active" rather than
                "login": lastLoginAt moves on every token refresh, so it tracks use of the app,
                not sign-ins. */}
            <Field label="Last active">
              {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "never"}
            </Field>
            <Field label="Joined">{formatDateTime(user.createdAt)}</Field>
            <Field label="Updated">{formatDateTime(user.updatedAt)}</Field>
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
                  {formatDateTime(user.bannedAt)}
                  {user.bannedUntil
                    ? ` until ${formatDateTime(user.bannedUntil)}`
                    : " — permanent"}
                  {user.banReason ? ` — ${user.banReason}` : ""}
                </span>
              </Field>
            ) : null}
            {closure ? (
              <Field label="Closed" wide>
                <span className={user.deletionScheduledAt ? "text-pending" : undefined}>
                  {closure}
                </span>
              </Field>
            ) : null}
          </dl>
        </Card>

        <Card>
          <CardHeader
            title="Commenting"
            hint="interaction-service's own record, apart from the strikes above. A strike is a comment the word list refused or an admin removed. By default 3 within a day restrict commenting — for an hour, then a day, then a week — and 30 days without a restriction start the steps over."
          />
          <div className="px-5 py-4">
            {restriction ? (
              <CommentRestriction
                restriction={restriction}
                subject={`@${user.username}`}
                now={referenceNow()}
              />
            ) : (
              <p className="text-[13px] text-ink-faint">
                interaction-service did not answer, so the comment strikes cannot be read right
                now. Nothing about the account has changed.
              </p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title={`Uploads by @${user.username}`}
            hint="Everything this account uploaded, taken-down and deleted videos included."
            actions={
              uploads && uploads.totalElements > INLINE_UPLOADS ? (
                <Link
                  href={{ pathname: "/videos", query: { owner: user.id } } as never}
                  className="text-[12px] text-ink-soft underline-offset-4 hover:underline"
                >
                  All {uploads.totalElements} →
                </Link>
              ) : undefined
            }
          />
          <UserUploads videos={(uploads?.content ?? []).slice(0, INLINE_UPLOADS)} />
        </Card>

        <Card>
          <CardHeader
            title="Moderation history"
            actions={
              <Link
                href={`/users/${user.id}/activity` as never}
                className="text-[12px] text-ink-soft underline-offset-4 hover:underline"
              >
                Full activity →
              </Link>
            }
          />
          <div className="px-5 py-4">
            <ModerationHistory
              reportCount={reportCount}
              actions={actions}
              handles={adminHandles}
              loading={false}
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Decision"
            hint="Recorded in the audit log straight away. Bans and sign-outs take effect within seconds; a warning arrives as a notification."
          />
          <div className="px-5 py-4">
            <EnforcePanel
              kind="user"
              targetId={user.id}
              actions={[action, "warn", "revokeSessions"]}
              subject={`@${user.username}`}
              // An admin banning an admin account can lock the console: the bootstrap account
              // is provisioned at startup and there may be no second one to undo it. Signing one
              // out cannot — an admin who is signed out signs back in.
              blocked={
                user.role === "ADMIN"
                  ? {
                      ban: "Banning an admin account would lock the console — there may be no second admin to undo it.",
                    }
                  : undefined
              }
            />
          </div>
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-right">
      <div className="figure text-[18px] font-bold leading-tight" title={String(value)}>
        {formatCount(value)}
      </div>
      <div className="label text-[11px] text-ink-faint">{label}</div>
    </div>
  );
}
