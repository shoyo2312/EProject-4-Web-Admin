import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * One bar per bucket, scaled to the tallest, with the first and last bucket's dates under them —
 * the chart the analytics growth cards share. `describe` words a bar's value for its tooltip.
 */
export function BarTrend({
  bars,
  describe,
  className,
}: {
  bars: { day: string; value: number }[];
  describe: (value: number) => string;
  /** The bar area's height; it needs a definite one for the percentage heights to resolve. */
  className?: string;
}) {
  const peak = Math.max(...bars.map((bar) => bar.value), 1);

  return (
    <div>
      <div
        className={cn(
          "flex h-[220px] items-end gap-[3px] border-b border-line pb-px",
          className,
        )}
      >
        {bars.map((bar) => (
          <span
            key={bar.day}
            title={`${formatDate(bar.day)} · ${describe(bar.value)}`}
            className="min-w-0 flex-1 rounded-t-sm bg-accent/80 transition-colors hover:bg-accent"
            // A zero bucket still needs a visible baseline tick, otherwise a gap in the series
            // is indistinguishable from a bucket that never loaded.
            style={{ height: `${Math.max((bar.value / peak) * 100, 2)}%` }}
          />
        ))}
      </div>

      {bars.length > 0 ? (
        <div className="mt-2 flex items-center justify-between text-[11px] text-ink-faint">
          <span>{formatDate(bars[0].day)}</span>
          <span>{formatDate(bars[bars.length - 1].day)}</span>
        </div>
      ) : null}
    </div>
  );
}
