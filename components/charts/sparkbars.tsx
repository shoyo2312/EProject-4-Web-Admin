import { cn } from "@/lib/utils";

/**
 * The tiny bar cluster sitting to the right of each KPI figure. Deliberately
 * unlabelled — it carries shape, not values; the number beside it carries the value.
 */
export function Sparkbars({
  values,
  className,
}: {
  values: number[];
  className?: string;
}) {
  const max = Math.max(...values, 1);
  return (
    <div
      aria-hidden
      className={cn("flex h-9 items-end gap-[3px]", className)}
    >
      {values.map((value, i) => (
        <span
          key={i}
          className="w-[3px] rounded-[1px] bg-ink"
          style={{
            height: `${Math.max(12, (value / max) * 100)}%`,
            opacity: 0.25 + (value / max) * 0.75,
          }}
        />
      ))}
    </div>
  );
}
