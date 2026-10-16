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
      className={cn(
        "rounded-xl border border-line bg-surface",
        className,
      )}
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
   * Small "?" affordance in the reference — kept as a title tooltip, no popover yet.
   *
   * The glyph is decorative and stays out of the tab order; the text itself is exposed to
   * assistive technology next to the heading instead. A bare `title` on a non-focusable span
   * is hover-only — unreachable by keyboard, and announced inconsistently by screen readers —
   * so the hint would otherwise be mouse-only on every card in the console.
   */
  hint?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <h2 className="label-caps text-ink">{title}</h2>
        {hint ? (
          <>
            <span
              aria-hidden
              title={hint}
              className="flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-line-strong text-[9px] text-ink-faint"
            >
              ?
            </span>
            <span className="sr-only">{hint}</span>
          </>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>
    </header>
  );
}
