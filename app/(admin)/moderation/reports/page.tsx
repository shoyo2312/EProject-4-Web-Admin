import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { ReportsTable } from "@/components/moderation/reports-table";
import { Card } from "@/components/ui/card";
import { Pager } from "@/components/ui/pager";
import { LIST_PAGE_SIZE, getStatsSummary, listReports, referenceNow } from "@/lib/api/admin";
import { isoDay, parseAsOf, parsePage } from "@/lib/api/window";
import { formatNumber } from "@/lib/format";
import type { StatsSummaryResponse } from "@/lib/api/types";

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

export default async function ReportsQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ asOf?: string; page?: string }>;
}) {
  const { asOf: asOfParam, page: pageParam } = await searchParams;
  const latest = isoDay(referenceNow());
  const asOf = parseAsOf(asOfParam, latest);
  const pageIndex = parsePage(pageParam);

  let stats;
  let page;
  try {
    [stats, page] = await Promise.all([
      getStatsSummary(),
      listReports({ page: pageIndex }),
    ]);
  } catch (error) {
    return (
      <>
        <PageHeader title="Reports Queue" />
        <ErrorState error={error} />
      </>
    );
  }

  // The queue as it stood on the picked date, not the queue minus the newest rows:
  // resolution status is current either way, so this is "submitted by", not a snapshot.
  // ponytail: the cut runs over the page rather than the query — admin-service takes no date
  // parameter, so a page of newer reports comes back short instead of being skipped. The
  // summary cards above are platform-wide counts from /stats/summary and ignore both.
  const reports = page.content.filter((r) => r.createdAt.slice(0, 10) <= asOf);

  return (
    <>
      <PageHeader
        title="Reports Queue"
        subtitle="User-submitted reports across videos, accounts and comments. Open a row to see what was reported before deciding."
        filters={{ asOf, latest }}
        csv={{ name: "reports", rows: reports }}
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

        {/* The table's own search, status tabs and sort work over the rows on this page —
            they are client-side, and the page is what the server sent. */}
        <ReportsTable reports={reports} />

        <Pager
          page={page.number}
          totalPages={page.totalPages}
          total={page.totalElements}
          size={LIST_PAGE_SIZE}
          label="reports"
        />
      </div>
    </>
  );
}
