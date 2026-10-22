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
  return (
    <Card>
      <CardHeader
        title="Moderation pace"
        hint="Whether reports are being worked faster than they arrive. Filed and closed cover the selected period; the median is over the newest reports filed up to the picked day that have been decided."
      />
      <dl className="grid gap-4 px-5 py-4">
        <Stat label="Decisions, last 24h" value={formatNumber(decisions24h)} />
        <Stat
          label="Reports filed / closed"
          value={`${formatNumber(filed)} / ${formatNumber(closed)}`}
          note={`${periodLabel} · ${growth > 0 ? `backlog grew by ${formatNumber(growth)}` : "backlog not growing"}`}
          bad={growth > 0}
        />
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
      <dt className="label-caps text-[10px] text-ink-faint">{label}</dt>
      <dd className="mt-1">
        <span className="figure block text-[20px] leading-none font-bold">{value}</span>
        {note ? (
          <span className={cn("mt-1 block text-[11px]", bad ? "text-danger" : "text-ink-faint")}>
            {note}
          </span>
        ) : null}
      </dd>
    </div>
  );
}
