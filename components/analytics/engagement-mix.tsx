import { Card, CardHeader } from "@/components/ui/card";
import type { EngagementMixRow } from "@/lib/api/rollup";
import { formatNumber } from "@/lib/format";

/**
 * The one place UNLIKED and PUBLISHED are shown on their own. The trend chart nets
 * unlikes off against likes, which hides the case that matters — likes flat, unlikes
 * climbing.
 */
export function EngagementMix({ rows }: { rows: EngagementMixRow[] }) {
  return (
    <Card className="flex min-w-0 flex-col">
      <CardHeader
        title="Engagement Mix"
        hint="GET /api/v1/analytics/engagement/daily?days=365, totalled by event type"
      />

      <div className="flex flex-1 flex-col justify-center gap-4 p-5">
        {rows.length === 0 ? (
          <p className="text-[12px] text-ink-faint">
            No engagement events recorded yet.
          </p>
        ) : (
          rows.map((row) => (
            <div key={row.eventType}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="label-caps text-ink-soft">{row.label}</span>
                <span className="figure text-[13px] font-semibold">
                  {formatNumber(row.total)}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--cell-empty)]">
                <span
                  className="block h-full rounded-full bg-ink"
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
