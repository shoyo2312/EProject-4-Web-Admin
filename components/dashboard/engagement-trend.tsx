import { MosaicChart } from "@/components/charts/mosaic-chart";
import { Card, CardHeader, CardMenuButton } from "@/components/ui/card";
import type { MosaicRange, MosaicSeries } from "@/lib/api/rollup";
import { formatNumber } from "@/lib/format";

const BUCKET_LABEL: Record<MosaicRange, string> = {
  daily: "day",
  weekly: "week",
  monthly: "month",
};

/**
 * The range comes from the page header rather than a control of its own: two
 * granularity pickers on one screen can disagree, and then neither is trustworthy.
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
        hint="Rolled up from GET /api/v1/analytics/engagement/daily?days=365"
        actions={<CardMenuButton />}
      />
      <div className="p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="flex items-baseline gap-2">
            <span className="label-caps text-ink-soft">Total events</span>
            <span className="figure text-[22px] font-bold">
              {formatNumber(total)}
            </span>
          </p>
          <p className="text-[11px] text-ink-faint">
            {buckets.length} {BUCKET_LABEL[range]}
            {buckets.length === 1 ? "" : "s"}
          </p>
        </div>

        <MosaicChart
          buckets={buckets}
          primaryLabel="Likes"
          secondaryLabel="Comments & Shares"
        />
      </div>
    </Card>
  );
}
