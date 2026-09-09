import { EngagementTrend } from "@/components/dashboard/engagement-trend";
import { KpiCards, type KpiCard } from "@/components/dashboard/kpi-cards";
import { RevenueBreakdown } from "@/components/dashboard/revenue-breakdown";
import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { ReportsTable } from "@/components/moderation/reports-table";
import {
  getDailyRevenue,
  getDailySignups,
  getEngagementSeries,
  getStatsSummary,
  listReports,
  referenceNow,
} from "@/lib/api/admin";
import {
  BUCKET_UNIT,
  bucketByGranularity,
  isoDay,
  resolveWindow,
  sliceToWindow,
} from "@/lib/api/window";
import { getSessionProfile } from "@/lib/api/session";
import { formatCurrency, formatNumber } from "@/lib/format";

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
    const [stats, signups, revenue, series, reports] = await Promise.all([
      getStatsSummary(),
      getDailySignups(window.fetchDays),
      getDailyRevenue(window.fetchDays),
      getEngagementSeries(asOfMs),
      // Over-fetched, then cut to the picked date: the eight newest reports as of
      // three weeks ago are not the eight newest today.
      listReports({ size: 100 }),
    ]);
    data = { stats, signups, revenue, series, reports };
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

  const { stats, signups, revenue, series } = data;
  const unit = BUCKET_UNIT[window.granularity];

  const reports = data.reports
    .filter((r) => r.createdAt.slice(0, 10) <= window.asOf)
    .slice(0, 8);

  const signupBuckets = bucketByGranularity(
    sliceToWindow(signups, window),
    window.granularity,
    (a, b) => ({ day: a.day, signups: a.signups + b.signups }),
  );

  const addMoney = (a: string, b: string) =>
    ((Math.round(Number(a) * 100) + Math.round(Number(b) * 100)) / 100).toFixed(2);

  const revenueBuckets = bucketByGranularity(
    sliceToWindow(revenue, window),
    window.granularity,
    (a, b) => ({
      day: a.day,
      ordersCreated: a.ordersCreated + b.ordersCreated,
      paymentsCompleted: a.paymentsCompleted + b.paymentsCompleted,
      revenue: addMoney(a.revenue, b.revenue),
    }),
  );

  const signupTotal = signupBuckets.reduce((sum, d) => sum + d.signups, 0);
  const revenueTotal = revenueBuckets.reduce((sum, d) => sum + Number(d.revenue), 0);

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
    {
      label: `Revenue (${revenueBuckets.length}${unit})`,
      value: formatCurrency(revenueTotal),
      delta: -3,
      deltaLabel: "last week",
      spark: revenueBuckets.map((d) => Number(d.revenue)),
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

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
          <EngagementTrend series={series} range={window.granularity} />
          <RevenueBreakdown days={revenueBuckets} unit={unit} />
        </div>

        <ReportsTable reports={reports} footerHref="/moderation/reports" />
      </div>
    </>
  );
}
