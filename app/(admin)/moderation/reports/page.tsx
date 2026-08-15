import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { ReportsTable } from "@/components/moderation/reports-table";
import { Card } from "@/components/ui/card";
import { getStatsSummary, listReports } from "@/lib/api/admin";
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

export default async function ReportsQueuePage() {
  let stats;
  let reports;
  try {
    [stats, reports] = await Promise.all([
      getStatsSummary(),
      listReports({ size: 100 }),
    ]);
  } catch (error) {
    return (
      <>
        <PageHeader title="Reports Queue" showFilters={false} />
        <ErrorState error={error} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Reports Queue"
        subtitle="User-submitted reports across videos, accounts, comments and product listings."
      />

      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
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
