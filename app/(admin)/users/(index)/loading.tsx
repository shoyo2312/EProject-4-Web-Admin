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

/* In a route group so it stands in for /users alone: one level up it would also wrap /users/[id],
   and an account would open on the directory's skeleton. */
export default function Loading() {
  return (
    <Skeleton>
      <PageHeaderSkeleton
        title="Users"
        subtitle="Every account on the platform. Banning writes a moderation action and revokes live sessions."
        filters
        csv
      />
      <div className="space-y-4">
        <KpiCardsSkeleton />
        <Card>
          <CardHeaderSkeleton
            title="w-24"
            actions={
              <>
                <Block className="h-9 w-[200px] rounded-lg lg:w-[260px]" />
                <Block className="h-9 w-[332px] max-w-full rounded-lg" />
              </>
            }
          />
          <TableSkeleton
            rows={LIST_PAGE_SIZE}
            className="xl:min-w-[840px]"
            columns={[
              { className: "w-8 p-0", head: <CheckSkeleton />, cell: () => <CheckSkeleton /> },
              {
                className: "px-3 py-3",
                width: "w-[19%]",
                head: <Bone className="w-16" />,
                cell: (row) => <Bone className={pick(row, "w-28", "w-20", "w-24", "w-32")} />,
              },
              {
                className: "hidden px-3 py-3 xl:table-cell",
                width: "w-[29%]",
                head: <Bone className="w-10" />,
                cell: (row) => <Bone className={pick(row, "w-40", "w-36", "w-44", "w-32")} />,
              },
              {
                className: "px-3 py-3",
                width: "w-[10%]",
                head: <Bone className="w-8" />,
                cell: () => <Block className="h-5 w-[45px] rounded" />,
              },
              {
                className: "px-3 py-3",
                width: "w-[12%]",
                head: <Bone className="w-12" />,
                cell: () => <Block className="h-[26px] w-[67px] rounded-full" />,
              },
              {
                className: "hidden px-3 py-3 xl:table-cell",
                width: "w-[13%]",
                head: <Bone className="w-12" />,
                cell: () => <Bone className="w-14" />,
              },
              {
                className: "px-5 py-3 text-right",
                head: <Bone className="w-12" />,
                cell: () => <Block className="ml-auto h-8 w-16 rounded-md" />,
              },
            ]}
          />
        </Card>
        <PagerSkeleton />
      </div>
    </Skeleton>
  );
}
