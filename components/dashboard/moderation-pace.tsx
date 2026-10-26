import { Card, CardHeader } from "@/components/ui/card";
import { formatNumber, formatSpan } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ModerationPace({
  decisions24h,
  filed,
  closed,
  periodLabel,
  medianMs,
  decided,
  sample,
}: {
  decisions24h: number;
  filed: number;
  closed: number;
  periodLabel: string;
  medianMs: number | null;
  /** Reports the median is taken over: the decided ones among `sample`. */
  decided: number;
  sample: number;
}) {
  const growth = filed - closed;
  const closedShare = filed > 0 ? Math.min(closed / filed, 1) : 0;
  return (
    <Card>
      <CardHeader
        title="Moderation pace"
        hint="Whether reports are being worked faster than they arrive. Filed and closed cover the selected period; the median is over the newest reports filed up to the picked day that have been decided."
      />
      <dl className="grid gap-5 px-5 py-4">
        <Stat label="Decisions, last 24 hours" value={formatNumber(decisions24h)} />
        <div>
          <Stat
            label="Reports filed vs closed"
            value={`${formatNumber(filed)} / ${formatNumber(closed)}`}
            note={`${periodLabel} · ${growth > 0 ? `backlog grew by ${formatNumber(growth)}` : "backlog not growing"}`}
            bad={growth > 0}
          />
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted">
            <span
              className={cn("block h-full rounded-full", growth > 0 ? "bg-pending" : "bg-success")}
              style={{ width: `${Math.max(closedShare * 100, filed > 0 ? 2 : 0)}%` }}
            />
          </div>
        </div>
        <Stat
          label="Median time to decision"
          value={medianMs === null ? "—" : formatSpan(medianMs)}
          note={
            decided === 0
              ? "No decided report yet"
              : `${formatNumber(decided)} decided of the ${formatNumber(sample)} newest reports`
          }
        />
      </dl>
    </Card>
  );
}

function Stat({
  label,
  value,
  note,
  bad,
}: {
  label: string;
  value: string;
  note?: string;
  bad?: boolean;
}) {
  return (
    <div>
      <dt className="text-[12px] text-ink-faint">{label}</dt>
      <dd className="mt-1">
        <span className="figure block text-[22px] leading-none font-semibold tracking-tight">{value}</span>
        {note ? (
          <span className={cn("mt-1.5 block text-[12px]", bad ? "text-pending" : "text-ink-faint")}>{note}</span>
        ) : null}
      </dd>
    </div>
  );
}
