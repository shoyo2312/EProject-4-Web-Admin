import { cn } from "@/lib/utils";

/**
 * The small trend beside a KPI figure: a line over a soft fill. Deliberately unlabelled and
 * always in the accent — it carries shape, not values or judgement; the figure and the delta
 * pill beside it carry those.
 */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const width = 96;
  const height = 36;
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const step = width / (values.length - 1);
  const points = values.map((value, i) => {
    const x = i * step;
    const y = height - 3 - (value / max) * (height - 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = points.join(" ");
  const area = `0,${height} ${line} ${width},${height}`;
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${width} ${height}`}
      className={cn("h-9 w-24 shrink-0 text-accent", className)}
      preserveAspectRatio="none"
    >
      <polygon points={area} fill="currentColor" opacity="0.12" />
      <polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
