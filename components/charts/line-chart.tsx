"use client";

import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { MosaicBucket } from "@/lib/api/rollup";
import { formatCompact, formatNumber } from "@/lib/format";

const TICK = { fontSize: 10, fill: "var(--ink-faint)" };

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
    { key: "primary", label: primaryLabel, color: "var(--cell-strong)", dot: "bg-[var(--cell-strong)]" },
    { key: "secondary", label: secondaryLabel, color: "var(--cell-mid)", dot: "bg-[var(--cell-mid)]" },
  ] as const;

  const renderTooltip = ({ active, payload }: TooltipContentProps) => {
    const bucket = payload?.[0]?.payload as MosaicBucket | undefined;
    if (!active || !bucket) return null;
    return (
      <div className="w-[190px] rounded-lg border border-line bg-surface p-3">
        <p className="text-[12px] font-semibold">{bucket.label}</p>
        <dl className="mt-2 space-y-1.5 text-[11px]">
          {series.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-ink-soft">
                <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
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
      <div className="mb-3 flex items-center gap-4 text-[11px] text-ink-soft">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className={`h-0.5 w-3 rounded-full ${s.dot}`} />
            <span className="label-caps">{s.label}</span>
          </span>
        ))}
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsLineChart data={buckets} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tick={TICK}
              tickLine={false}
              axisLine={{ stroke: "var(--line)", strokeDasharray: "3 3" }}
              tickMargin={8}
            />
            <YAxis
              tick={TICK}
              tickLine={false}
              axisLine={false}
              width={40}
              tickFormatter={(v: number) => formatCompact(v)}
            />
            <Tooltip
              content={renderTooltip}
              cursor={{ stroke: "var(--ink)", strokeDasharray: "3 3" }}
            />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            ))}
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
