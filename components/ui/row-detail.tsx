"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Spread onto a <tr> to make the whole row a toggle for its detail block. The
 * uploads and users tables always expand; the moderation tables only apply it
 * below xl, where they drop their secondary columns and the hidden fields move
 * into the expand row.
 */
export function expandableRowProps(toggle: () => void, expanded: boolean) {
  return {
    role: "button" as const,
    tabIndex: 0,
    "aria-expanded": expanded,
    onClick: toggle,
    onKeyDown: (e: KeyboardEvent<HTMLTableRowElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    },
  };
}

/** The expand-row body under a table row. */
export function RowDetail({
  colSpan,
  children,
}: {
  colSpan: number;
  children: ReactNode;
}) {
  return (
    <tr className="border-b border-line bg-surface-muted last:border-b-0">
      <td colSpan={colSpan} className="px-5 py-3">
        {/* w-0 min-w-full: the expand cell fills the row but contributes zero
            intrinsic width, so the auto table-layout can't redistribute column
            widths (shoving the table sideways) when a row opens. */}
        <dl className="grid w-0 min-w-full grid-cols-2 gap-x-4 gap-y-2.5 text-[12px]">
          {children}
        </dl>
      </td>
    </tr>
  );
}

export function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-w-0", wide && "col-span-2")}>
      <dt className="label-caps text-[10px] text-ink-faint">{label}</dt>
      <dd className="mt-0.5 wrap-anywhere">{children}</dd>
    </div>
  );
}
