import { CheckCircle2, CircleSlash, Clock } from "lucide-react";
import type { ReportStatus, ReportTargetType } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<
  ReportStatus,
  { label: string; className: string; Icon: typeof Clock }
> = {
  PENDING: {
    label: "Pending",
    className: "border-pending/25 bg-pending-bg text-pending",
    Icon: Clock,
  },
  RESOLVED: {
    label: "Resolved",
    className: "border-success/25 bg-success-bg text-success",
    Icon: CheckCircle2,
  },
  DISMISSED: {
    label: "Dismissed",
    className: "border-line bg-neutral-bg text-neutral",
    Icon: CircleSlash,
  },
};

export function StatusBadge({ status }: { status: ReportStatus }) {
  const { label, className, Icon } = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium",
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

/** Target type reads as a type tag, deliberately monochrome so status keeps the colour. */
export function TargetBadge({
  type,
  id,
}: {
  type: ReportTargetType;
  id: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="rounded border border-line bg-surface-muted px-1.5 py-0.5 text-[10px] tracking-wider text-ink-soft">
        {type}
      </span>
      <span className="text-ink-faint">{id.slice(-6)}</span>
    </span>
  );
}
