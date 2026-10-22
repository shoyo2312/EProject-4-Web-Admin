import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import type { WaitingTile } from "@/lib/dashboard";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const TONE_STYLES: Record<WaitingTile["tone"], string> = {
  ok: "text-ink-faint",
  warn: "text-pending",
  bad: "text-danger",
};

export function WaitingTiles({ tiles }: { tiles: WaitingTile[] }) {
  return (
    <Card>
      <CardHeader
        title="Waiting on an admin"
        hint="Every queue a person has to work through, as it stands right now. A queue is overdue once its oldest item has waited more than a day."
      />
      <div className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {tiles.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href as never}
            className="group flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
          >
            <span className="label-caps flex items-center justify-between text-ink-soft">
              {tile.label}
              <ArrowRight className="h-3.5 w-3.5 text-ink-faint transition-colors group-hover:text-ink" />
            </span>
            <span className="figure text-[26px] leading-none font-bold">
              {tile.count === null ? "—" : formatNumber(tile.count)}
            </span>
            <span className={cn("text-[11px]", TONE_STYLES[tile.tone])}>{tile.detail}</span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
