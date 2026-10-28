import { KpiCardsSkeleton } from "@/components/dashboard/kpi-cards";
import { PageHeaderSkeleton } from "@/components/layout/page-header";
import { ReportsTableSkeleton } from "@/components/moderation/reports-table-skeleton";
import { Card, CardHeaderSkeleton } from "@/components/ui/card";
import {
  Block,
  Bone,
  CheckSkeleton,
  PagerSkeleton,
  Skeleton,
  TableSkeleton,
  pick,
} from "@/components/ui/skeleton";
import { LIST_PAGE_SIZE } from "@/lib/api/shared";

/* Enough of the queue to fill the screen; how long it really is depends on the day. */
const QUEUE_ROWS = 10;

export default function Loading() {
  return (
    <Skeleton>
      <PageHeaderSkeleton
        title="Reports Queue"
        subtitle="Reported videos, accounts and comments, heaviest first. One row is one target and one decision — resolving it closes every report standing against it."
        filters
        csv
      />
      <div className="space-y-4">
        <KpiCardsSkeleton />
        <Card>
          <CardHeaderSkeleton title="w-12" />
          <TableSkeleton
            rows={QUEUE_ROWS}
            className="xl:min-w-[880px]"
            columns={[
              { className: "w-8 p-0", head: <CheckSkeleton />, cell: () => <CheckSkeleton /> },
              {
                className: "px-3 py-3",
                width: "w-[34%]",
                head: <Bone className="w-10" />,
                cell: () => (
                  <span className="inline-flex items-center gap-2 align-middle">
                    <Block className="h-[21px] w-[62px] rounded-md" />
                    <Bone className="w-12" />
                  </span>
                ),
              },
              {
                className: "px-3 py-3",
                width: "w-[7%]",
                head: <Bone className="w-12" />,
                cell: () => <Bone className="w-14" />,
              },
              {
                className: "px-3 py-3",
                width: "w-[9%]",
                head: <Bone className="w-12" />,
                cell: () => <Block className="h-7 w-[58px] rounded-md" />,
              },
              {
                className: "hidden px-3 py-3 xl:table-cell",
                width: "w-[27%]",
                head: <Bone className="w-20" />,
                cell: (row) => <Bone className={pick(row, "w-40", "w-52", "w-32", "w-44")} />,
              },
              {
                className: "px-3 py-3",
                width: "w-[7%]",
                head: <Bone className="w-12" />,
                cell: () => <Bone className="w-12" />,
              },
              {
                className: "px-5 py-3 text-right",
                head: <Bone className="w-12" />,
                cell: () => <Block className="ml-auto h-8 w-20 rounded-md" />,
              },
            ]}
          />
        </Card>
        <ReportsTableSkeleton rows={LIST_PAGE_SIZE} filters />
        <PagerSkeleton />
      </div>
    </Skeleton>
  );
}
