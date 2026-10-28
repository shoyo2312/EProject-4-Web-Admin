"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type DotItemDotProps,
  type TooltipContentProps,
} from "recharts";
import type { MosaicBucket } from "@/lib/api/rollup";
import { drawnAtMs } from "@/lib/entrance";
import { formatCompact, formatNumber } from "@/lib/format";

const TICK = { fontSize: 11, fill: "var(--ink-faint)" };

/**
 * A bucket's point, appearing as the line being drawn across reaches it. Recharts draws the points
 * in a layer of their own, outside the series the line's `wipe` uncovers, so without this they would
 * all stand on the empty chart ahead of the line.
 */
function point(props: DotItemDotProps, fill: string) {
  if (props.cx == null || props.cy == null) return null;
  const across = props.index / Math.max(props.points.length - 1, 1);
  return (
    <circle
      key={props.index}
      cx={props.cx}
      cy={props.cy}
      r={2.5}
      fill={fill}
      className="origin-center animate-dot [transform-box:fill-box]"
      style={{ animationDelay: `calc(var(--entrance-delay, 0ms) + ${drawnAtMs(across)}ms)` }}
    />
  );
}

export function LineChart({
  buckets,
  primaryLabel,
  secondaryLabel,
}: {
  buckets: MosaicBucket[];
  primaryLabel: string;
  secondaryLabel: string;
}) {
  const series = [
    { key: "primary", label: primaryLabel, color: "var(--chart-1)", dot: "bg-[var(--chart-1)]" },
    { key: "secondary", label: secondaryLabel, color: "var(--chart-2)", dot: "bg-[var(--chart-2)]" },
  ] as const;

  const renderTooltip = ({ active, payload }: TooltipContentProps) => {
    const bucket = payload?.[0]?.payload as MosaicBucket | undefined;
    if (!active || !bucket) return null;
    return (
      <div className="w-[200px] rounded-xl border border-line bg-surface p-3 shadow-pop">
        <p className="text-[13px] font-semibold">{bucket.label}</p>
        <dl className="mt-2 space-y-1.5 text-[12px]">
          {series.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-ink-soft">
                <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                {s.label}
              </dt>
              <dd className="figure font-semibold">{formatNumber(bucket[s.key])}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-4 text-[12px] text-ink-soft">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${s.dot}`} />
            {s.label}
          </span>
        ))}
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={buckets} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis
              dataKey="label"
              tick={TICK}
              tickLine={false}
              axisLine={{ stroke: "var(--line)" }}
              tickMargin={10}
            />
            {/* Counts: a tick at 0.75 of a like is a scale nothing can land on. */}
            <YAxis
              tick={TICK}
              tickLine={false}
              axisLine={false}
              width={40}
              allowDecimals={false}
              tickFormatter={(v: number) => formatCompact(v)}
            />
            <Tooltip
              content={renderTooltip}
              cursor={{ stroke: "var(--line-strong)", strokeDasharray: "3 3" }}
            />
            {series.map((s) => (
              // Straight segments with a dot per bucket: a smoothed curve through monthly totals
              // draws a slope of activity across weeks where there was none. Drawn in left to right
              // by globals.css's `wipe` rather than recharts' own animation, which would play on
              // every mount, on a page already seen and off screen alike.
              <Area
                key={s.key}
                className="animate-wipe"
                type="linear"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                fill={`url(#fill-${s.key})`}
                dot={(props: DotItemDotProps) => point(props, s.color)}
                activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
