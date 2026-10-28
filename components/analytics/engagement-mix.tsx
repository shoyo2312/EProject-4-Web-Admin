import { Card, CardHeader } from "@/components/ui/card";
import type { EngagementMixRow } from "@/lib/api/rollup";
import { formatNumber } from "@/lib/format";

/**
 * The one place UNLIKED and PUBLISHED are shown on their own. The trend chart nets
 * unlikes off against likes, which hides the case that matters — likes flat, unlikes
 * climbing.
 */
export function EngagementMix({
  rows,
  period,
}: {
  rows: EngagementMixRow[];
  /** "Last 30d" and friends — the same days the figures above cover. */
  period: string;
}) {
  return (
    <Card className="flex min-w-0 flex-col">
      <CardHeader
        title="Engagement Mix"
        hint="Every event type over the same days as the figures above — unlikes and uploads included, which the trend leaves out."
        actions={<span className="text-[12px] text-ink-faint">{period}</span>}
      />

      <div className="flex flex-1 flex-col gap-4 p-5">
        {rows.length === 0 ? (
          <p className="text-[13px] text-ink-faint">
            No engagement events recorded yet.
          </p>
        ) : (
          rows.map((row) => (
            <div key={row.eventType}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="label text-ink-soft">{row.label}</span>
                <span className="figure text-[14px] font-semibold">
                  {formatNumber(row.total)}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                <span
                  className="origin-left animate-fill block h-full rounded-full bg-accent"
                  style={{ width: `${Math.max(row.weight * 100, 1.5)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
