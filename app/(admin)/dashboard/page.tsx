import { AccountsToWatch } from "@/components/dashboard/accounts-to-watch";
import { EngagementTrend } from "@/components/dashboard/engagement-trend";
import { KpiCards, type KpiCard } from "@/components/dashboard/kpi-cards";
import { ModerationPace } from "@/components/dashboard/moderation-pace";
import { RecentActions } from "@/components/dashboard/recent-actions";
import { WaitingTiles } from "@/components/dashboard/waiting-tiles";
import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { ReportsTable } from "@/components/moderation/reports-table";
import {
  getDailyAdminStats,
  getDailySignups,
  getEngagementSeries,
  getStatsSummary,
} from "@/lib/api/analytics";
import { getDataExportSummary } from "@/lib/api/data-exports";
import { listModerationActions } from "@/lib/api/moderation";
import { getRowNames, getVideoSummaries } from "@/lib/api/names";
import { listReportQueue, listReports } from "@/lib/api/reports";
import { referenceNow } from "@/lib/api/shared";
import { listVideos } from "@/lib/api/videos";
import {
  bucketByGranularity,
  historyUpTo,
  isoDay,
  resolveWindow,
  sliceToWindow,
  windowRange,
} from "@/lib/api/window";
import { getSessionProfile } from "@/lib/api/session";
import {
  accountsToWatch,
  decisionPace,
  oldest,
  waitingSummary,
  waitingTiles,
} from "@/lib/dashboard";
import { deltaPercent, spark, sumLast } from "@/lib/series";
import { formatNumber } from "@/lib/format";
import { idsToName } from "@/lib/names";
import { heldAt } from "@/lib/notifications";

/** Reports read for the median; the table shows the first few of them. */
const REPORT_SAMPLE = 50;
const TABLE_ROWS = 8;
/** The gateway caps admin pages at 50, so the panels read one full page of each queue. */
const QUEUE_SAMPLE = 50;

/** A panel's own source: one service down blanks that panel, not the whole dashboard. */
function optional<T>(promise: Promise<T>): Promise<T | null> {
  return promise.catch(() => null);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; asOf?: string }>;
}) {
  const session = await getSessionProfile();
  const now = referenceNow();
  const latest = isoDay(now);
  const window = resolveWindow(await searchParams, latest);
  const filters = { period: window.period, asOf: window.asOf, latest };
  const asOfMs = Date.parse(`${window.asOf}T23:59:59Z`);
  const { to } = windowRange(window);

  let data;
  try {
    const [stats, signups, adminStats, series, reports, held, queue, oldestReport, exports, actions] =
      await Promise.all([
        getStatsSummary(),
        // fetchDays already holds two periods on top of the chart's stretch, so every card
        // below has the period before this one to compare itself against.
        getDailySignups(window.fetchDays),
        getDailyAdminStats(window.fetchDays),
        getEngagementSeries(asOfMs, window.fetchDays),
        // The newest as of the picked day, which three weeks back are not the newest today.
        listReports({ size: REPORT_SAMPLE, to }).then((page) => page.content),
        // ponytail: one page per queue feeds the oldest-waiting ages and the accounts to watch;
        // a backlog past 50 needs a server-side aggregate for both to stay exact.
        optional(
          listVideos({
            status: "PENDING_REVIEW",
            deleted: false,
            sort: "createdAt,asc",
            size: QUEUE_SAMPLE,
          }),
        ),
        optional(listReportQueue({ size: QUEUE_SAMPLE })),
        // The queue is ranked by weight, so its first page need not hold the oldest report.
        optional(
          listReports({ status: "PENDING", sort: "createdAt", ascending: true, size: 1 }).then(
            (page) => page.content[0]?.createdAt ?? null,
          ),
        ),
        optional(getDataExportSummary()),
        optional(listModerationActions({ size: 6, to }).then((page) => page.content)),
      ]);
    data = { stats, signups, adminStats, series, reports, held, queue, oldestReport, exports, actions };
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

  const { stats, signups, adminStats, series, reports, held, queue, oldestReport, exports, actions } =
    data;
  const { periodDays, periodLabel, compareLabel } = window;

  const tableReports = reports.slice(0, TABLE_ROWS);
  const heldVideos = held?.content ?? [];
  const queueRows = queue?.content ?? [];
  const recent = actions ?? [];

  // Owners first: who is worth watching decides whose handles are fetched, so only names that
  // render are asked for — user-service refuses a batch past 100 ids, and the video batch stops at 50.
  const owners = await getVideoSummaries(
    queueRows.filter((group) => group.targetType === "VIDEO").map((group) => group.targetId),
  );
  const watched =
    held || queue
      ? accountsToWatch({
          held: heldVideos,
          queue: queueRows,
          videoOwners: Object.fromEntries(
            Object.entries(owners).map(([id, video]) => [id, video.userId]),
          ),
        })
      : null;
  const wanted = idsToName(
    [...tableReports, ...recent],
    [...tableReports.map((r) => r.reporterId), ...(watched ?? []).map((a) => a.userId)],
  );
  const names = await getRowNames(wanted.userIds, wanted.videoIds, [
    ...tableReports.map((r) => r.resolvedBy),
    ...recent.map((a) => a.adminId),
  ]);

  const tiles = waitingTiles({
    held: held ? { total: held.totalElements, since: oldest(heldVideos.map(heldAt)) } : null,
    reports: {
      pending: stats.pendingReports,
      targets: queue?.totalElements ?? null,
      since: oldestReport,
    },
    exports,
    now,
  });
  const pace = decisionPace(reports);

  const signupBuckets = bucketByGranularity(
    sliceToWindow(signups, window, (day) => ({ day, signups: 0 })),
    window.bucket,
    (a, b) => ({ day: a.day, signups: a.signups + b.signups }),
  );

  // Daily and uncut, so each delta compares the period against the period before it —
  // the bucketed series above is only the chart's window, with nothing behind it.
  const signupCounts = historyUpTo(signups, window, (d) => d.signups);
  const reportsCreatedCounts = historyUpTo(adminStats, window, (d) => d.reportsCreated);
  const reportsClosedCounts = historyUpTo(
    adminStats,
    window,
    (d) => d.reportsResolved + d.reportsDismissed,
  );
  const actionsTakenCounts = historyUpTo(adminStats, window, (d) => d.actionsTaken);
  const takedownCounts = historyUpTo(adminStats, window, (d) => d.videosTakenDown);

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
        subtitle={waitingSummary(held ? held.totalElements : null, stats.pendingReports)}
        filters={filters}
        csv={{ name: "dashboard-reports", rows: tableReports }}
      />

      <div className="stagger space-y-4">
        <WaitingTiles tiles={tiles} />

        <KpiCards cards={cards} />

        <div className="stagger grid gap-4 xl:grid-cols-3">
          <ModerationPace
            decisions24h={stats.actionsLast24h}
            filed={sumLast(reportsCreatedCounts, periodDays)}
            closed={sumLast(reportsClosedCounts, periodDays)}
            periodLabel={periodLabel}
            medianMs={pace.medianMs}
            decided={pace.decided}
            sample={reports.length}
          />
          <RecentActions actions={actions} names={names} now={now} />
          <AccountsToWatch accounts={watched} handles={names.handles} />
        </div>

        <EngagementTrend series={series} range={window.bucket} />

        <ReportsTable reports={tableReports} names={names} footerHref="/moderation/reports" />
      </div>
    </>
  );
}
