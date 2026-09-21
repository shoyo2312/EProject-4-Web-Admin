import { AudienceGrowth } from "@/components/analytics/audience-growth";
import { EngagementMix } from "@/components/analytics/engagement-mix";
import { TopVideos } from "@/components/analytics/top-videos";
import { EngagementTrend } from "@/components/dashboard/engagement-trend";
import { KpiCards, type KpiCard } from "@/components/dashboard/kpi-cards";
import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import {
  getDailyActiveUsers,
  getDailySignups,
  getEngagementOverview,
  getTopVideos,
  referenceNow,
} from "@/lib/api/admin";
import {
  BUCKET_UNIT,
  bucketByGranularity,
  isoDay,
  resolveWindow,
  sliceToWindow,
} from "@/lib/api/window";
import { deltaPercent, spark, sumLast } from "@/lib/series";
import { formatCompact, formatDate, formatNumber } from "@/lib/format";

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
    const [signups, engagement, activeUsers, topVideos] = await Promise.all([
      getDailySignups(window.compareDays),
      getEngagementOverview(asOfMs),
      getDailyActiveUsers(window.compareDays),
      // The window's own span, not the doubled one: this list is "what people watched over
      // these days", and there is nothing to compare it against.
      getTopVideos(window.spanDays),
    ]);
    data = { signups, engagement, activeUsers, topVideos };
  } catch (error) {
    return (
      <>
        <PageHeader title="Analytics" />
        <ErrorState error={error} />
      </>
    );
  }

  const { signups, engagement, activeUsers, topVideos } = data;
  const span = window.spanDays;
  const unit = BUCKET_UNIT[window.granularity];

  // Everything up to the picked date. The KPI helpers below read the last two spans of
  // this, so the comparison period moves with the picker instead of always being today.
  const signupHistory = signups.filter((d) => d.day <= window.asOf);

  const signupCounts = signupHistory.map((d) => d.signups);

  // Average over the span rather than the latest day: one day's figure is a weekday or a
  // weekend, and the card sits next to a delta that compares two spans.
  const dauCounts = activeUsers.filter((d) => d.day <= window.asOf).map((d) => d.activeUsers);
  const dauAverage = dauCounts.length === 0 ? 0 : Math.round(sumLast(dauCounts, span) / span);

  const engagementTotal = engagement.mix.reduce((sum, row) => sum + row.total, 0);

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
      label: "Daily Active Users",
      value: dauCounts.length === 0 ? "—" : formatNumber(dauAverage),
      unit: `Average over ${span}d`,
      delta: deltaPercent(dauCounts, span),
      deltaLabel: `vs previous ${span}d`,
      spark: spark(dauCounts, span),
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

  const signupBuckets = bucketByGranularity(
    sliceToWindow(signupHistory, window),
    window.granularity,
    (a, b) => ({ day: a.day, signups: a.signups + b.signups }),
  );

  const dailyRows = signupBuckets.map((d) => ({
    day: d.day,
    signups: d.signups,
  }));

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle={`Platform-wide engagement and growth over the ${span} days ending ${formatDate(window.asOf)}.`}
        filters={filters}
        csv={{ name: `analytics-${window.granularity}`, rows: dailyRows }}
      />

      <div className="space-y-4">
        <KpiCards cards={cards} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
          <EngagementTrend series={engagement.series} range={window.granularity} />
          <EngagementMix rows={engagement.mix} />
        </div>

        <AudienceGrowth days={signupBuckets} unit={unit} />

        <TopVideos rows={topVideos} days={span} />
      </div>
    </>
  );
}
