import type { Tone } from "@/lib/tone";
import { cn } from "@/lib/utils";

const TONE_STYLES: Record<Tone, string> = {
  ok: "border-success/25 bg-success-bg text-success",
  warn: "border-pending/25 bg-pending-bg text-pending",
  bad: "border-danger/25 bg-danger-bg text-danger",
  neutral: "border-line bg-neutral-bg text-neutral",
};

/** The health line in a System card's header, and a row's state in its tables. */
export function ToneBadge({ tone, title, children }: { tone: Tone; title?: string; children: React.ReactNode }) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap",
        TONE_STYLES[tone],
      )}
    >
      {children}
    </span>
  );
}
