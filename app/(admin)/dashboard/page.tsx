import { EngagementTrend } from "@/components/dashboard/engagement-trend";
import { KpiCards, type KpiCard } from "@/components/dashboard/kpi-cards";
import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { ReportsTable } from "@/components/moderation/reports-table";
import {
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
import { deltaPercent } from "@/lib/series";
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
    const [stats, signups, series, reports] = await Promise.all([
      getStatsSummary(),
      // Twice the display window, so the signup KPI can be compared against the period before
      // it. The same pull the analytics page makes, for the same reason.
      getDailySignups(window.compareDays),
      getEngagementSeries(asOfMs),
      // Over-fetched, then cut to the picked date: the eight newest reports as of
      // three weeks ago are not the eight newest today.
      // Only the newest slice — the dashboard card shows a handful and links to the queue.
      listReports({ size: 8 }).then((page) => page.content),
    ]);
    data = { stats, signups, series, reports };
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

  const { stats, signups, series } = data;

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

  /**
   * No delta and no sparkline on the two moderation figures, because nothing on this page
   * measures either of them over time: `/stats/summary` answers with a snapshot, and the only
   * series to hand is engagement. Drawing engagement bars under "Pending Reports" and a
   * percentage next to them invents a trend for a number that has none — and a dashboard is
   * exactly where an invented trend gets believed and acted on.
   *
   * ponytail: an `actions_last_24h`-style daily series out of admin-service (or a
   * `GET /admin/stats/daily`) is what would fill them in honestly. Until then, the figure alone.
   */
  const cards: KpiCard[] = [
    {
      label: "Pending Reports",
      value: formatNumber(stats.pendingReports),
      unit: "Reports",
      // More reports waiting is worse, so an upward move would read red here
      invertDelta: true,
    },
    {
      label: "Actions (24h)",
      value: formatNumber(stats.actionsLast24h),
      unit: "Actions",
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
