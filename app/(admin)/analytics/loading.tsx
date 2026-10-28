import { BarTrendSkeleton } from "@/components/charts/bar-trend";
import { EngagementTrendSkeleton } from "@/components/dashboard/engagement-trend";
import { KpiCardsSkeleton } from "@/components/dashboard/kpi-cards";
import { PageHeaderSkeleton } from "@/components/layout/page-header";
import { Card, CardHeaderSkeleton } from "@/components/ui/card";
import { Block, Bone, Skeleton, TableSkeleton, pick } from "@/components/ui/skeleton";

/* `getTopVideos` reads twenty. */
const TOP_VIDEOS = 20;

export default function Loading() {
  return (
    <Skeleton>
      <PageHeaderSkeleton
        title="Analytics"
        subtitle="Figures cover the 30 days up to 28/10/2026, compared with the 30 before. Each chart is labelled with its own range."
        filters
        csv
      />
      <div className="space-y-4">
        <KpiCardsSkeleton />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
          <EngagementTrendSkeleton />
          <Card className="flex min-w-0 flex-col">
            <CardHeaderSkeleton
              title="w-28"
              actions={
                <span className="text-[12px]">
                  <Bone className="w-20" />
                </span>
              }
            />
            <div className="flex flex-1 flex-col gap-4 p-5">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="label">
                      <Bone className={pick(i, "w-10", "w-16", "w-14", "w-12")} />
                    </span>
                    <span className="text-[14px]">
                      <Bone className="w-10" />
                    </span>
                  </div>
                  <Block className="mt-1.5 h-1.5 rounded-full" />
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="flex min-w-0 flex-col">
          <CardHeaderSkeleton title="w-32" />
          <div className="flex flex-1 flex-col p-5">
            <div className="flex items-start justify-between gap-6">
              <Figure label="w-36" value="w-12" />
              <Figure label="w-32" value="w-10" right />
            </div>
            <BarTrendSkeleton className="mt-6" />
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card className="flex min-w-0 flex-col">
            <CardHeaderSkeleton title="w-32" />
            <div className="flex flex-1 flex-col p-5">
              <div className="flex items-start justify-between gap-6">
                <Figure label="w-40" value="w-12" />
                <div className="text-right">
                  <Figure label="w-24" value="w-10" right />
                  <p className="text-[11px]">
                    <Bone className="w-16" />
                  </p>
                </div>
              </div>
              <BarTrendSkeleton className="mt-6 h-[160px]" />
            </div>
          </Card>
          <Card className="flex min-w-0 flex-col">
            <CardHeaderSkeleton title="w-16" />
            <div className="flex flex-1 flex-col p-5">
              <div className="flex items-start justify-between gap-6">
                <Figure label="w-32" value="w-10" />
                <div className="grid grid-cols-2 gap-x-5">
                  <Figure label="w-28" value="w-8" right />
                  <Figure label="w-20" value="w-8" right />
                </div>
              </div>
              <BarTrendSkeleton className="mt-6 h-[160px]" />
            </div>
          </Card>
        </div>

        <Card className="min-w-0">
          <CardHeaderSkeleton title="w-28" />
          <TableSkeleton
            rows={TOP_VIDEOS}
            columns={[
              {
                className: "px-5 py-2.5",
                width: "w-[7%]",
                head: <Bone className="w-3" />,
                cell: () => <Bone className="w-4" />,
              },
              {
                className: "px-3 py-2.5",
                width: "w-[54%]",
                head: <Bone className="w-10" />,
                cell: (row) => (
                  <span className="flex items-center gap-3">
                    <Block className="h-10 w-7 rounded" />
                    <span className="min-w-0">
                      <span className="block font-medium">
                        <Bone className={pick(row, "w-64", "w-52", "w-72", "w-56")} />
                      </span>
                      <span className="block text-[12px]">
                        <Bone className={pick(row, "w-24", "w-20", "w-28")} />
                      </span>
                    </span>
                  </span>
                ),
              },
              ...["w-[11%]", "w-[8%]", "w-[9%]"].map((width) => ({
                className: "px-3 py-2.5 text-right",
                width,
                head: <Bone className="w-12" />,
                cell: () => <Bone className="w-10" />,
              })),
              {
                className: "px-5 py-2.5 text-right",
                head: <Bone className="w-12" />,
                cell: () => <Bone className="w-10" />,
              },
            ]}
          />
        </Card>
      </div>
    </Skeleton>
  );
}

/** A figure with its label above it, as the growth cards head their charts. */
function Figure({ label, value, right }: { label: string; value: string; right?: boolean }) {
  return (
    <div className={right ? "text-right" : undefined}>
      <p className="text-[13px]">
        <Bone className={label} />
      </p>
      <p className="mt-1 text-[22px] font-bold">
        <Bone className={value} />
      </p>
    </div>
  );
}
