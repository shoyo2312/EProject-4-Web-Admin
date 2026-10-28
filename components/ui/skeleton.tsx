import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Loading placeholders. A page's `loading.tsx` draws it with the real components' own boxes — the
 * same cards, paddings, grids and line heights — so nothing moves when the data arrives: the text
 * appears where its bar was. Placeholder text sits inside an element carrying the real text's
 * font size, which is what gives each line the real height.
 */

/** A page's loading state. role="status" also keeps it out of the page's entrance animation. */
export function Skeleton({ children }: { children: ReactNode }) {
  return (
    <div role="status">
      <span className="sr-only">Loading…</span>
      {children}
    </div>
  );
}

/** A run of text, inline in an element with the real text's font: the line keeps its height. */
export function Bone({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-[0.7em] max-w-full animate-pulse rounded-full bg-line align-middle",
        className,
      )}
    />
  );
}

/**
 * Text laid out but not shown: a bar per line, breaking where the words do. For text that wraps
 * differently with the width — a page's title and subtitle — pass the page's own words, or a
 * sample as long as they usually run.
 */
export function Ghost({ children }: { children: string }) {
  return (
    <span
      aria-hidden
      className="animate-pulse rounded-full bg-[linear-gradient(transparent_19%,var(--line)_19%_81%,transparent_81%)] box-decoration-clone text-transparent select-none"
    >
      {children}
    </span>
  );
}

/** Lines of text one under another, each as wide as its entry in `widths`. */
export function Lines({ widths }: { widths: string[] }) {
  return widths.map((width, i) => (
    <Fragment key={i}>
      {i > 0 ? <br /> : null}
      <Bone className={width} />
    </Fragment>
  ));
}

/** A control, a picture or a chart, sized and rounded by the caller. */
export function Block({ className }: { className?: string }) {
  return <span className={cn("block shrink-0 animate-pulse bg-line", className)} />;
}

/** Row `row`'s pick from `options`, so a column's bars vary down the table the way text does. */
export function pick(row: number, ...options: string[]): string {
  return options[row % options.length];
}

const FIELD_WIDTHS = ["w-24", "w-32", "w-20", "w-36", "w-28", "w-16"];

/**
 * A run of `Field`s in the grid detail cards use. `columns` is the real `dl`'s column classes,
 * `className` its padding, and `badges` the fields whose value is a status pill — 22px, a little
 * taller than a line of text, so it deepens its row.
 */
export function FieldsSkeleton({
  count,
  columns = "grid-cols-2 xl:grid-cols-4",
  className,
  badges = [],
}: {
  count: number;
  columns?: string;
  className?: string;
  badges?: number[];
}) {
  return (
    <dl className={cn("grid gap-x-4 gap-y-2.5 text-[13px]", columns, className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <dt className="label text-[11px]">
            <Bone className={pick(i, "w-16", "w-12", "w-20")} />
          </dt>
          <dd className="mt-0.5">
            {badges.includes(i) ? (
              <Block className="h-[22px] w-16 rounded-full" />
            ) : (
              <Bone className={pick(i, ...FIELD_WIDTHS)} />
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export interface SkeletonColumn {
  /** The real column's cell classes: its padding, alignment, and the breakpoint it shows from. */
  className: string;
  /** Its share of the table as the real one settles with every column showing. */
  width?: string;
  head?: ReactNode;
  /** What row `row` shows in this column. The tallest cell sets the row's height, as in the real table. */
  cell: (row: number) => ReactNode;
}

/**
 * A table's head and `rows` rows, with the real table's classes on every cell. Wrapped as a
 * container, so the uploads table's `@4xl:table-cell` columns show exactly when its real ones do.
 */
export function TableSkeleton({
  columns,
  rows,
  className,
}: {
  columns: SkeletonColumn[];
  /** None draws the table's one "nothing here" row: for a table that is usually empty. */
  rows: number;
  className?: string;
}) {
  return (
    <div className="@container overflow-x-auto">
      <table className={cn("w-full border-collapse text-[13px]", className)}>
        <thead>
          <tr className="border-b border-line text-left">
            {columns.map((column, i) => (
              <th key={i} className={cn("label", column.className, column.width)}>
                {column.head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-5 py-10 text-center">
                <Bone className="w-48" />
              </td>
            </tr>
          ) : null}
          {Array.from({ length: rows }, (_, row) => (
            <tr key={row} className="border-b border-line last:border-b-0">
              {columns.map((column, i) => (
                <td key={i} className={column.className}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The select-all box the moderation and directory tables open with, head and rows alike. */
export function CheckSkeleton() {
  return (
    <span className="flex py-3 pr-3 pl-5">
      <Block className="h-3.5 w-3.5 rounded-[3px]" />
    </span>
  );
}

/** `Pager`: the count on the left, the page and its two buttons on the right. */
export function PagerSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3 px-1 py-1 text-[12px]">
      <p>
        <Bone className="w-32" />
      </p>
      <div className="flex items-center gap-1">
        <span className="mr-1">
          <Bone className="w-16" />
        </span>
        <Block className="h-7 w-7 rounded-md" />
        <Block className="h-7 w-7 rounded-md" />
      </div>
    </div>
  );
}
