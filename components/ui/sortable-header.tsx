"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { nextSort, type SortState } from "@/lib/sort";
import { hrefWith } from "@/lib/url";
import { cn } from "@/lib/utils";

/**
 * A column header that orders its table, with TikTok Studio's press: a new column starts high to
 * low, the same column flips.
 *
 * By default it orders a server-paged list: it writes `sort` and `dir` to the URL, and the page
 * comes back ordered by the backend. Sorting a fetched page client-side could only reorder the
 * twenty-five rows that already won, which is a different list from "the oldest on the platform"
 * while looking exactly like it. A list the page holds whole passes `onSort` and sorts itself.
 *
 * Without `sort` — a list its page did not fetch in an order, like the dashboard's slice — it is a
 * plain label.
 */
export function SortableHeader<F extends string>({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string;
  sortKey: F;
  /** The order the rows are in. */
  sort?: SortState<F>;
  /** For a list sorted on the client; without it the press goes to the URL. */
  onSort?: (next: SortState<F>) => void;
  className?: string;
}) {
  if (!sort) {
    return <th className={cn("label px-3 py-3 text-ink-soft", className)}>{label}</th>;
  }
  const active = sort.field === sortKey;
  return (
    <th
      className={cn("px-3 py-3", className)}
      aria-sort={active ? (sort.ascending ? "ascending" : "descending") : "none"}
    >
      {onSort ? (
        <SortButton
          label={label}
          order={active ? sort.ascending : undefined}
          onClick={() => onSort(nextSort(sort, sortKey))}
        />
      ) : (
        <UrlSortButton label={label} sortKey={sortKey} sort={sort} />
      )}
    </th>
  );
}

function UrlSortButton<F extends string>({
  label,
  sortKey,
  sort,
}: {
  label: string;
  sortKey: F;
  sort: SortState<F>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function toggle() {
    const next = nextSort(sort, sortKey);
    // `dir` is written both ways: a list whose default is ascending (the trash) cannot tell
    // "flipped to descending" from "untouched" by the parameter's absence.
    const href = hrefWith(pathname, params, {
      sort: next.field,
      dir: next.ascending ? "asc" : "desc",
      page: null,
    });
    router.replace(href as never);
  }

  return (
    <SortButton
      label={label}
      order={sort.field === sortKey ? sort.ascending : undefined}
      onClick={toggle}
    />
  );
}

const CHEVRON_UP =
  "M7.74 14.492a1 1 0 0 0 1.41.109L12 12.158l2.85 2.443a1 1 0 0 0 1.3-1.519l-3.174-2.72a1.5 1.5 0 0 0-1.952 0l-3.175 2.72a1 1 0 0 0-.108 1.41";
const CHEVRON_DOWN =
  "M7.74 10.35a1 1 0 0 1 1.41-.11L12 12.684l2.85-2.442a1 1 0 1 1 1.3 1.518l-3.174 2.721a1.5 1.5 0 0 1-1.952 0l-3.175-2.72a1 1 0 0 1-.108-1.41";

/** Grey until picked, then ink with the live direction's chevron dark — as on Studio. */
function SortButton({
  label,
  order,
  onClick,
}: {
  label: string;
  /** True ascending, false descending, undefined while another column is the sort. */
  order: boolean | undefined;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Sort by ${label}${order === undefined ? "" : order ? ", low to high" : ", high to low"}`}
      className={cn(
        "label inline-flex items-center gap-1 transition-colors hover:text-ink",
        order === undefined ? "text-ink-soft" : "text-ink",
      )}
    >
      {label}
      <span className="flex h-3.5 w-3.5 flex-none items-center justify-center rounded-[4px] border border-line">
        <svg viewBox="0 0 24 24" className="h-3 w-3" aria-hidden>
          <path
            d={CHEVRON_UP}
            transform="translate(0 -3)"
            className={cn("transition-[fill] duration-200", order === true ? "fill-ink" : "fill-ink/35")}
          />
          <path
            d={CHEVRON_DOWN}
            transform="translate(0 3)"
            className={cn("transition-[fill] duration-200", order === false ? "fill-ink" : "fill-ink/35")}
          />
        </svg>
      </span>
    </button>
  );
}
