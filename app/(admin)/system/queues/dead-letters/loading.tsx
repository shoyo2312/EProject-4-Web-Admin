import { BackLinkSkeleton } from "@/components/layout/back-link";
import { PageHeaderSkeleton } from "@/components/layout/page-header";
import { Card, CardHeaderSkeleton } from "@/components/ui/card";
import {
  Block,
  Bone,
  FieldsSkeleton,
  Lines,
  Skeleton,
  TableSkeleton,
  pick,
} from "@/components/ui/skeleton";

const RECORDS = 5;

/** A record's cell: a line of 13px text and the 12px line under it. */
function twoLines(first: string, second: string) {
  return (
    <>
      <Bone className={first} />
      <p className="text-[12px]">
        <Bone className={second} />
      </p>
    </>
  );
}

export default function Loading() {
  return (
    <Skeleton>
      <BackLinkSkeleton width="w-20" />
      <PageHeaderSkeleton
        title="video.video-events"
        subtitle="Records a consumer of this topic gave up on, and the replay that sends them back to it."
      />

      <div className="space-y-4">
        <Card>
          <CardHeaderSkeleton title="w-56" />
          <FieldsSkeleton count={4} className="px-5 py-4" />
          <div className="space-y-2 border-t border-line px-5 py-4 text-[13px]">
            <p>
              <Bone className="w-96" />
            </p>
            <div className="flex items-center gap-2">
              <Block className="h-[34px] w-32 rounded-md" />
              <Block className="h-[34px] w-16 rounded-md" />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeaderSkeleton title="w-28" />
          <TableSkeleton
            rows={RECORDS}
            className="xl:min-w-[980px]"
            columns={[
              {
                className: "px-5 py-3 align-top",
                width: "w-[14%]",
                head: <Bone className="w-12" />,
                cell: () => twoLines("w-16", "w-20"),
              },
              {
                className: "px-3 py-3 align-top",
                width: "w-[18%]",
                head: <Bone className="w-14" />,
                cell: (row) => twoLines(pick(row, "w-32", "w-28"), "w-36"),
              },
              {
                className: "px-3 py-3 align-top",
                width: "w-[20%]",
                head: <Bone className="w-10" />,
                cell: (row) => twoLines(pick(row, "w-36", "w-40"), "w-28"),
              },
              {
                className: "px-3 py-3 align-top text-[12px]",
                width: "w-[28%]",
                head: <Bone className="w-8" />,
                cell: () => <Lines widths={["w-72", "w-48"]} />,
              },
              {
                className: "px-3 py-3 align-top",
                width: "w-[10%]",
                head: <Bone className="w-10" />,
                cell: () => <Bone className="w-14" />,
              },
              {
                className: "px-5 py-3 text-right align-top",
                head: <Bone className="w-12" />,
                cell: () => <Block className="ml-auto h-8 w-20 rounded-md" />,
              },
            ]}
          />
        </Card>
      </div>
    </Skeleton>
  );
}
