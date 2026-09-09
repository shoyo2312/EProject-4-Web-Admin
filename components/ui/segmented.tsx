"use client";

import { cn } from "@/lib/utils";

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg border border-line bg-surface-muted p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "shrink-0 rounded-md px-2.5 py-1.5 text-[11px] transition-colors lg:px-3",
            value === option.value
              ? "bg-surface font-semibold text-ink shadow-[0_0_0_1px_var(--line)]"
              : "text-ink-soft hover:text-ink",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
