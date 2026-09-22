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
  historyUpTo,
  isoDay,
  resolveWindow,
  sliceToWindow,
} from "@/lib/api/window";
import { getSessionProfile } from "@/lib/api/session";
import { deltaPercent, spark, sumLast } from "@/lib/series";
import { formatNumber } from "@/lib/format";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; asOf?: string }>;
}) {
  const session = await getSessionProfile();
  const latest = isoDay(referenceNow());
  const window = resolveWindow(await searchParams, latest);
  const filters = { period: window.period, asOf: window.asOf, latest };
  const asOfMs = Date.parse(`${window.asOf}T23:59:59Z`);

  let data;
  try {
    const [stats, signups, adminStats, series, reports] = await Promise.all([
      getStatsSummary(),
      // fetchDays already holds two periods on top of the chart's stretch, so every card
      // below has the period before this one to compare itself against.
      getDailySignups(window.fetchDays),
      getDailyAdminStats(window.fetchDays),
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
  const { periodDays, periodLabel, compareLabel } = window;

  const reports = data.reports
    .filter((r) => r.createdAt.slice(0, 10) <= window.asOf)
    .slice(0, 8);

  const signupBuckets = bucketByGranularity(
    sliceToWindow(signups, window),
    window.bucket,
    (a, b) => ({ day: a.day, signups: a.signups + b.signups }),
  );

  // Daily and uncut, so each delta compares the period against the period before it —
  // the bucketed series above is only the chart's window, with nothing behind it.
  const signupCounts = historyUpTo(signups, window).map((d) => d.signups);
  const dailyStats = historyUpTo(adminStats, window);
  const reportsCreatedCounts = dailyStats.map((d) => d.reportsCreated);
  const actionsTakenCounts = dailyStats.map((d) => d.actionsTaken);
  const takedownCounts = dailyStats.map((d) => d.videosTakenDown);

  const cards: KpiCard[] = [
    {
      label: "Pending Reports",
      value: formatNumber(stats.pendingReports),
      unit: "Right now",
      // Queue depth is a snapshot: nothing records how deep it was a month ago. The
      // percentage is on the flow that fills it — reports filed this period against the
      // period before — which is the thing that actually moved. More filed is worse, so it
      // reads red rising, same as the depth itself would.
      delta: deltaPercent(reportsCreatedCounts, periodDays),
      deltaLabel: `filed, ${compareLabel}`,
      invertDelta: true,
      spark: spark(reportsCreatedCounts, window.chartDays),
    },
    {
      label: "Actions Taken",
      value: formatNumber(sumLast(actionsTakenCounts, periodDays)),
      unit: periodLabel,
      delta: deltaPercent(actionsTakenCounts, periodDays),
      deltaLabel: compareLabel,
      spark: spark(actionsTakenCounts, window.chartDays),
    },
    {
      label: "New Signups",
      value: formatNumber(sumLast(signupCounts, periodDays)),
      unit: periodLabel,
      delta: deltaPercent(signupCounts, periodDays),
      deltaLabel: compareLabel,
      spark: signupBuckets.map((d) => d.signups),
    },
    {
      label: "Videos Taken Down",
      value: formatNumber(sumLast(takedownCounts, periodDays)),
      unit: periodLabel,
      // Not inverted: a busier week of takedowns is a queue being worked, not a platform
      // getting worse. The figure that would be bad rising is the backlog, one card along.
      delta: deltaPercent(takedownCounts, periodDays),
      deltaLabel: compareLabel,
      spark: spark(takedownCounts, window.chartDays),
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

        <EngagementTrend series={series} range={window.bucket} />

        <ReportsTable reports={reports} footerHref="/moderation/reports" />
      </div>
    </>
  );
}
