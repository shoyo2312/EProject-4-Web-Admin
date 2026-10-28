import { PageHeaderSkeleton } from "@/components/layout/page-header";
import { Card, CardHeaderSkeleton } from "@/components/ui/card";
import {
  Block,
  Bone,
  FieldsSkeleton,
  Skeleton,
  TableSkeleton,
  pick,
  type SkeletonColumn,
} from "@/components/ui/skeleton";

/** A system table's columns: text in each, the first and last padded to the card's edge. */
function columns(widths: string[], last: SkeletonColumn["cell"]): SkeletonColumn[] {
  return [
    ...widths.map((width, i) => ({
      className: i === 0 ? "px-5 py-3" : "px-3 py-3",
      width,
      head: <Bone className={pick(i, "w-12", "w-14", "w-20", "w-16")} />,
      cell: (row: number) => <Bone className={pick(row + i, "w-24", "w-16", "w-28", "w-12")} />,
    })),
    { className: "px-5 py-3", head: <Bone className="w-16" />, cell: last },
  ];
}

/* In a route group so it stands in for /system/queues alone, not for the dead letters under it. */
export default function Loading() {
  return (
    <Skeleton>
      <PageHeaderSkeleton
        title="Queues & DLQ"
        subtitle="Background work across the services: what is waiting, stuck or given up on."
      />
      <div className="space-y-4">
        <Card>
          <CardHeaderSkeleton title="w-36" actions={<Pill width="w-48" />} />
          {/* Healthy is empty: dead letters only pile up behind a bug. */}
          <TableSkeleton
            rows={0}
            className="xl:min-w-[640px]"
            columns={columns(["w-[20%]", "w-[20%]", "w-[29%]"], () => <Bone className="w-16" />)}
          />
        </Card>
        <Card>
          <CardHeaderSkeleton title="w-20" actions={<Pill width="w-36" />} />
          <TableSkeleton
            rows={10}
            className="xl:min-w-[640px]"
            columns={columns(["w-[24%]", "w-[22%]", "w-[14%]", "w-[21%]"], () => (
              <Block className="h-[21px] w-[61px] rounded-full" />
            ))}
          />
        </Card>
        <Card>
          <CardHeaderSkeleton
            title="w-36"
            actions={<Block className="h-[23px] w-[105px] rounded-md" />}
          />
          <FieldsSkeleton count={4} className="border-b border-line px-5 py-4" />
          <TableSkeleton
            rows={0}
            className="xl:min-w-[760px]"
            columns={columns(["w-[22%]", "w-[20%]", "w-[19%]", "w-[21%]"], () => <Bone className="w-16" />)}
          />
        </Card>
      </div>
    </Skeleton>
  );
}

/** The status pill a system card's header carries. */
function Pill({ width }: { width: string }) {
  return <Block className={`h-[21px] rounded-full ${width}`} />;
}
