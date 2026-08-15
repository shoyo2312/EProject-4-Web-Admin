"use client";

import { useMemo, useState } from "react";
import type { MosaicBucket } from "@/lib/api/rollup";
import { formatCompact, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Sub-columns per bucket — what turns a plain bar into a mosaic block. */
const COLS_PER_BUCKET = 5;
const ROWS = 24;

type CellState = "primary" | "secondary" | "empty";

/**
 * Deterministic jitter so a bucket's sub-columns differ slightly in height.
 * Without it every bucket renders as a flat-topped rectangle and the mosaic
 * reads as an ordinary bar chart.
 */
function jitter(bucketIndex: number, colIndex: number) {
  const n = Math.sin(bucketIndex * 12.9898 + colIndex * 78.233) * 43758.5453;
  return 0.72 + (n - Math.floor(n)) * 0.56; // 0.72 – 1.28
}

export function MosaicChart({
  buckets,
  primaryLabel,
  secondaryLabel,
}: {
  buckets: MosaicBucket[];
  primaryLabel: string;
  secondaryLabel: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  const { columns, axisTicks } = useMemo(() => {
    const peak = Math.max(
      ...buckets.map((b) => (b.primary + b.secondary) * 1.28),
      1,
    );
    // Round the axis up to a clean step so the tick labels stay readable.
    const step = Math.pow(10, Math.floor(Math.log10(peak / ROWS)));
    const perCell = Math.ceil(peak / ROWS / step) * step;
    const axisMax = perCell * ROWS;

    const columns = buckets.flatMap((bucket, bucketIndex) =>
      Array.from({ length: COLS_PER_BUCKET }, (_, colIndex) => {
        const scale = jitter(bucketIndex, colIndex);
        const primaryCells = Math.round((bucket.primary * scale) / perCell);
        const secondaryCells = Math.round((bucket.secondary * scale) / perCell);
        const cells: CellState[] = Array.from({ length: ROWS }, (_, row) => {
          // Row 0 is the top of the column; stack fills from the bottom up.
          const fromBottom = ROWS - row;
          if (fromBottom <= primaryCells) return "primary";
          if (fromBottom <= primaryCells + secondaryCells) return "secondary";
          return "empty";
        });
        return { bucketIndex, cells };
      }),
    );

    const axisTicks = Array.from({ length: 7 }, (_, i) =>
      formatCompact(Math.round((axisMax / 6) * (6 - i))),
    );

    return { columns, axisTicks };
  }, [buckets]);

  const active = hovered === null ? null : buckets[hovered];

  return (
    <div className="relative">
      {/* Legend */}
      <div className="mb-3 flex items-center gap-4 text-[11px] text-ink-soft">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[var(--cell-strong)]" />
          <span className="label-caps">{primaryLabel}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[var(--cell-mid)]" />
          <span className="label-caps">{secondaryLabel}</span>
        </span>
      </div>

      <div className="flex gap-3">
        {/* Y axis — height pinned to the plot so the "0" tick lands on the baseline */}
        <div className="flex h-[280px] flex-col justify-between text-[10px] text-ink-faint">
          {axisTicks.map((tick) => (
            <span key={tick} className="figure leading-none">
              {tick}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div
            className="relative flex h-[280px] gap-[6px]"
            onMouseLeave={() => setHovered(null)}
          >
            {buckets.map((bucket, bucketIndex) => (
              <div
                key={bucket.label}
                className="flex min-w-0 flex-1 gap-[2px]"
                onMouseEnter={() => setHovered(bucketIndex)}
              >
                {columns
                  .filter((c) => c.bucketIndex === bucketIndex)
                  .map((column, colIndex) => (
                    <div
                      key={colIndex}
                      className="flex min-w-0 flex-1 flex-col gap-[2px]"
                    >
                      {column.cells.map((state, row) => (
                        <span
                          key={row}
                          className={cn(
                            "flex-1 rounded-[1px] transition-opacity",
                            state === "primary" && "bg-[var(--cell-strong)]",
                            state === "secondary" && "bg-[var(--cell-mid)]",
                            state === "empty" && "bg-[var(--cell-empty)]",
                            hovered !== null &&
                              hovered !== bucketIndex &&
                              state !== "empty" &&
                              "opacity-40",
                          )}
                        />
                      ))}
                    </div>
                  ))}
              </div>
            ))}

            {/* Hover marker: dotted rule + dot, matching the reference */}
            {hovered !== null ? (
              <span
                className="pointer-events-none absolute top-0 bottom-0 border-l border-dashed border-ink"
                style={{
                  left: `${((hovered + 0.5) / buckets.length) * 100}%`,
                }}
              >
                <span className="absolute -top-1 -left-[4px] h-2 w-2 rounded-full bg-ink" />
              </span>
            ) : null}
          </div>

          {/* X axis */}
          <div className="mt-3 flex gap-[6px] border-t border-dashed border-line pt-2">
            {buckets.map((bucket, i) => (
              <span
                key={bucket.label}
                className={cn(
                  "flex-1 text-center text-[10px] tracking-wider",
                  hovered === i ? "font-semibold text-ink" : "text-ink-faint",
                )}
              >
                {bucket.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {active ? (
        <div
          className={cn(
            "pointer-events-none absolute top-16 z-10 w-[190px] rounded-lg border border-line bg-surface p-3",
            // Flip to the left of the marker near the right edge so it stays in frame
            hovered! > buckets.length - 4 && "-translate-x-full",
          )}
          style={{
            left: `calc(${((hovered! + 0.5) / buckets.length) * 100}% + ${
              hovered! > buckets.length - 4 ? 24 : 48
            }px)`,
          }}
        >
          <p className="text-[12px] font-semibold">{active.label}</p>
          <dl className="mt-2 space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-ink-soft">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--cell-strong)]" />
                {primaryLabel}
              </dt>
              <dd className="figure font-semibold">
                {formatNumber(active.primary)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-ink-soft">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--cell-mid)]" />
                {secondaryLabel}
              </dt>
              <dd className="figure font-semibold">
                {formatNumber(active.secondary)}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}
