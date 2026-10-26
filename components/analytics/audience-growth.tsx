import { BarTrend } from "@/components/charts/bar-trend";
import { Card, CardHeader } from "@/components/ui/card";
import type { DailySignupResponse } from "@/lib/api/types";
import { formatNumber, plural } from "@/lib/format";

export function AudienceGrowth({
  days,
  unit = "d",
}: {
  days: DailySignupResponse[];
  unit?: string;
}) {
  const total = days.reduce((sum, d) => sum + d.signups, 0);
  // A per-day figure is noisy enough that the average is the number worth reading.
  const average = days.length > 0 ? Math.round(total / days.length) : 0;

  return (
    <Card className="flex min-w-0 flex-col">
      <CardHeader
        title="Audience Growth"
        hint="Accounts registered in each bar's day, week or month."
      />

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-[13px] text-ink-soft">
              New accounts, last {days.length}
              {unit}
            </p>
            <p className="figure mt-1 text-[22px] font-bold">
              {formatNumber(total)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[13px] text-ink-soft">Per bar, on average</p>
            <p className="figure mt-1 text-[22px] font-bold">
              {formatNumber(average)}
            </p>
          </div>
        </div>

        <BarTrend
          bars={days.map((day) => ({ day: day.day, value: day.signups }))}
          describe={(value) => `${formatNumber(value)} ${plural(value, "signup")}`}
          className="mt-6"
        />
      </div>
    </Card>
  );
}
