import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { ReportQueueTable } from "@/components/moderation/report-queue-table";
import { ReportsTable } from "@/components/moderation/reports-table";
import { Card } from "@/components/ui/card";
import { Pager } from "@/components/ui/pager";
import { LIST_PAGE_SIZE, getStatsSummary, listReportQueue, listReports } from "@/lib/api/admin";
import { REPORT_SORT_FIELDS, type ReportSortField } from "@/lib/moderation";
import { parsePage } from "@/lib/api/window";
import { formatNumber } from "@/lib/format";
import type {
  ReportStatus,
  ReportTargetType,
  StatsSummaryResponse,
} from "@/lib/api/types";

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

const SUMMARY: {
  label: string;
  key: keyof StatsSummaryResponse;
  accent: string;
}[] = [
  { label: "Pending", key: "pendingReports", accent: "text-pending" },
  { label: "Resolved", key: "resolvedReports", accent: "text-success" },
  { label: "Dismissed", key: "dismissedReports", accent: "text-neutral" },
  { label: "Actions (24h)", key: "actionsLast24h", accent: "text-ink" },
];

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
  }>;
}) {
  const params = await searchParams;
  const pageIndex = parsePage(params.page);
  const status = parseStatus(params.status);
  const targetType = parseTargetType(params.target);
  const sort = parseSort(params.sort);
  const ascending = params.dir === "asc";

  let stats;
  let queue;
  let ledger;
  try {
    [stats, queue, ledger] = await Promise.all([
      getStatsSummary(),
      listReportQueue(),
      listReports({ status, targetType, sort, ascending, page: pageIndex }),
    ]);
  } catch (error) {
    return (
      <>
        <PageHeader title="Reports Queue" />
        <ErrorState error={error} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Reports Queue"
        subtitle="Reported videos, accounts and comments, heaviest first. One row is one target and one decision — resolving it closes every report standing against it."
        csv={{ name: "report-queue", rows: queue.content }}
      />

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {SUMMARY.map((item) => (
            <Card key={item.label} className="px-5 py-4">
              <p className="label-caps text-ink-soft">{item.label}</p>
              <p className={`figure mt-2 text-[24px] font-bold ${item.accent}`}>
                {formatNumber(stats[item.key])}
              </p>
            </Card>
          ))}
        </div>

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
