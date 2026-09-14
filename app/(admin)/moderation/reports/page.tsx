import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { ReportsTable } from "@/components/moderation/reports-table";
import { Card } from "@/components/ui/card";
import { getStatsSummary, listReports, referenceNow } from "@/lib/api/admin";
import { isoDay, parseAsOf } from "@/lib/api/window";
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
  searchParams: Promise<{ asOf?: string }>;
}) {
  const latest = isoDay(referenceNow());
  const asOf = parseAsOf((await searchParams).asOf, latest);

  let stats;
  let fetched;
  try {
    [stats, fetched] = await Promise.all([
      getStatsSummary(),
      listReports({ size: 100 }),
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
  const reports = fetched.filter((r) => r.createdAt.slice(0, 10) <= asOf);

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

        <ReportsTable reports={reports} />
      </div>
    </>
  );
}
