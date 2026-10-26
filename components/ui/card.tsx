import { CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn("rounded-2xl border border-line bg-surface shadow-card", className)}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  hint,
  actions,
  className,
}: {
  title: string;
  /**
   * What this card is measuring and where it reads from — kept as a title tooltip on the
   * glyph, with the same text exposed to assistive technology beside the heading, because a
   * bare `title` on a non-focusable span is mouse-only.
   */
  hint?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5",
        className,
      )}
    >
      <div className="flex items-center gap-1.5">
        <h2 className="text-[14px] font-semibold tracking-tight text-ink">{title}</h2>
        {hint ? (
          <>
            {/* The glyph is decorative and hover-only; the sr-only copy is what is read out. */}
            <span aria-hidden title={hint} className="flex cursor-help text-ink-faint">
              <CircleHelp className="h-3.5 w-3.5" />
            </span>
            <span className="sr-only">{hint}</span>
          </>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>
    </header>
  );
}
