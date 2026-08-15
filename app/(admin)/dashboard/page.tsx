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
} from "@/lib/api/admin";
import { getSessionProfile } from "@/lib/api/session";
import { formatCurrency, formatNumber } from "@/lib/format";

export default async function DashboardPage() {
  const session = await getSessionProfile();

  let data;
  try {
    const [stats, signups, revenue, series, reports] = await Promise.all([
      getStatsSummary(),
      getDailySignups(7),
      getDailyRevenue(30),
      getEngagementSeries(),
      listReports({ size: 8 }),
    ]);
    data = { stats, signups, revenue, series, reports };
  } catch (error) {
    return (
      <>
        <PageHeader
          title={`Welcome back, ${session.username}`}
          showFilters={false}
        />
        <ErrorState error={error} />
      </>
    );
  }

  const { stats, signups, revenue, series, reports } = data;

  const signupTotal = signups.reduce((sum, d) => sum + d.signups, 0);
  const revenueLast7 = revenue.slice(-7);
  const revenueTotal = revenueLast7.reduce((sum, d) => sum + Number(d.revenue), 0);

  const cards: KpiCard[] = [
    {
      label: "Pending Reports",
      value: formatNumber(stats.pendingReports),
      unit: "Reports",
      delta: 12,
      deltaLabel: "vs yesterday",
      // More reports waiting is worse, so an upward move reads red here
      invertDelta: true,
      spark: series.daily.slice(-8).map((b) => b.secondary),
    },
    {
      label: "Actions (24h)",
      value: formatNumber(stats.actionsLast24h),
      unit: "Actions",
      delta: 8,
      deltaLabel: "vs yesterday",
      spark: series.daily.slice(-8).map((b) => b.primary),
    },
    {
      label: "New Signups",
      value: formatNumber(signupTotal),
      unit: "New Users",
      delta: 4,
      deltaLabel: "last week",
      spark: signups.map((d) => d.signups),
    },
    {
      label: "Revenue (7d)",
      value: formatCurrency(revenueTotal),
      delta: -3,
      deltaLabel: "last week",
      spark: revenueLast7.map((d) => Number(d.revenue)),
    },
  ];

  return (
    <>
      <PageHeader
        title={`Welcome back, ${session.username}`}
        subtitle={`${stats.pendingReports} reports are waiting for review.`}
      />

      <div className="space-y-4">
        <KpiCards cards={cards} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
          <EngagementTrend series={series} />
          <RevenueBreakdown days={revenue} />
        </div>

        <ReportsTable reports={reports} footerHref="/moderation/reports" />
      </div>
    </>
  );
}
