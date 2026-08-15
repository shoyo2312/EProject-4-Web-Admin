import { CalendarDays, ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { Card, CardHeader, CardMenuButton } from "@/components/ui/card";
import type { DailyRevenueResponse } from "@/lib/api/types";
import { formatCurrency, formatDate } from "@/lib/format";

export function RevenueBreakdown({ days }: { days: DailyRevenueResponse[] }) {
  const total = days.reduce((sum, d) => sum + Number(d.revenue), 0);
  const peakRevenue = Math.max(...days.map((d) => Number(d.revenue)), 1);
  const peakOrders = Math.max(...days.map((d) => d.ordersCreated), 1);

  return (
    <Card className="flex min-w-0 flex-col">
      <CardHeader
        title="Revenue Breakdown"
        hint="GET /api/v1/analytics/revenue/daily — paid orders only"
        actions={<CardMenuButton />}
      />

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[12px] text-ink-soft">Revenue by day</p>
            <p className="figure mt-1 text-[22px] font-bold">
              {formatCurrency(total)}
            </p>
          </div>
          <button
            type="button"
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[11px] text-ink-soft transition-colors hover:bg-surface-muted"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Last {days.length}d
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        <button
          type="button"
          className="mt-4 flex w-full items-center gap-2.5 rounded-lg border border-line bg-surface-muted px-3 py-2.5 text-left transition-colors hover:bg-canvas"
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-ink-soft" />
          <span className="flex-1 text-[11px] text-ink-soft">
            Get AI insight for better analysis
          </span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
        </button>

        {/* Paired bars: light = orders created, dark = revenue collected.
            The gap between them is the conversion gap, visible at a glance. */}
        <div className="mt-6 flex flex-1 items-end gap-[5px] border-b border-dashed border-line pb-px">
          {days.map((day) => (
            <div
              key={day.day}
              title={`${formatDate(day.day)} · ${formatCurrency(day.revenue)} · ${day.ordersCreated} orders`}
              className="group relative flex h-[220px] min-w-0 flex-1 items-end justify-center"
            >
              <span
                className="absolute bottom-0 w-[3px] rounded-t-[1px] bg-[var(--cell-mid)]"
                style={{
                  height: `${(day.ordersCreated / peakOrders) * 100}%`,
                  transform: "translateX(3px)",
                }}
              />
              <span
                className="absolute bottom-0 w-[3px] rounded-t-[1px] bg-ink transition-opacity group-hover:opacity-70"
                style={{
                  height: `${(Number(day.revenue) / peakRevenue) * 92}%`,
                  transform: "translateX(-3px)",
                }}
              />
            </div>
          ))}
        </div>

        <div className="mt-2 flex items-center justify-between text-[10px] text-ink-faint">
          <span>{formatDate(days[0].day)}</span>
          <span>{formatDate(days[days.length - 1].day)}</span>
        </div>
      </div>
    </Card>
  );
}
