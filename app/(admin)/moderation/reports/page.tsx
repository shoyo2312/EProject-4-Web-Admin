import { KpiCards, type KpiCard } from "@/components/dashboard/kpi-cards";
import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { ReportQueueTable } from "@/components/moderation/report-queue-table";
import { ReportsTable } from "@/components/moderation/reports-table";
import { Pager } from "@/components/ui/pager";
import {
  LIST_PAGE_SIZE,
  getDailyAdminStats,
  getRowNames,
  getStatsSummary,
  listReportQueue,
  listReports,
  referenceNow,
} from "@/lib/api/admin";
import { historyUpTo, isoDay, parsePage, resolveWindow } from "@/lib/api/window";
import { deltaPercent, growthPercent, spark, sumLast } from "@/lib/series";
import { formatNumber } from "@/lib/format";
import { reportFilters } from "@/lib/list-filters";
import { idsToName } from "@/lib/names";

/**
 * Two tables, because they answer two questions.
 *
 * The queue is the worklist: standing reports grouped by target, ranked server-side, one row per
 * decision. The ledger below it is every report ever filed, searchable and filterable by status —
 * what you open when someone asks about report #…4821, not what you work through.
 *
 * Collapsing them would lose one or the other: a worklist that lists resolved rows is not a
 * worklist, and a ledger that groups fifty reports into one line cannot find a single report.
 */
export default async function ReportsQueuePage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    status?: string;
    target?: string;
    sort?: string;
    dir?: string;
    p?: string;
    asOf?: string;
  }>;
}) {
  const params = await searchParams;
  const latest = isoDay(referenceNow());
  const window = resolveWindow(params, latest);
  const { periodDays, periodLabel, compareLabel } = window;
  const pageIndex = parsePage(params.page);
  // Every ledger control is parsed and handed to the backend; see lib/list-filters for why an
  // unknown value becomes no filter rather than an error.
  const { status, targetType, sort, ascending } = reportFilters(params);

  let stats;
  let queue;
  let ledger;
  let adminStats;
  try {
    [stats, queue, ledger, adminStats] = await Promise.all([
      getStatsSummary(),
      listReportQueue(),
      listReports({ status, targetType, sort, ascending, page: pageIndex }),
      // Two periods deep, so each figure has the period before this one behind it.
      getDailyAdminStats(window.fetchDays),
    ]);
  } catch (error) {
    return (
      <>
        <PageHeader title="Reports Queue" />
        <ErrorState error={error} />
      </>
    );
  }

  // Both tables name what they list — reporters, resolvers, reported accounts and videos — from
  // one batch per kind for the whole page.
  const wanted = idsToName(
    [...queue.content, ...ledger.content],
    ledger.content.map((r) => r.reporterId),
  );
  const names = await getRowNames(
    wanted.userIds,
    wanted.videoIds,
    ledger.content.map((r) => r.resolvedBy),
  );

  // Daily and uncut, so a delta compares the period against the period before it. Closures
  // are dated by when the report was closed, not when it was filed — see the API type.
  const createdCounts = historyUpTo(adminStats, window, (d) => d.reportsCreated);
  const resolvedCounts = historyUpTo(adminStats, window, (d) => d.reportsResolved);
  const dismissedCounts = historyUpTo(adminStats, window, (d) => d.reportsDismissed);
  const actionCounts = historyUpTo(adminStats, window, (d) => d.actionsTaken);

  const cards: KpiCard[] = [
    {
      label: "Pending",
      value: formatNumber(stats.pendingReports),
      unit: "Right now",
      // Queue depth is a snapshot with no history behind it, so the percentage is on the
      // flow that fills it: reports filed this period against the period before.
      delta: deltaPercent(createdCounts, periodDays),
      deltaLabel: `filed, ${compareLabel}`,
      invertDelta: true,
      spark: spark(createdCounts, window.chartDays),
    },
    {
      label: "Resolved",
      value: formatNumber(stats.resolvedReports),
      unit: "All time",
      // A running total, so the growth is this period's closures over the total as it stood
      // when the period began.
      delta: growthPercent(stats.resolvedReports, sumLast(resolvedCounts, periodDays)),
      deltaLabel: compareLabel,
      spark: spark(resolvedCounts, window.chartDays),
    },
    {
      label: "Dismissed",
      value: formatNumber(stats.dismissedReports),
      unit: "All time",
      delta: growthPercent(stats.dismissedReports, sumLast(dismissedCounts, periodDays)),
      deltaLabel: compareLabel,
      spark: spark(dismissedCounts, window.chartDays),
    },
    {
      label: "Actions Taken",
      value: formatNumber(sumLast(actionCounts, periodDays)),
      unit: periodLabel,
      delta: deltaPercent(actionCounts, periodDays),
      deltaLabel: compareLabel,
      spark: spark(actionCounts, window.chartDays),
    },
  ];

  return (
    <>
      <PageHeader
        title="Reports Queue"
        subtitle="Reported videos, accounts and comments, heaviest first. One row is one target and one decision — resolving it closes every report standing against it."
        filters={{ period: window.period, asOf: window.asOf, latest }}
        // The ledger, every row its filters match: the queue above it is a worklist, and the
        // ledger is the record someone asks for a copy of.
        csv={{
          name: "reports",
          rows: ledger.content,
          all: { dataset: "reports", params, total: ledger.totalElements },
        }}
      />

      <div className="space-y-4">
        <KpiCards cards={cards} />

        <ReportQueueTable groups={queue.content} total={queue.totalElements} names={names} />

        {/* Passing `filter` is what makes the table's controls write to the URL and come back
            through listReports, rather than sifting the twenty-five rows already on screen. */}
        <ReportsTable
          title="All reports"
          reports={ledger.content}
          names={names}
          filter={{
            status: status ?? "ALL",
            targetType: targetType ?? "ALL",
            sort,
            ascending,
          }}
        />

        <Pager
          page={ledger.number}
          totalPages={ledger.totalPages}
          total={ledger.totalElements}
          size={LIST_PAGE_SIZE}
          label="reports"
        />
      </div>
    </>
  );
}
