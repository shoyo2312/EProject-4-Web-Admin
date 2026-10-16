import { CheckCircle2, CircleSlash, Clock } from "lucide-react";
import type { ReportStatus, ReportTargetType } from "@/lib/api/types";
import { REPORT_STATUS_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<ReportStatus, { className: string; Icon: typeof Clock }> = {
  PENDING: { className: "border-pending/25 bg-pending-bg text-pending", Icon: Clock },
  RESOLVED: { className: "border-success/25 bg-success-bg text-success", Icon: CheckCircle2 },
  DISMISSED: { className: "border-line bg-neutral-bg text-neutral", Icon: CircleSlash },
};

export function StatusBadge({ status }: { status: ReportStatus }) {
  const { className, Icon } = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium",
        className,
      )}
    >
      <Icon className="h-3 w-3" />
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
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className="shrink-0 rounded border border-line bg-surface-muted px-1.5 py-0.5 text-[10px] tracking-wider whitespace-nowrap text-ink-soft">
        {type}
      </span>
      {name ? (
        <span className="line-clamp-2 max-w-[220px] wrap-anywhere" title={name}>
          {name}
        </span>
      ) : (
        <span className="text-ink-faint">{id.slice(-6)}</span>
      )}
    </span>
  );
}
