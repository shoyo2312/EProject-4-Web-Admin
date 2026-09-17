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
      getDailySignups(window.fetchDays),
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

  const cards: KpiCard[] = [
    {
      label: "Pending Reports",
      value: formatNumber(stats.pendingReports),
      unit: "Reports",
      delta: 12,
      deltaLabel: "vs yesterday",
      // More reports waiting is worse, so an upward move reads red here
      invertDelta: true,
      spark: series[window.granularity].slice(-8).map((b) => b.secondary),
    },
    {
      label: "Actions (24h)",
      value: formatNumber(stats.actionsLast24h),
      unit: "Actions",
      delta: 8,
      deltaLabel: "vs yesterday",
      spark: series[window.granularity].slice(-8).map((b) => b.primary),
    },
    {
      label: "New Signups",
      value: formatNumber(signupTotal),
      unit: "New Users",
      delta: 4,
      deltaLabel: `last ${window.granularity === "daily" ? "period" : "bucket"}`,
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
