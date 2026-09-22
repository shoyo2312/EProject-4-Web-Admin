import { KpiCards, type KpiCard } from "@/components/dashboard/kpi-cards";
import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { ReportQueueTable } from "@/components/moderation/report-queue-table";
import { ReportsTable } from "@/components/moderation/reports-table";
import { Pager } from "@/components/ui/pager";
import {
  LIST_PAGE_SIZE,
  getDailyAdminStats,
  getStatsSummary,
  listReportQueue,
  listReports,
  referenceNow,
} from "@/lib/api/admin";
import { REPORT_SORT_FIELDS, type ReportSortField } from "@/lib/moderation";
import { historyUpTo, isoDay, parsePage, resolveWindow } from "@/lib/api/window";
import { deltaPercent, growthPercent, spark, sumLast } from "@/lib/series";
import { formatNumber } from "@/lib/format";
import type { ReportStatus, ReportTargetType } from "@/lib/api/types";

const STATUSES: ReportStatus[] = ["PENDING", "RESOLVED", "DISMISSED"];
const TARGET_TYPES: ReportTargetType[] = ["USER", "VIDEO", "COMMENT"];

/**
 * Every ledger control is parsed here and handed to the backend. A value the backend does not
 * know becomes "no filter" rather than being passed on: these arrive from the query string,
 * where anything at all can be typed, and an unknown sort property is a 500.
 */
function parseStatus(value: string | undefined): ReportStatus | undefined {
  return STATUSES.includes(value as ReportStatus) ? (value as ReportStatus) : undefined;
}

function parseTargetType(value: string | undefined): ReportTargetType | undefined {
  return TARGET_TYPES.includes(value as ReportTargetType)
    ? (value as ReportTargetType)
    : undefined;
}

function parseSort(value: string | undefined): ReportSortField {
  return REPORT_SORT_FIELDS.includes(value as ReportSortField)
    ? (value as ReportSortField)
    : "createdAt";
}

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
  const status = parseStatus(params.status);
  const targetType = parseTargetType(params.target);
  const sort = parseSort(params.sort);
  const ascending = params.dir === "asc";

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

  // Daily and uncut, so a delta compares the period against the period before it. Closures
  // are dated by when the report was closed, not when it was filed — see the API type.
  const daily = historyUpTo(adminStats, window);
  const createdCounts = daily.map((d) => d.reportsCreated);
  const resolvedCounts = daily.map((d) => d.reportsResolved);
  const dismissedCounts = daily.map((d) => d.reportsDismissed);
  const actionCounts = daily.map((d) => d.actionsTaken);

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
        csv={{ name: "report-queue", rows: queue.content }}
      />

      <div className="space-y-4">
        <KpiCards cards={cards} />

        <ReportQueueTable groups={queue.content} total={queue.totalElements} />

        {/* Passing `filter` is what makes the table's controls write to the URL and come back
            through listReports, rather than sifting the twenty-five rows already on screen. */}
        <ReportsTable
          title="All reports"
          reports={ledger.content}
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
