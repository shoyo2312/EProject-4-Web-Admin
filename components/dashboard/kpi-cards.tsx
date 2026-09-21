import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Sparkbars } from "@/components/charts/sparkbars";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface KpiCard {
  label: string;
  value: string;
  /** Small grey word after the figure, e.g. "Reports" / "New Users" */
  unit?: string;
  /**
   * Percentage change against the previous period, or null when none can be computed: a
   * snapshot figure with no history behind it, or a previous period that was zero.
   *
   * Null draws no footer rather than a 0% that reads as "held steady" — the arrow and its
   * colour are a claim about a trend, and there is no trend to claim.
   */
  delta?: number | null;
  deltaLabel?: string;
  /** Omitted when nothing measures this figure over time, for the same reason as `delta`. */
  spark?: number[];
  /** Rising pending-reports is bad news — colour follows meaning, not sign. */
  invertDelta?: boolean;
}

export function KpiCards({ cards }: { cards: KpiCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {cards.map((card) => {
        const delta = card.delta ?? null;
        const rising = delta !== null && delta >= 0;
        const good = card.invertDelta ? !rising : rising;
        const Arrow = rising ? ArrowUpRight : ArrowDownRight;

        return (
          <Card key={card.label} className="flex flex-col">
            <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
              <div className="min-w-0">
                <p className="label-caps text-ink-soft">{card.label}</p>
                <p className="mt-2 flex items-baseline gap-1.5">
                  <span className="figure text-[26px] leading-none font-bold">
                    {card.value}
                  </span>
                  {card.unit ? (
                    <span className="truncate text-[11px] text-ink-faint">
                      {card.unit}
                    </span>
                  ) : null}
                </p>
              </div>
              {card.spark ? (
                <Sparkbars values={card.spark} className="shrink-0" />
              ) : null}
            </div>
            {delta !== null ? (
              <div className="flex items-center justify-between border-t border-line px-5 py-2.5">
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full border",
                    good
                      ? "border-success/30 text-success"
                      : "border-danger/30 text-danger",
                  )}
                >
                  <Arrow className="h-2.5 w-2.5" />
                </span>
                <span className="text-[11px] text-ink-faint">
                  <span className={good ? "text-success" : "text-danger"}>
                    {rising ? "+" : ""}
                    {delta}%
                  </span>{" "}
                  {card.deltaLabel}
                </span>
              </div>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}
