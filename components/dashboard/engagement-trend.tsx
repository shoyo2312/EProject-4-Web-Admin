"use client";

import { useState } from "react";
import { MosaicChart } from "@/components/charts/mosaic-chart";
import { Card, CardHeader, CardMenuButton } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import type { MosaicRange, MosaicSeries } from "@/lib/api/rollup";
import { formatNumber } from "@/lib/format";

const RANGES = [
  { value: "daily" as const, label: "Daily" },
  { value: "weekly" as const, label: "Weekly" },
  { value: "monthly" as const, label: "Monthly" },
];

export function EngagementTrend({ series }: { series: MosaicSeries }) {
  const [range, setRange] = useState<MosaicRange>("monthly");
  const buckets = series[range];
  const total = buckets.reduce((sum, b) => sum + b.primary + b.secondary, 0);

  return (
    <Card className="min-w-0">
      <CardHeader
        title="Engagement Trend"
        hint="Rolled up from GET /api/v1/analytics/engagement/daily?days=365"
        actions={<CardMenuButton />}
      />
      <div className="p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="flex items-baseline gap-2">
            <span className="label-caps text-ink-soft">Total events</span>
            <span className="figure text-[22px] font-bold">
              {formatNumber(total)}
            </span>
          </p>
          <Segmented options={RANGES} value={range} onChange={setRange} />
        </div>

        <MosaicChart
          buckets={buckets}
          primaryLabel="Likes"
          secondaryLabel="Comments & Shares"
        />
      </div>
    </Card>
  );
}
