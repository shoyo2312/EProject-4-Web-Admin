import { AudienceGrowth } from "@/components/analytics/audience-growth";
import { EngagementMix } from "@/components/analytics/engagement-mix";
import { EngagementTrend } from "@/components/dashboard/engagement-trend";
import { KpiCards, type KpiCard } from "@/components/dashboard/kpi-cards";
import { RevenueBreakdown } from "@/components/dashboard/revenue-breakdown";
import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import {
  getDailyRevenue,
  getDailySignups,
  getEngagementOverview,
} from "@/lib/api/admin";
import { formatCompact, formatCurrency, formatNumber } from "@/lib/format";

const WINDOW = 30;

/**
 * Percentage change of the last `size` entries against the `size` before them.
 * The dashboard shows hardcoded deltas; here the 60-day pull makes a real one cheap.
 */
function deltaPercent(values: number[], size = WINDOW) {
  const recent = values.slice(-size).reduce((sum, v) => sum + v, 0);
  const previous = values.slice(-size * 2, -size).reduce((sum, v) => sum + v, 0);
  if (previous === 0) return 0;
  return Math.round(((recent - previous) / previous) * 100);
}

function sumLast(values: number[], size = WINDOW) {
  return values.slice(-size).reduce((sum, v) => sum + v, 0);
}

/** Eight buckets is what Sparkbars is drawn for; more than that and they stop reading. */
function spark(values: number[]) {
  const window = values.slice(-WINDOW);
  const step = Math.max(Math.ceil(window.length / 8), 1);
  const buckets: number[] = [];
  for (let i = 0; i < window.length; i += step) {
    buckets.push(window.slice(i, i + step).reduce((sum, v) => sum + v, 0));
  }
  return buckets;
}

export default async function AnalyticsPage() {
  let data;
  try {
    // Twice the display window, so every KPI can be compared against the period before it.
    const [signups, revenue, engagement] = await Promise.all([
      getDailySignups(WINDOW * 2),
      getDailyRevenue(WINDOW * 2),
      getEngagementOverview(),
    ]);
    data = { signups, revenue, engagement };
  } catch (error) {
    return (
      <>
        <PageHeader title="Analytics" showFilters={false} />
        <ErrorState error={error} />
      </>
    );
  }

  const { signups, revenue, engagement } = data;

  const signupCounts = signups.map((d) => d.signups);
  const revenueAmounts = revenue.map((d) => Number(d.revenue));
  const orderCounts = revenue.map((d) => d.ordersCreated);
  const paymentCounts = revenue.map((d) => d.paymentsCompleted);

  const engagementTotal = engagement.mix.reduce((sum, row) => sum + row.total, 0);

  const ordersLast = sumLast(orderCounts);
  const paymentsLast = sumLast(paymentCounts);
  const conversion = ordersLast === 0 ? 0 : (paymentsLast / ordersLast) * 100;

  const cards: KpiCard[] = [
    {
      label: "New Signups",
      value: formatNumber(sumLast(signupCounts)),
      unit: "Accounts",
      delta: deltaPercent(signupCounts),
      deltaLabel: `vs previous ${WINDOW}d`,
      spark: spark(signupCounts),
    },
    {
      label: "Revenue",
      value: formatCurrency(sumLast(revenueAmounts)),
      delta: deltaPercent(revenueAmounts),
      deltaLabel: `vs previous ${WINDOW}d`,
      spark: spark(revenueAmounts),
    },
    {
      label: "Paid Conversion",
      value: `${conversion.toFixed(1)}%`,
      unit: `of ${formatCompact(ordersLast)} orders`,
      delta: deltaPercent(paymentCounts) - deltaPercent(orderCounts),
      deltaLabel: "payments vs orders",
      spark: spark(paymentCounts),
    },
    {
      label: "Engagement Events",
      value: formatCompact(engagementTotal),
      unit: "Last 365d",
      delta: deltaPercent(
        engagement.series.daily.map((b) => b.primary + b.secondary),
        7,
      ),
      deltaLabel: "vs previous 7d",
      spark: engagement.series.daily
        .slice(-8)
        .map((b) => b.primary + b.secondary),
    },
  ];

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle={`Platform-wide engagement, growth and revenue over the last ${WINDOW} days.`}
      />

      <div className="space-y-4">
        <KpiCards cards={cards} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
          <EngagementTrend series={engagement.series} />
          <EngagementMix rows={engagement.mix} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <AudienceGrowth days={signups.slice(-WINDOW)} />
          <RevenueBreakdown days={revenue.slice(-WINDOW)} />
        </div>
      </div>
    </>
  );
}
