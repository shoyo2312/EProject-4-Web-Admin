import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Pager } from "@/components/ui/pager";
import { ActivityTimeline } from "@/components/users/activity-timeline";
import {
  LIST_PAGE_SIZE,
  getAdminUser,
  listReports,
  listSecurityEvents,
  listTargetActions,
  listVideos,
} from "@/lib/api/admin";
import { parsePage } from "@/lib/api/window";
import {
  ACTIVITY_CATEGORIES,
  buildUserActivity,
  filterActivity,
  pageOfActivity,
  parseActivityFilter,
  type ActivityFilter,
} from "@/lib/activity";
import { hrefWith } from "@/lib/url";
import { cn } from "@/lib/utils";

/**
 * One account's history in one place: what it did, what was done to it, and what it was
 * reported for.
 *
 * Its own route rather than a fifth card on the account page, because the two answer different
 * questions — that page is the decision ("what is this account, and do I act on it"), this one
 * is the trail behind it, and a trail needs paging, filtering and room to grow.
 *
 * ponytail: five sources, each capped at {@link SOURCE_LIMIT} rows, merged and paged in the
 * process. A page boundary cannot be pushed down to the services because page 2 of each is not
 * page 2 of the merge, so an account past the cap shows its most recent history rather than all
 * of it. The upgrade is a real activity-event table everything writes to; until there is one,
 * the cap is generous enough that no account in this console reaches it.
 */
const SOURCE_LIMIT = 100;

export default async function UserActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cat?: string; page?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const filter = parseActivityFilter(query.cat);
  const requestedPage = parsePage(query.page);

  let user;
  let actions;
  let uploads;
  let filed;
  let received;
  let security;
  try {
    user = await getAdminUser(id);
    // Not fetched before the account is known to exist: five calls thrown away on every bad id.
    [actions, uploads, filed, received, security] = user
      ? await Promise.all([
          listTargetActions("USER", id, SOURCE_LIMIT),
          listVideos({ ownerIds: [id], size: SOURCE_LIMIT }),
          listReports({ reporterId: id, size: SOURCE_LIMIT }),
          listReports({ targetType: "USER", targetId: id, size: SOURCE_LIMIT }),
          listSecurityEvents(id, SOURCE_LIMIT),
        ])
      : [[], null, null, null, null];
  } catch (error) {
    return (
      <>
        <BackLink id={id} />
        <PageHeader title="Activity" />
        <ErrorState error={error} />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <BackLink id={id} />
        <PageHeader title="Activity" />
        <Card className="px-5 py-10 text-center text-[12px] text-ink-faint">
          No account reachable at id <span className="figure">{id}</span>.
        </Card>
      </>
    );
  }

  const events = buildUserActivity({
    user,
    actions,
    uploads: uploads?.content ?? [],
    reportsFiled: filed?.content ?? [],
    reportsReceived: received?.content ?? [],
    securityEvents: security?.content ?? [],
    securityLogTruncated: security ? security.totalElements > security.content.length : false,
  });
  const visible = filterActivity(events, filter);
  const slice = pageOfActivity(visible, requestedPage, LIST_PAGE_SIZE);

  return (
    <>
      <BackLink id={id} />

      <PageHeader
        title={`Activity — @${user.username}`}
        subtitle={`${events.length} recorded event${
          events.length === 1 ? "" : "s"
        } across security, content and moderation`}
      />

      <Card>
        <CardHeader
          title="History"
          hint="Sign-ins and other security events, uploads, reports and moderation decisions, merged into one timeline."
          actions={
            <div className="flex items-center gap-0.5 rounded-lg border border-line bg-surface-muted p-0.5">
              <FilterTab
                pathname={`/users/${id}/activity`}
                current={filter}
                value="all"
                label="All"
                count={events.length}
              />
              {ACTIVITY_CATEGORIES.map((category) => (
                <FilterTab
                  key={category}
                  pathname={`/users/${id}/activity`}
                  current={filter}
                  value={category}
                  label={category[0].toUpperCase() + category.slice(1)}
                  count={filterActivity(events, category).length}
                />
              ))}
            </div>
          }
        />

        <ActivityTimeline events={slice.rows} />

        <div className="border-t border-line px-4 py-2">
          <Pager
            page={slice.page}
            totalPages={slice.totalPages}
            total={slice.totalElements}
            size={LIST_PAGE_SIZE}
            label="events"
          />
        </div>
      </Card>

      {/* Still said on the page: a trail that is missing something looks exactly like an account
          that never did it, and the two gaps left are not ones a reader can infer. */}
      <p className="mt-3 px-1 text-[11px] text-ink-faint">
        Sign-ins are listed from the day the security log was added; anything earlier was never
        recorded. Locations are not shown — the address is kept, but resolving one to a place
        needs a geo-IP database the platform does not have. Phone changes are not listed either:
        accounts have no phone number.
      </p>
    </>
  );
}

/**
 * A filter is a link, not a toggle: the whole page is a server component, so narrowing it is a
 * navigation that re-renders, and the narrowed view stays shareable and survives a reload.
 */
function FilterTab({
  pathname,
  current,
  value,
  label,
  count,
}: {
  pathname: string;
  current: ActivityFilter;
  value: ActivityFilter;
  label: string;
  count: number;
}) {
  const active = current === value;
  return (
    <Link
      // Page 3 of everything is not page 3 of one category, and is usually past its end.
      href={
        hrefWith(pathname, new URLSearchParams(), {
          cat: value === "all" ? null : value,
          page: null,
        }) as never
      }
      aria-current={active ? "true" : undefined}
      className={cn(
        "shrink-0 rounded-md px-2.5 py-1.5 text-[11px] transition-colors",
        active
          ? "bg-surface font-semibold text-ink shadow-[0_0_0_1px_var(--line)]"
          : "text-ink-soft hover:text-ink",
      )}
    >
      {label}
      <span className="ml-1.5 text-ink-faint tabular-nums">{count}</span>
    </Link>
  );
}

function BackLink({ id }: { id: string }) {
  return (
    <Link
      href={`/users/${id}` as never}
      className="mb-3 inline-flex items-center gap-1.5 text-[11px] text-ink-soft underline-offset-4 hover:underline"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Back to account
    </Link>
  );
}
