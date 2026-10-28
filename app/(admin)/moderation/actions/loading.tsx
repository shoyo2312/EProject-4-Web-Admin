import { KpiCardsSkeleton } from "@/components/dashboard/kpi-cards";
import { PageHeaderSkeleton } from "@/components/layout/page-header";
import { Card, CardHeaderSkeleton } from "@/components/ui/card";
import {
  Block,
  Bone,
  PagerSkeleton,
  Skeleton,
  TableSkeleton,
  pick,
} from "@/components/ui/skeleton";
import { LIST_PAGE_SIZE } from "@/lib/api/shared";
import { cn } from "@/lib/utils";

/* A sortable heading is a button in the table's 13px text, a pixel taller than a plain label. */
const sortable = (width: string) => (
  <span className="text-[13px]">
    <Bone className={width} />
  </span>
);

export default function Loading() {
  return (
    <Skeleton>
      <PageHeaderSkeleton
        title="Moderation Audit Log"
        subtitle="Every action taken by an admin, in order. Append-only."
        filters
        csv
      />
      <div className="mb-4">
        <KpiCardsSkeleton />
      </div>
      <Card>
        <CardHeaderSkeleton
          title="w-28"
          actions={
            <>
              <Block className="h-9 w-[200px] rounded-lg lg:w-[260px]" />
              <Block className="h-8 w-[190px] rounded-lg" />
              <Block className="h-9 w-[226px] max-w-full rounded-lg" />
            </>
          }
        />
        <TableSkeleton
          rows={LIST_PAGE_SIZE}
          className="xl:min-w-[840px]"
          columns={[
            {
              className: "hidden px-5 py-3 xl:table-cell",
              width: "w-[8%]",
              head: <Bone className="w-10" />,
              cell: () => <Bone className="w-14" />,
            },
            {
              className: "px-5 py-3 xl:px-3",
              width: "w-[14%]",
              head: sortable("w-12"),
              // The badge is an inline span: its padding overhangs the line rather than growing the row.
              cell: (row) => <Block className={cn("-my-px h-[22px] rounded", pick(row, "w-[120px]", "w-24", "w-28"))} />,
            },
            {
              className: "px-3 py-3",
              width: "w-[28%]",
              head: sortable("w-12"),
              cell: () => (
                <span className="inline-flex items-center gap-2 align-middle">
                  <Block className="h-[21px] w-[62px] rounded-md" />
                  <Bone className="w-12" />
                </span>
              ),
            },
            {
              className: "hidden px-3 py-3 xl:table-cell",
              width: "w-[23%]",
              head: <Bone className="w-12" />,
              cell: (row) => <Bone className={pick(row, "w-40", "w-48", "w-32", "w-44")} />,
            },
            {
              className: "hidden px-3 py-3 xl:table-cell",
              width: "w-[9%]",
              head: <Bone className="w-12" />,
              cell: () => <Bone className="w-14" />,
            },
            {
              className: "px-3 py-3",
              width: "w-[10%]",
              head: <Bone className="w-10" />,
              cell: () => <Bone className="w-14" />,
            },
            {
              className: "px-5 py-3 text-right",
              head: sortable("w-10"),
              cell: () => <Bone className="w-12" />,
            },
          ]}
        />
      </Card>
      <PagerSkeleton />
    </Skeleton>
  );
}
