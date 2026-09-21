import { EngagementTrend } from "@/components/dashboard/engagement-trend";
import { KpiCards, type KpiCard } from "@/components/dashboard/kpi-cards";
import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { ReportsTable } from "@/components/moderation/reports-table";
import {
  getDailyAdminStats,
  getDailySignups,
  getEngagementSeries,
  getStatsSummary,
  listReports,
  referenceNow,
} from "@/lib/api/admin";
import {
  bucketByGranularity,
  isoDay,
  resolveWindow,
  sliceToWindow,
} from "@/lib/api/window";
import { getSessionProfile } from "@/lib/api/session";
import { deltaPercent, spark } from "@/lib/series";
import { formatNumber } from "@/lib/format";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ g?: string; asOf?: string }>;
}) {
  const session = await getSessionProfile();
  const latest = isoDay(referenceNow());
  const window = resolveWindow(await searchParams, latest);
  const filters = { granularity: window.granularity, asOf: window.asOf, latest };
  const asOfMs = Date.parse(`${window.asOf}T23:59:59Z`);

  let data;
  try {
    const [stats, signups, adminStats, series, reports] = await Promise.all([
      getStatsSummary(),
      // Twice the display window, so the signup KPI can be compared against the period before
      // it. The same pull the analytics page makes, for the same reason.
      getDailySignups(window.compareDays),
      // Same doubled window: Pending Reports and Actions(24h) compare against the period
      // before them the same way Signups does.
      getDailyAdminStats(window.compareDays),
      getEngagementSeries(asOfMs),
      // Over-fetched, then cut to the picked date: the eight newest reports as of
      // three weeks ago are not the eight newest today.
      // Only the newest slice — the dashboard card shows a handful and links to the queue.
      listReports({ size: 8 }).then((page) => page.content),
    ]);
    data = { stats, signups, adminStats, series, reports };
  } catch (error) {
    return (
      <>
        <PageHeader
          title={`Welcome back, ${session.username}`}
        />
        <ErrorState error={error} />
      </>
    );
  }

  const { stats, signups, adminStats, series } = data;

  const reports = data.reports
    .filter((r) => r.createdAt.slice(0, 10) <= window.asOf)
    .slice(0, 8);

  const signupBuckets = bucketByGranularity(
    sliceToWindow(signups, window),
    window.granularity,
    (a, b) => ({ day: a.day, signups: a.signups + b.signups }),
  );

  const signupTotal = signupBuckets.reduce((sum, d) => sum + d.signups, 0);

  // Daily and uncut, so the delta below compares the window against the window before it —
  // signupBuckets is only the window itself, and has nothing behind it to compare to.
  const signupCounts = signups
    .filter((d) => d.day <= window.asOf)
    .map((d) => d.signups);

  // Same shape as signupCounts below: daily and uncut, so the delta compares the window
  // against the window before it rather than just the picked slice.
  const dailyStats = adminStats.filter((d) => d.day <= window.asOf);
  const reportsCreatedCounts = dailyStats.map((d) => d.reportsCreated);
  const actionsTakenCounts = dailyStats.map((d) => d.actionsTaken);

  const cards: KpiCard[] = [
    {
      label: "Pending Reports",
      value: formatNumber(stats.pendingReports),
      unit: "Reports",
      // Reports filed is the flow behind the queue depth; more filed is worse, so an
      // upward move reads red here same as the depth figure itself would.
      delta: deltaPercent(reportsCreatedCounts, window.spanDays),
      deltaLabel: `vs previous ${window.spanDays}d`,
      invertDelta: true,
      spark: spark(reportsCreatedCounts, window.spanDays),
    },
    {
      label: "Actions (24h)",
      value: formatNumber(stats.actionsLast24h),
      unit: "Actions",
      delta: deltaPercent(actionsTakenCounts, window.spanDays),
      deltaLabel: `vs previous ${window.spanDays}d`,
      spark: spark(actionsTakenCounts, window.spanDays),
    },
    {
      label: "New Signups",
      value: formatNumber(signupTotal),
      unit: "New Users",
      // Real, and the only one here that can be: signups come back as a daily series, pulled
      // long enough above to hold the period before this one.
      delta: deltaPercent(signupCounts, window.spanDays),
      deltaLabel: `vs previous ${window.spanDays}d`,
      spark: signupBuckets.map((d) => d.signups),
    },
  ];

  return (
    <>
      <PageHeader
        title={`Welcome back, ${session.username}`}
        subtitle={`${stats.pendingReports} reports are waiting for review.`}
        filters={filters}
        csv={{ name: "dashboard-reports", rows: reports }}
      />

      <div className="space-y-4">
        <KpiCards cards={cards} />

        <EngagementTrend series={series} range={window.granularity} />

        <ReportsTable reports={reports} footerHref="/moderation/reports" />
      </div>
    </>
  );
}
