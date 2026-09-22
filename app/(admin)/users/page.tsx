import { KpiCards, type KpiCard } from "@/components/dashboard/kpi-cards";
import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { UsersTable } from "@/components/users/users-table";
import { Pager } from "@/components/ui/pager";
import {
  LIST_PAGE_SIZE,
  getDailyAdminStats,
  getDailySignups,
  listUsers,
  referenceNow,
} from "@/lib/api/admin";
import { historyUpTo, isoDay, parsePage, resolveWindow } from "@/lib/api/window";
import { deltaPercent, growthPercent, spark, sumLast } from "@/lib/series";
import { formatNumber } from "@/lib/format";
import type { UserStatus } from "@/lib/api/types";

const STATUSES: UserStatus[] = ["ACTIVE", "BANNED", "LOCKED"];

function parseStatus(value: string | undefined): UserStatus | undefined {
  return STATUSES.includes(value as UserStatus) ? (value as UserStatus) : undefined;
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; p?: string; asOf?: string; page?: string }>;
}) {
  const params = await searchParams;
  const { q, status, page: pageParam } = params;
  const filter = parseStatus(status);
  const latest = isoDay(referenceNow());
  const window = resolveWindow(params, latest);
  const { asOf, periodDays, periodLabel, compareLabel } = window;
  const pageIndex = parsePage(pageParam);

  let page;
  let bannedTotal;
  let signups;
  let adminStats;
  try {
    // Filtering and paging server-side rather than over the fetched rows: "show me every
    // banned account" must not depend on how many rows happened to come back, and the
    // directory is bigger than any one page.
    // The banned figure is its own count query for the same reason — counting the rows on
    // screen would report 3 out of a page of 25 as the platform's banned total.
    [page, bannedTotal, signups, adminStats] = await Promise.all([
      listUsers({ q, status: filter, page: pageIndex }),
      listUsers({ q, status: "BANNED", size: 1 }).then((p) => p.totalElements),
      // Two periods deep, so each card has the period before this one to compare against.
      getDailySignups(window.fetchDays),
      // Bans are moderation actions, not a user-service field: how many accounts were banned
      // during a period is only recorded in the audit log.
      getDailyAdminStats(window.fetchDays),
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

  // Daily and uncut, so a delta compares the period against the period before it.
  const signupCounts = historyUpTo(signups, window).map((d) => d.signups);
  const banCounts = historyUpTo(adminStats, window).map((d) => d.usersBanned);

  const newUsers = sumLast(signupCounts, periodDays);
  // A directory total is cumulative, so it has no series to compare against — what it grew by
  // is this period's arrivals over the size it had when the period started. Only meaningful
  // unfiltered: the signup series counts every account, so pairing it with a searched or
  // status-filtered total would divide two different populations.
  const filtered = Boolean(q || filter);

  const cards: KpiCard[] = [
    {
      label: "Matching",
      value: formatNumber(page.totalElements),
      unit: "Accounts",
      delta: filtered ? null : growthPercent(page.totalElements, newUsers),
      deltaLabel: compareLabel,
    },
    {
      label: "Banned",
      value: formatNumber(bannedTotal),
      unit: "Accounts",
      // Same cumulative shape as Matching, against the bans recorded in the audit log.
      // Not inverted: bans going up is the queue being worked, not the platform rotting.
      // Unbans are not netted off — the audit log records them, but an account banned and
      // unbanned inside one period would then cancel out of a figure it never belonged to.
      delta: filtered ? null : growthPercent(bannedTotal, sumLast(banCounts, periodDays)),
      deltaLabel: compareLabel,
    },
    {
      label: "New Users",
      value: formatNumber(newUsers),
      unit: periodLabel,
      delta: deltaPercent(signupCounts, periodDays),
      deltaLabel: compareLabel,
      spark: spark(signupCounts, window.chartDays),
    },
    {
      label: "Unverified Email",
      value: formatNumber(unverified),
      // Page-local, and labelled as such: auth-service has no emailVerified filter, so
      // unlike the others there is no count query to ask for the real total — and so no
      // honest percentage either.
      unit: "On this page",
    },
  ];

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Every account on the platform. Banning writes a moderation action and revokes live sessions."
        filters={{ period: window.period, asOf, latest }}
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
