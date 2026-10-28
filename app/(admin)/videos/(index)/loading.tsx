import { KpiCardsSkeleton } from "@/components/dashboard/kpi-cards";
import { PageHeaderSkeleton } from "@/components/layout/page-header";
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

/* In a route group so it stands in for /videos alone, not for /videos/[id] under it. */
export default function Loading() {
  return (
    <Skeleton>
      <PageHeaderSkeleton
        title="Videos"
        subtitle="Every upload on the platform. Taking one down writes a moderation action and removes it from the feed."
        filters
        csv
      />
      <div className="space-y-4">
        <KpiCardsSkeleton />
        <Card>
          <CardHeaderSkeleton
            title="w-16"
            actions={
              <>
                <Block className="h-9 w-[200px] rounded-lg lg:w-[260px]" />
                <Block className="h-9 w-[637px] max-w-full rounded-lg" />
              </>
            }
          />
          <TableSkeleton
            rows={LIST_PAGE_SIZE}
            columns={[
              { className: "w-8 p-0", head: <CheckSkeleton />, cell: () => <CheckSkeleton /> },
              {
                className: "px-3 py-3",
                width: "w-[26%]",
                head: <Bone className="w-8" />,
                cell: (row) => (
                  <span className="flex items-center gap-3">
                    <Block className="h-10 w-7 rounded" />
                    <Bone className={pick(row, "w-52", "w-40", "w-60", "w-48")} />
                  </span>
                ),
              },
              {
                className: "hidden px-3 py-3 @4xl:table-cell",
                width: "w-[11%]",
                head: <Bone className="w-10" />,
                cell: (row) => <Bone className={pick(row, "w-24", "w-20", "w-28")} />,
              },
              {
                className: "px-3 py-3",
                width: "w-[9%]",
                head: <Bone className="w-10" />,
                cell: () => <Block className="h-[26px] w-[87px] rounded-full" />,
              },
              {
                className: "hidden px-3 py-3 @6xl:table-cell",
                width: "w-[6%]",
                head: <Bone className="w-12" />,
                cell: () => <Block className="h-5 w-14 rounded" />,
              },
              {
                className: "px-3 py-3",
                width: "w-[16%]",
                head: <Bone className="w-12" />,
                cell: (row) => <Bone className={pick(row, "w-4", "w-24", "w-4", "w-4")} />,
              },
              {
                className: "hidden px-3 py-3 text-right @4xl:table-cell",
                width: "w-[5%]",
                head: <Bone className="w-9" />,
                cell: () => <Bone className="w-6" />,
              },
              {
                className: "hidden px-3 py-3 text-right @6xl:table-cell",
                width: "w-[4%]",
                head: <Bone className="w-8" />,
                cell: () => <Bone className="w-5" />,
              },
              {
                className: "hidden px-3 py-3 @5xl:table-cell",
                width: "w-[6%]",
                head: <Bone className="w-14" />,
                cell: () => <Bone className="w-14" />,
              },
              {
                className: "px-3 py-3 pr-5 text-right",
                head: <Bone className="w-12" />,
                cell: () => (
                  <span className="inline-flex items-center gap-1.5 align-middle">
                    <Block className="h-7 w-7 rounded-md" />
                    <Block className="h-8 w-[101px] rounded-md" />
                  </span>
                ),
              },
            ]}
          />
        </Card>
        <PagerSkeleton />
      </div>
    </Skeleton>
  );
}
