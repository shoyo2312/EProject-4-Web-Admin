import Link from "next/link";
import { ArrowRight, CircleHelp } from "lucide-react";
import { CountUp } from "@/components/ui/count-up";
import type { WaitingTile } from "@/lib/dashboard";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const TONE = {
  ok: { bar: "bg-accent", text: "text-ink-faint" },
  warn: { bar: "bg-pending", text: "text-pending" },
  bad: { bar: "bg-danger", text: "text-danger" },
} satisfies Record<WaitingTile["tone"], { bar: string; text: string }>;

/**
 * The work in front of the admin, as it stands right now — the first thing on the dashboard,
 * because it is the only part of it that asks for anything. Each tile opens its queue.
 */
export function WaitingTiles({ tiles }: { tiles: WaitingTile[] }) {
  const hint =
    "Every queue a person has to work through, as it stands right now. A queue is overdue once its oldest item has waited more than a day.";
  return (
    <section aria-label="Waiting on an admin">
      <h2 className="mb-3 flex items-center gap-1.5 text-[13px] font-medium text-ink-soft">
        Waiting on you
        <span
          aria-hidden
          title={hint}
          className="flex cursor-help text-ink-faint"
        >
          <CircleHelp className="h-3.5 w-3.5" />
        </span>
        <span className="sr-only">{hint}</span>
      </h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {tiles.map((tile) => {
          const tone = TONE[tile.tone];
          return (
            <Link
              key={tile.href}
              href={tile.href as never}
              className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-line bg-surface px-5 py-4 shadow-card transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-pop"
            >
              <span className={cn("absolute inset-y-0 left-0 w-1", tone.bar)} />
              <span className="flex items-center justify-between text-[13px] font-medium text-ink-soft">
                {tile.label}
                <ArrowRight className="h-4 w-4 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
              </span>
              <span className="figure text-[32px] leading-none font-semibold tracking-tight">
                <CountUp value={tile.count === null ? "—" : formatNumber(tile.count)} />
              </span>
              <span className={cn("text-[12px]", tone.text)}>
                {tile.detail}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
