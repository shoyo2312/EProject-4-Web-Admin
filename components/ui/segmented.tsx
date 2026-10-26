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
    <div className="flex h-9 max-w-full items-center gap-0.5 overflow-x-auto rounded-lg bg-surface-muted p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "h-7 shrink-0 rounded-md px-2.5 text-[12px] transition-colors lg:px-3",
            value === option.value
              ? "bg-surface font-medium text-ink shadow-card"
              : "text-ink-soft hover:text-ink",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
