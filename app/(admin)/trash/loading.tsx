import { PageHeaderSkeleton } from "@/components/layout/page-header";
import { Card, CardHeaderSkeleton } from "@/components/ui/card";
import { Block, Bone, PagerSkeleton, Skeleton, TableSkeleton, pick } from "@/components/ui/skeleton";

/* The trash is usually near empty, so a few rows rather than a full page. */
const ROWS = 3;

export default function Loading() {
  return (
    <Skeleton>
      <PageHeaderSkeleton
        title="Trash"
        subtitle="Videos their owners deleted. Each stays watchable here for 30 days, then its media is erased for good — or delete it now."
      />
      <div className="space-y-4">
        <Card>
          <CardHeaderSkeleton
            title="w-40"
            actions={<Block className="h-9 w-[200px] rounded-lg lg:w-[260px]" />}
          />
          <TableSkeleton
            rows={ROWS}
            columns={[
              {
                className: "px-5 py-3",
                width: "w-[18%]",
                head: <Bone className="w-8" />,
                cell: (row) => <Bone className={pick(row, "w-48", "w-40", "w-52")} />,
              },
              {
                className: "hidden px-3 py-3 md:table-cell",
                width: "w-[17%]",
                head: <Bone className="w-10" />,
                cell: () => <Bone className="w-24" />,
              },
              {
                className: "hidden px-3 py-3 md:table-cell",
                width: "w-[20%]",
                head: <Bone className="w-12" />,
                cell: () => <Bone className="w-20" />,
              },
              {
                className: "px-3 py-3",
                width: "w-[21%]",
                head: <Bone className="w-14" />,
                cell: () => <Bone className="w-16" />,
              },
              {
                className: "px-5 py-3 text-right",
                head: <Bone className="w-12" />,
                cell: () => <Block className="ml-auto h-8 w-[92px] rounded-md" />,
              },
            ]}
          />
        </Card>
        <PagerSkeleton />
      </div>
    </Skeleton>
  );
}
