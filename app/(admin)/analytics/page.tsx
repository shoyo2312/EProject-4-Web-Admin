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
  referenceNow,
} from "@/lib/api/admin";
import {
  BUCKET_UNIT,
  bucketByGranularity,
  isoDay,
  resolveWindow,
  sliceToWindow,
} from "@/lib/api/window";
import { formatCompact, formatCurrency, formatDate, formatNumber } from "@/lib/format";

/**
 * Percentage change of the last `size` entries against the `size` before them.
 * The dashboard shows hardcoded deltas; here the doubled pull makes a real one cheap.
 */
function deltaPercent(values: number[], size: number) {
  const recent = values.slice(-size).reduce((sum, v) => sum + v, 0);
  const previous = values.slice(-size * 2, -size).reduce((sum, v) => sum + v, 0);
  if (previous === 0) return 0;
  return Math.round(((recent - previous) / previous) * 100);
}

function sumLast(values: number[], size: number) {
  return values.slice(-size).reduce((sum, v) => sum + v, 0);
}

/** Eight buckets is what Sparkbars is drawn for; more than that and they stop reading. */
function spark(values: number[], size: number) {
  const window = values.slice(-size);
  const step = Math.max(Math.ceil(window.length / 8), 1);
  const buckets: number[] = [];
  for (let i = 0; i < window.length; i += step) {
    buckets.push(window.slice(i, i + step).reduce((sum, v) => sum + v, 0));
  }
  return buckets;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ g?: string; asOf?: string }>;
}) {
  const latest = isoDay(referenceNow());
  const window = resolveWindow(await searchParams, latest);
  const filters = { granularity: window.granularity, asOf: window.asOf, latest };
  // Inclusive end of day: a row stamped on `asOf` itself belongs inside the window.
  const asOfMs = Date.parse(`${window.asOf}T23:59:59Z`);

  let data;
  try {
    // Twice the display window, so every KPI can be compared against the period before it.
    const [signups, revenue, engagement] = await Promise.all([
      getDailySignups(window.fetchDays + window.spanDays),
      getDailyRevenue(window.fetchDays + window.spanDays),
      getEngagementOverview(asOfMs),
    ]);
    data = { signups, revenue, engagement };
  } catch (error) {
    return (
      <>
        <PageHeader title="Analytics" />
        <ErrorState error={error} />
      </>
    );
  }

  const { signups, revenue, engagement } = data;
  const span = window.spanDays;
  const unit = BUCKET_UNIT[window.granularity];

  // Everything up to the picked date. The KPI helpers below read the last two spans of
  // this, so the comparison period moves with the picker instead of always being today.
  const signupHistory = signups.filter((d) => d.day <= window.asOf);
  const revenueHistory = revenue.filter((d) => d.day <= window.asOf);

  const signupCounts = signupHistory.map((d) => d.signups);
  const revenueAmounts = revenueHistory.map((d) => Number(d.revenue));
  const orderCounts = revenueHistory.map((d) => d.ordersCreated);
  const paymentCounts = revenueHistory.map((d) => d.paymentsCompleted);

  const engagementTotal = engagement.mix.reduce((sum, row) => sum + row.total, 0);

  const ordersLast = sumLast(orderCounts, span);
  const paymentsLast = sumLast(paymentCounts, span);
  const conversion = ordersLast === 0 ? 0 : (paymentsLast / ordersLast) * 100;

  const cards: KpiCard[] = [
    {
      label: "New Signups",
      value: formatNumber(sumLast(signupCounts, span)),
      unit: "Accounts",
      delta: deltaPercent(signupCounts, span),
      deltaLabel: `vs previous ${span}d`,
      spark: spark(signupCounts, span),
    },
    {
      label: "Revenue",
      value: formatCurrency(sumLast(revenueAmounts, span)),
      delta: deltaPercent(revenueAmounts, span),
      deltaLabel: `vs previous ${span}d`,
      spark: spark(revenueAmounts, span),
    },
    {
      label: "Paid Conversion",
      value: `${conversion.toFixed(1)}%`,
      unit: `of ${formatCompact(ordersLast)} orders`,
      delta: deltaPercent(paymentCounts, span) - deltaPercent(orderCounts, span),
      deltaLabel: "payments vs orders",
      spark: spark(paymentCounts, span),
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

  // Money is a string on the wire so it never becomes a float. Bucketing has to add it
  // anyway, so it goes through integer cents and comes back as a string.
  const addMoney = (a: string, b: string) =>
    ((Math.round(Number(a) * 100) + Math.round(Number(b) * 100)) / 100).toFixed(2);

  const signupBuckets = bucketByGranularity(
    sliceToWindow(signupHistory, window),
    window.granularity,
    (a, b) => ({ day: a.day, signups: a.signups + b.signups }),
  );

  const revenueBuckets = bucketByGranularity(
    sliceToWindow(revenueHistory, window),
    window.granularity,
    (a, b) => ({
      day: a.day,
      ordersCreated: a.ordersCreated + b.ordersCreated,
      paymentsCompleted: a.paymentsCompleted + b.paymentsCompleted,
      revenue: addMoney(a.revenue, b.revenue),
    }),
  );

  // The charts read two series keyed by day; the export is the same numbers as one table.
  const revenueByBucket = new Map(revenueBuckets.map((d) => [d.day, d.revenue]));
  const dailyRows = signupBuckets.map((d) => ({
    day: d.day,
    signups: d.signups,
    revenue: revenueByBucket.get(d.day) ?? "0.00",
  }));

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle={`Platform-wide engagement, growth and revenue over the ${span} days ending ${formatDate(window.asOf)}.`}
        filters={filters}
        csv={{ name: `analytics-${window.granularity}`, rows: dailyRows }}
      />

      <div className="space-y-4">
        <KpiCards cards={cards} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
          <EngagementTrend series={engagement.series} range={window.granularity} />
          <EngagementMix rows={engagement.mix} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <AudienceGrowth days={signupBuckets} unit={unit} />
          <RevenueBreakdown days={revenueBuckets} unit={unit} />
        </div>
      </div>
    </>
  );
}
