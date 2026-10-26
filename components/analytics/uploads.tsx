import { BarTrend } from "@/components/charts/bar-trend";
import { Card, CardHeader } from "@/components/ui/card";
import type { DailyVideoStatsResponse } from "@/lib/api/types";
import { formatNumber, plural } from "@/lib/format";

/**
 * Uploads over the chart's range, with what has become of them. The two counts beside the total
 * are cohort counts — of these uploads, how many are awaiting a reviewer or cannot play right
 * now — so a backlog shows up here as soon as it starts, not when someone opens the queue.
 */
export function Uploads({
  days,
  bars,
  unit = "d",
}: {
  /** One row per calendar day in the chart's range, zero-filled. */
  days: DailyVideoStatsResponse[];
  /** The same days, summed into the chart's buckets. */
  bars: { day: string; value: number }[];
  unit?: string;
}) {
  const sum = (pick: (d: DailyVideoStatsResponse) => number) =>
    days.reduce((total, d) => total + pick(d), 0);
  const uploads = sum((d) => d.uploads);
  const awaitingReview = sum((d) => d.pendingReview);
  const notPlayable = sum((d) => d.notPlayable);

  return (
    <Card className="flex min-w-0 flex-col">
      <CardHeader
        title="Uploads"
        hint="Videos uploaded in each bar's day, week or month. The counts beside the total are how many of those uploads are awaiting review, or cannot play, right now."
      />

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-[13px] text-ink-soft">
              Uploaded, last {bars.length}
              {unit}
            </p>
            <p className="figure mt-1 text-[22px] font-bold">{formatNumber(uploads)}</p>
          </div>
          <dl className="grid grid-cols-2 gap-x-5 text-right">
            <div>
              <dt className="text-[13px] text-ink-soft">Awaiting review</dt>
              <dd className="figure mt-1 text-[22px] font-bold">{formatNumber(awaitingReview)}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-ink-soft">Can&apos;t play</dt>
              <dd className="figure mt-1 text-[22px] font-bold">{formatNumber(notPlayable)}</dd>
            </div>
          </dl>
        </div>

        <BarTrend
          bars={bars}
          describe={(value) => `${formatNumber(value)} ${plural(value, "upload")}`}
          className="mt-6 h-[160px]"
        />
      </div>
    </Card>
  );
}
