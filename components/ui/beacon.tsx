import { cn } from "@/lib/utils";

/**
 * A dot sending out a ring, in the colour of the text around it: for the one or two things on a
 * screen that are waiting on someone. Not for every pending row — a column of them stops meaning
 * anything and only moves.
 */
export function Beacon({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("relative inline-flex h-1.5 w-1.5 shrink-0", className)}>
      <span className="absolute inset-0 animate-beacon rounded-full bg-current" />
      <span className="relative h-1.5 w-1.5 rounded-full bg-current" />
    </span>
  );
}
