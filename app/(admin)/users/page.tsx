import { KpiCards, type KpiCard } from "@/components/dashboard/kpi-cards";
import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { UsersTable } from "@/components/users/users-table";
import { Pager } from "@/components/ui/pager";
import { LIST_PAGE_SIZE, getDailySignups, listUsers, referenceNow } from "@/lib/api/admin";
import { isoDay, parsePage, resolveWindow } from "@/lib/api/window";
import { deltaPercent, spark, sumLast } from "@/lib/series";
import { formatNumber } from "@/lib/format";
import type { UserStatus } from "@/lib/api/types";

const STATUSES: UserStatus[] = ["ACTIVE", "BANNED", "LOCKED"];

function parseStatus(value: string | undefined): UserStatus | undefined {
  return STATUSES.includes(value as UserStatus) ? (value as UserStatus) : undefined;
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; g?: string; asOf?: string; page?: string }>;
}) {
  const params = await searchParams;
  const { q, status, page: pageParam } = params;
  const filter = parseStatus(status);
  const latest = isoDay(referenceNow());
  const window = resolveWindow(params, latest);
  const asOf = window.asOf;
  const pageIndex = parsePage(pageParam);

  let page;
  let bannedTotal;
  let signups;
  try {
    // Filtering and paging server-side rather than over the fetched rows: "show me every
    // banned account" must not depend on how many rows happened to come back, and the
    // directory is bigger than any one page.
    // The banned figure is its own count query for the same reason — counting the rows on
    // screen would report 3 out of a page of 25 as the platform's banned total.
    [page, bannedTotal, signups] = await Promise.all([
      listUsers({ q, status: filter, page: pageIndex }),
      listUsers({ q, status: "BANNED", size: 1 }).then((p) => p.totalElements),
      // Twice the display window, same reason the dashboard doubles it: New Users needs the
      // period before this one to compare against.
      getDailySignups(window.compareDays),
    ]);
  } catch (error) {
    return (
      <>
        <PageHeader title="Users" />
        <ErrorState error={error} />
      </>
    );
  }

  // Registered on or before the picked date. Status is whatever it is now — this is a
  // joined-by filter, not a reconstruction of who was banned back then.
  // ponytail: the cut runs over the page rather than the query, because auth-service takes no
  // date parameter — a page of accounts newer than the picked date comes back short instead of
  // being skipped. Push a `createdBefore` param into AdminUserController if that starts to bite.
  const users = page.content.filter((u) => u.createdAt.slice(0, 10) <= asOf);
  const unverified = users.filter((u) => !u.emailVerified).length;

  // Daily and uncut, so the delta compares the window against the window before it.
  const signupCounts = signups.filter((d) => d.day <= asOf).map((d) => d.signups);

  const cards: KpiCard[] = [
    {
      label: "Matching",
      value: formatNumber(page.totalElements),
      unit: "Accounts",
    },
    {
      label: "Banned",
      value: formatNumber(bannedTotal),
      unit: "Accounts",
      // More banned is the expected direction of a healthy queue, not a regression —
      // still shown plain, without a red/green judgement either way.
    },
    {
      label: "New Users",
      value: formatNumber(sumLast(signupCounts, window.spanDays)),
      unit: `Last ${window.spanDays}d`,
      delta: deltaPercent(signupCounts, window.spanDays),
      deltaLabel: `vs previous ${window.spanDays}d`,
      spark: spark(signupCounts, window.spanDays),
    },
    {
      label: "Unverified Email",
      value: formatNumber(unverified),
      // Page-local, and labelled as such: auth-service has no emailVerified filter, so
      // unlike the others there is no count query to ask for the real total.
      unit: "On this page",
    },
  ];

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Every account on the platform. Banning writes a moderation action and revokes live sessions."
        filters={{ granularity: window.granularity, asOf, latest }}
        csv={{ name: "users", rows: users }}
      />

      <div className="space-y-4">
        <KpiCards cards={cards} />

        <UsersTable users={users} query={q ?? ""} status={filter ?? "ALL"} />

        <Pager
          page={page.number}
          totalPages={page.totalPages}
          total={page.totalElements}
          size={LIST_PAGE_SIZE}
          label="accounts"
        />
      </div>
    </>
  );
}
