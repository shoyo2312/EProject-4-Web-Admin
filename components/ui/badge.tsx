import type { ReportStatus, ReportTargetType } from "@/lib/api/types";
import { REPORT_STATUS_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<ReportStatus, string> = {
  PENDING: "bg-pending-bg text-pending",
  RESOLVED: "bg-success-bg text-success",
  DISMISSED: "bg-neutral-bg text-neutral",
};

/** A status pill: a dot in the status colour, then the word. */
export function StatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium whitespace-nowrap",
        STATUS_STYLES[status],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {REPORT_STATUS_LABELS[status]}
    </span>
  );
}

/**
 * Target type reads as a type tag, deliberately monochrome so status keeps the colour. Beside it
 * the target's name — a @handle, a video title — when the page could resolve one, and the tail
 * of its id when it could not.
 *
 * A long title wraps to a second line rather than holding the column open on one: at 1280px with
 * the sidebar out, a one-line title pushed the row's actions off the edge of the table.
 */
export function TargetBadge({
  type,
  id,
  name,
}: {
  type: ReportTargetType;
  id: string;
  name?: string | null;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span className="shrink-0 rounded-md bg-surface-muted px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-ink-soft capitalize">
        {type.toLowerCase()}
      </span>
      {name ? (
        <span className="line-clamp-2 max-w-[220px] wrap-anywhere" title={name}>
          {name}
        </span>
      ) : (
        <span className="font-mono text-[12px] text-ink-faint">{id.slice(-6)}</span>
      )}
    </span>
  );
}
