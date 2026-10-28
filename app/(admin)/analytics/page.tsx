import { ActiveUsers } from "@/components/analytics/active-users";
import { AudienceGrowth } from "@/components/analytics/audience-growth";
import { EngagementMix } from "@/components/analytics/engagement-mix";
import { TopVideos } from "@/components/analytics/top-videos";
import { Uploads } from "@/components/analytics/uploads";
import { EngagementTrend } from "@/components/dashboard/engagement-trend";
import { KpiCards, type KpiCard } from "@/components/dashboard/kpi-cards";
import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import {
  getDailyActiveUsers,
  getDailySignups,
  getDailyVideoStats,
  getEngagementOverview,
  getTopVideos,
} from "@/lib/api/analytics";
import { getHandles, getVideoSummaries } from "@/lib/api/names";
import { referenceNow } from "@/lib/api/shared";
import { engagementByDay, toEngagementMix } from "@/lib/api/rollup";
import {
  BUCKET_UNIT,
  bucketByGranularity,
  bucketMean,
  historyUpTo,
  inPeriod,
  isoDay,
  resolveWindow,
  sliceToWindow,
  windowRange,
} from "@/lib/api/window";
import { deltaPercent, spark, sumLast } from "@/lib/series";
import { formatDate, formatNumber } from "@/lib/format";

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
    const [signups, engagement, activeUsers, videoStats, topVideos] = await Promise.all([
      getDailySignups(window.fetchDays),
      getEngagementOverview(asOfMs, window.fetchDays),
      getDailyActiveUsers(window.fetchDays),
      getDailyVideoStats(window.fetchDays),
      // The period itself, not the doubled window: this list is "what people watched over
      // these days", and there is nothing to compare it against. Ending on the as-of day like
      // every other figure here, so an earlier date shows what was watched then.
      getTopVideos(window.periodDays, 20, windowRange(window).to),
    ]);
    data = { signups, engagement, activeUsers, videoStats, topVideos };
  } catch (error) {
    return (
      <>
        <PageHeader title="Analytics" />
        <ErrorState error={error} />
      </>
    );
  }

  const { signups, engagement, activeUsers, videoStats, topVideos } = data;
  const { periodDays, periodLabel, compareLabel, chartDays } = window;
  const unit = BUCKET_UNIT[window.bucket];

  // Most watched carries ids only: one lookup names the videos, a second their owners.
  const topSummaries = await getVideoSummaries(topVideos.map((row) => row.videoId));
  const topNames = {
    videos: topSummaries,
    handles: await getHandles(Object.values(topSummaries).map((video) => video.userId)),
  };

  // Everything up to the picked date, uncut. The KPI helpers below read the last two periods
  // of this, so the comparison moves with the picker instead of always being today.
  const signupCounts = historyUpTo(signups, window, (d) => d.signups);

  // Average over the period rather than the latest day: one day's figure is a weekday or a
  // weekend, and the card sits next to a percentage that compares two whole periods.
  const dauCounts = historyUpTo(activeUsers, window, (d) => d.activeUsers);
  const dauAverage = Math.round(sumLast(dauCounts, periodDays) / periodDays);
  // The series is zero-filled, so its length no longer says whether anything was recorded.
  const noDau = !activeUsers.some((d) => d.day <= window.asOf);

  // The trend's own quantity — likes net of unlikes, comments and shares — per day, so the
  // figure, its spark and its percentage all describe the same thing over the same days.
  const engagementCounts = historyUpTo(engagementByDay(engagement.rows), window, (d) => d.events);
  const uploadCounts = historyUpTo(videoStats, window, (d) => d.uploads);

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
      value: noDau ? "—" : formatNumber(dauAverage),
      unit: `Average, ${periodLabel.toLowerCase()}`,
      delta: deltaPercent(dauCounts, periodDays),
      deltaLabel: compareLabel,
      spark: spark(dauCounts, chartDays),
    },
    {
      label: "Engagement",
      value: formatNumber(sumLast(engagementCounts, periodDays)),
      unit: periodLabel,
      delta: deltaPercent(engagementCounts, periodDays),
      deltaLabel: compareLabel,
      spark: spark(engagementCounts, chartDays),
    },
    {
      label: "Uploads",
      value: formatNumber(sumLast(uploadCounts, periodDays)),
      unit: periodLabel,
      delta: deltaPercent(uploadCounts, periodDays),
      deltaLabel: compareLabel,
      spark: spark(uploadCounts, chartDays),
    },
  ];

  const signupBuckets = bucketByGranularity(
    sliceToWindow(signups, window, (day) => ({ day, signups: 0 })),
    window.bucket,
    (a, b) => ({ day: a.day, signups: a.signups + b.signups }),
  );

  const dauDays = sliceToWindow(activeUsers, window, (day) => ({ day, activeUsers: 0 }));
  const dauBars = bucketMean(dauDays, window.bucket, (d) => d.activeUsers);

  const uploadDays = sliceToWindow(videoStats, window, (day) => ({
    day,
    uploads: 0,
    pendingReview: 0,
    notPlayable: 0,
  }));
  const uploadBars = bucketByGranularity(uploadDays, window.bucket, (a, b) => ({
    day: a.day,
    uploads: a.uploads + b.uploads,
    pendingReview: a.pendingReview + b.pendingReview,
    notPlayable: a.notPlayable + b.notPlayable,
  })).map((d) => ({ day: d.day, value: d.uploads }));

  // The mix covers the figures' days, not the trend's year: beside "Last 30d" cards, a total
  // over 365 days reads as this month's.
  const mix = toEngagementMix(engagement.rows.filter((row) => inPeriod(row.day, window)));

  // One row per chart bar with every series side by side, so the export is the charts' data.
  const dauByBar = new Map(dauBars.map((bar) => [bar.day, bar.value]));
  const uploadsByBar = new Map(uploadBars.map((bar) => [bar.day, bar.value]));
  const csvRows = signupBuckets.map((d) => ({
    day: d.day,
    signups: d.signups,
    activeUsers: dauByBar.get(d.day) ?? 0,
    uploads: uploadsByBar.get(d.day) ?? 0,
  }));

  const covered =
    periodDays === 1
      ? formatDate(window.asOf)
      : `the ${periodDays} days up to ${formatDate(window.asOf)}`;
  const before = periodDays === 1 ? "the day before" : `the ${periodDays} before`;

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle={`Figures cover ${covered}, compared with ${before}. Each chart is labelled with its own range.`}
        filters={filters}
        csv={{ name: `analytics-${window.period}`, rows: csvRows }}
      />

      <div className="stagger space-y-4">
        <KpiCards cards={cards} />

        <div className="stagger grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
          <EngagementTrend series={engagement.series} range={window.bucket} />
          <EngagementMix rows={mix} period={periodLabel} />
        </div>

        <AudienceGrowth days={signupBuckets} unit={unit} />

        <div className="stagger grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ActiveUsers days={dauDays} bars={dauBars} />
          <Uploads days={uploadDays} bars={uploadBars} unit={unit} />
        </div>

        <TopVideos rows={topVideos} period={covered} names={topNames} />
      </div>
    </>
  );
}
