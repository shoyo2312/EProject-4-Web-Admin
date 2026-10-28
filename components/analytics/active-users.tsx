import { BarTrend } from "@/components/charts/bar-trend";
import { Card, CardHeader } from "@/components/ui/card";
import { CountUp } from "@/components/ui/count-up";
import type { DailyActiveUsersResponse } from "@/lib/api/types";
import { formatDate, formatNumber, plural } from "@/lib/format";

/**
 * Distinct viewers per day over the chart's range. A bar is the average day of its week or month
 * rather than the sum: the people who watch on Monday mostly watch on Tuesday too, so adding the
 * days up would count them seven times.
 */
export function ActiveUsers({
  days,
  bars,
}: {
  /** One row per calendar day in the chart's range, zero-filled. */
  days: DailyActiveUsersResponse[];
  /** The same days, averaged into the chart's buckets. */
  bars: { day: string; value: number }[];
}) {
  const total = days.reduce((sum, d) => sum + d.activeUsers, 0);
  const average = days.length > 0 ? Math.round(total / days.length) : 0;
  const busiest = days.reduce<DailyActiveUsersResponse | null>(
    (best, d) => (best === null || d.activeUsers > best.activeUsers ? d : best),
    null,
  );

  return (
    <Card className="flex min-w-0 flex-col">
      <CardHeader
        title="Daily Active Users"
        hint="People who watched anything, counted once per day. Each bar is the average day of its week or month."
      />

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-[13px] text-ink-soft">Average day, last {days.length}d</p>
            <p className="figure mt-1 text-[22px] font-bold">
              <CountUp value={formatNumber(average)} />
            </p>
          </div>
          <div className="text-right">
            <p className="text-[13px] text-ink-soft">Busiest day</p>
            <p className="figure mt-1 text-[22px] font-bold">
              <CountUp
                value={busiest && busiest.activeUsers > 0 ? formatNumber(busiest.activeUsers) : "—"}
              />
            </p>
            {busiest && busiest.activeUsers > 0 ? (
              <p className="text-[11px] text-ink-faint">{formatDate(busiest.day)}</p>
            ) : null}
          </div>
        </div>

        <BarTrend
          bars={bars}
          describe={(value) => `${formatNumber(value)} active ${plural(value, "user")} a day`}
          className="mt-6 h-[160px]"
        />
      </div>
    </Card>
  );
}
