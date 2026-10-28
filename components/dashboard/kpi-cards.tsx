import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Sparkline } from "@/components/charts/sparkline";
import { Card } from "@/components/ui/card";
import { Block, Bone } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const GRID = "grid grid-cols-2 gap-4 xl:grid-cols-4";
const CARD = "flex flex-col px-5 py-4";

export interface KpiCard {
  label: string;
  value: string;
  /** Small grey word after the figure, e.g. "Reports" / "New Users" */
  unit?: string;
  /** Drawn in the corner tile when the page has one that names the figure. */
  icon?: LucideIcon;
  /**
   * Percentage change against the previous period, or null when none can be computed: a
   * snapshot figure with no history behind it, or a previous period that was zero.
   *
   * Null draws no footer rather than a 0% that reads as "held steady" — the arrow and its
   * colour are a claim about a trend, and there is no trend to claim.
   */
  delta?: number | null;
  /** "count" draws the delta as an amount added ("+4") — for a period that started from zero. */
  deltaUnit?: "percent" | "count";
  deltaLabel?: string;
  /** Omitted when nothing measures this figure over time, for the same reason as `delta`. */
  spark?: number[];
  /** Rising pending-reports is bad news — colour follows meaning, not sign. */
  invertDelta?: boolean;
}

export function KpiCards({ cards }: { cards: KpiCard[] }) {
  return (
    <div className={cn(GRID, "stagger")}>
      {cards.map((card) => {
        const delta = card.delta ?? null;
        const rising = delta !== null && delta >= 0;
        const good = card.invertDelta ? !rising : rising;
        const Arrow = rising ? ArrowUpRight : ArrowDownRight;

        return (
          <Card key={card.label} className={CARD}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-medium text-ink-soft">{card.label}</p>
              {card.icon ? (
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <card.icon className="h-3.5 w-3.5" />
                </span>
              ) : null}
            </div>

            <div className="mt-3 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="figure text-[28px] leading-none font-semibold tracking-tight">
                  {card.value}
                </p>
                {/* The unit wraps under the figure rather than truncating: "Average, last 3…"
                    drops exactly the part that says what the number covers. */}
                {card.unit ? (
                  <p className="mt-1.5 text-[12px] text-ink-faint">{card.unit}</p>
                ) : null}
              </div>
              {card.spark ? (
                <Sparkline values={card.spark} />
              ) : null}
            </div>

            {delta !== null ? (
              <p className="mt-3 flex items-center gap-1.5 text-[12px] text-ink-faint">
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium",
                    good ? "bg-success-bg text-success" : "bg-danger-bg text-danger",
                  )}
                >
                  <Arrow className="h-3 w-3" />
                  {rising ? "+" : ""}
                  {card.deltaUnit === "count" ? formatNumber(delta) : `${delta}%`}
                </span>
                <span className="truncate">{card.deltaLabel}</span>
              </p>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}

/** The cards before their figures arrive, every one with a trend and a delta drawn. */
export function KpiCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={GRID}>
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className={CARD}>
          <p className="text-[13px] font-medium">
            <Bone className={i % 2 ? "w-24" : "w-28"} />
          </p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[28px] leading-none">
                <Bone className="w-14" />
              </p>
              <p className="mt-1.5 text-[12px]">
                <Bone className="w-16" />
              </p>
            </div>
            <Block className="h-9 w-24 rounded-md" />
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[12px]">
            <Block className="h-[22px] w-14 rounded-full" />
            <Bone className="w-20" />
          </p>
        </Card>
      ))}
    </div>
  );
}
