import type { Tone } from "@/lib/tone";
import { cn } from "@/lib/utils";

const TONE_STYLES: Record<Tone, string> = {
  ok: "bg-success-bg text-success",
  warn: "bg-pending-bg text-pending",
  bad: "bg-danger-bg text-danger",
  neutral: "bg-neutral-bg text-neutral",
};

/** The health line in a System card's header, and a row's state in its tables. */
export function ToneBadge({ tone, title, children }: { tone: Tone; title?: string; children: React.ReactNode }) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        TONE_STYLES[tone],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
