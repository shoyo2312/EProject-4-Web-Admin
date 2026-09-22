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
  historyUpTo,
  isoDay,
  resolveWindow,
  sliceToWindow,
} from "@/lib/api/window";
import { deltaPercent, spark, sumLast } from "@/lib/series";
import { formatCompact, formatDate, formatNumber } from "@/lib/format";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; asOf?: string }>;
}) {
  const latest = isoDay(referenceNow());
  const window = resolveWindow(await searchParams, latest);
  const filters = { period: window.period, asOf: window.asOf, latest };
  // Inclusive end of day: a row stamped on `asOf` itself belongs inside the window.
  const asOfMs = Date.parse(`${window.asOf}T23:59:59Z`);

  let data;
  try {
    // fetchDays covers the charts and two periods on top, so every KPI below can be
    // compared against the period before it.
    const [signups, engagement, activeUsers, topVideos] = await Promise.all([
      getDailySignups(window.fetchDays),
      getEngagementOverview(asOfMs),
      getDailyActiveUsers(window.fetchDays),
      // The period itself, not the doubled window: this list is "what people watched over
      // these days", and there is nothing to compare it against.
      getTopVideos(window.periodDays),
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
  const { periodDays, periodLabel, compareLabel, chartDays } = window;
  const unit = BUCKET_UNIT[window.bucket];

  // Everything up to the picked date, uncut. The KPI helpers below read the last two periods
  // of this, so the comparison moves with the picker instead of always being today.
  const signupHistory = historyUpTo(signups, window);
  const signupCounts = signupHistory.map((d) => d.signups);

  // Average over the period rather than the latest day: one day's figure is a weekday or a
  // weekend, and the card sits next to a percentage that compares two whole periods.
  const dauCounts = historyUpTo(activeUsers, window).map((d) => d.activeUsers);
  const dauAverage =
    dauCounts.length === 0 ? 0 : Math.round(sumLast(dauCounts, periodDays) / periodDays);

  const engagementCounts = engagement.series.daily.map((b) => b.primary + b.secondary);
  const engagementTotal = engagement.mix.reduce((sum, row) => sum + row.total, 0);

  const cards: KpiCard[] = [
    {
      label: "New Signups",
      value: formatNumber(sumLast(signupCounts, periodDays)),
      unit: periodLabel,
      delta: deltaPercent(signupCounts, periodDays),
      deltaLabel: compareLabel,
      spark: spark(signupCounts, chartDays),
    },
    {
      label: "Daily Active Users",
      value: dauCounts.length === 0 ? "—" : formatNumber(dauAverage),
      unit: `Average, ${periodLabel.toLowerCase()}`,
      delta: deltaPercent(dauCounts, periodDays),
      deltaLabel: compareLabel,
      spark: spark(dauCounts, chartDays),
    },
    {
      label: "Engagement Events",
      value: formatCompact(engagementTotal),
      unit: "Last 365d",
      // The rollup behind this is a fixed 365-day pull, so a year-long period has only one
      // year of history and no year before it to compare against — deltaPercent answers
      // null there rather than comparing a year against nothing.
      delta: deltaPercent(engagementCounts, periodDays),
      deltaLabel: compareLabel,
      spark: spark(engagementCounts, chartDays),
    },
  ];

  const signupBuckets = bucketByGranularity(
    sliceToWindow(signupHistory, window),
    window.bucket,
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
        subtitle={`Platform-wide engagement and growth over the ${chartDays} days ending ${formatDate(window.asOf)}.`}
        filters={filters}
        csv={{ name: `analytics-${window.period}`, rows: dailyRows }}
      />

      <div className="space-y-4">
        <KpiCards cards={cards} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
          <EngagementTrend series={engagement.series} range={window.bucket} />
          <EngagementMix rows={engagement.mix} />
        </div>

        <AudienceGrowth days={signupBuckets} unit={unit} />

        <TopVideos rows={topVideos} days={periodDays} />
      </div>
    </>
  );
}
