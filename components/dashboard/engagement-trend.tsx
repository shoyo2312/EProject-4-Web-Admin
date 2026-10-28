import { LineChart } from "@/components/charts/line-chart";
import { Card, CardHeader, CardHeaderSkeleton } from "@/components/ui/card";
import { Block, Bone } from "@/components/ui/skeleton";
import type { MosaicRange, MosaicSeries } from "@/lib/api/rollup";
import { formatNumber } from "@/lib/format";

const BUCKET_LABEL: Record<MosaicRange, string> = {
  daily: "day",
  weekly: "week",
  monthly: "month",
};

/**
 * The range comes from the page header rather than a control of its own: two
 * period pickers on one screen can disagree, and then neither is trustworthy.
 */
export function EngagementTrend({
  series,
  range,
}: {
  series: MosaicSeries;
  range: MosaicRange;
}) {
  const buckets = series[range];
  const total = buckets.reduce((sum, b) => sum + b.primary + b.secondary, 0);

  return (
    <Card className="min-w-0">
      <CardHeader
        title="Engagement Trend"
        hint="Likes (net of unlikes), and comments and shares together, per bar."
      />
      <div className="p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="flex items-baseline gap-2">
            <span className="label text-ink-soft">Total events</span>
            <span className="figure text-[22px] font-bold">
              {formatNumber(total)}
            </span>
          </p>
          <p className="text-[12px] text-ink-faint">
            {buckets.length} {BUCKET_LABEL[range]}
            {buckets.length === 1 ? "" : "s"}
          </p>
        </div>

        <LineChart
          buckets={buckets}
          primaryLabel="Likes"
          secondaryLabel="Comments & Shares"
        />
      </div>
    </Card>
  );
}

/** The card while its series loads: the total, the legend, and the chart's axes and gridlines. */
export function EngagementTrendSkeleton() {
  return (
    <Card className="min-w-0">
      <CardHeaderSkeleton title="w-32" />
      <div className="p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="flex items-baseline gap-2">
            <span className="label">
              <Bone className="w-20" />
            </span>
            <span className="text-[22px] font-bold">
              <Bone className="w-14" />
            </span>
          </p>
          <p className="text-[12px]">
            <Bone className="w-16" />
          </p>
        </div>
        <p className="mb-4 flex items-center gap-4 text-[12px]">
          <span>
            <Bone className="w-12" />
          </span>
          <span>
            <Bone className="w-28" />
          </span>
        </p>
        {/* `LineChart`'s 300px: a 40px value axis, gridlines, and the date axis under them. */}
        <div className="flex h-[300px] gap-2 pt-2">
          <div className="flex w-8 flex-col justify-between pb-8">
            {Array.from({ length: 5 }, (_, i) => (
              <Block key={i} className="ml-auto h-2 w-5 rounded-full" />
            ))}
          </div>
          <div className="flex flex-1 flex-col">
            <div className="flex flex-1 flex-col justify-between border-b border-line pt-1">
              {Array.from({ length: 4 }, (_, i) => (
                <Block key={i} className="h-px" />
              ))}
            </div>
            <div className="flex justify-between pt-3">
              {Array.from({ length: 6 }, (_, i) => (
                <Block key={i} className="h-2 w-10 rounded-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
