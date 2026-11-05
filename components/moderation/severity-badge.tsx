import { cn } from "@/lib/utils";

/**
 * Severity is 1–10 and means nothing to read as a number mid-scan. Three bands, so a row is
 * either something to open now, something to get to, or something that can wait.
 */
function severityBand(severity: number) {
  if (severity >= 8) return { label: "Critical", className: "border-danger/25 bg-danger-bg text-danger" };
  if (severity >= 5) return { label: "High", className: "border-pending/25 bg-pending-bg text-pending" };
  return { label: "Routine", className: "border-line bg-neutral-bg text-neutral" };
}

export function SeverityBadge({ severity }: { severity: number }) {
  const band = severityBand(severity);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-1 text-[12px] font-medium",
        band.className,
      )}
    >
      {band.label}
    </span>
  );
}
