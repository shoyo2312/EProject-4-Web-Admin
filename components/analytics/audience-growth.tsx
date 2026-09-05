import { Card, CardHeader, CardMenuButton } from "@/components/ui/card";
import type { DailySignupResponse } from "@/lib/api/types";
import { formatDate, formatNumber } from "@/lib/format";

export function AudienceGrowth({ days }: { days: DailySignupResponse[] }) {
  const total = days.reduce((sum, d) => sum + d.signups, 0);
  const peak = Math.max(...days.map((d) => d.signups), 1);
  // A per-day figure is noisy enough that the average is the number worth reading.
  const average = days.length > 0 ? Math.round(total / days.length) : 0;

  return (
    <Card className="flex min-w-0 flex-col">
      <CardHeader
        title="Audience Growth"
        hint="GET /api/v1/analytics/signups/daily — one row per day a user registered"
        actions={<CardMenuButton />}
      />

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-[12px] text-ink-soft">
              New accounts, last {days.length}d
            </p>
            <p className="figure mt-1 text-[22px] font-bold">
              {formatNumber(total)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[12px] text-ink-soft">Per day</p>
            <p className="figure mt-1 text-[22px] font-bold">
              {formatNumber(average)}
            </p>
          </div>
        </div>

        {/* Fixed height, not flex-1: the bars size themselves as a percentage, which
            needs a definite height to resolve against. */}
        <div className="mt-6 flex h-[220px] items-end gap-[3px] border-b border-dashed border-line pb-px">
          {days.map((day) => (
            <span
              key={day.day}
              title={`${formatDate(day.day)} · ${formatNumber(day.signups)} signups`}
              className="min-w-0 flex-1 rounded-t-[1px] bg-ink transition-opacity hover:opacity-60"
              // A zero-signup day still needs a visible baseline tick, otherwise a gap
              // in the series is indistinguishable from a day that never loaded.
              style={{ height: `${Math.max((day.signups / peak) * 100, 2)}%` }}
            />
          ))}
        </div>

        {days.length > 0 ? (
          <div className="mt-2 flex items-center justify-between text-[10px] text-ink-faint">
            <span>{formatDate(days[0].day)}</span>
            <span>{formatDate(days[days.length - 1].day)}</span>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
