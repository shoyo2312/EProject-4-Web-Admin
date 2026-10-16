"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronsUpDown } from "lucide-react";
import { hrefWith } from "@/lib/url";
import { cn } from "@/lib/utils";

/**
 * A column header that orders a server-paged list: it writes `sort` and `dir` to the URL, and the
 * page comes back ordered by the backend. Sorting a fetched page client-side could only reorder
 * the twenty-five rows that already won, which is a different list from "the oldest on the
 * platform" while looking exactly like it.
 *
 * Without `sort` — a list its page did not fetch in an order, like the dashboard's slice — it is a
 * plain label.
 */
export function SortableHeader<F extends string>({
  label,
  sortKey,
  sort,
  className,
}: {
  label: string;
  sortKey: F;
  /** The order the page was fetched in. */
  sort?: { field: F; ascending: boolean };
  className?: string;
}) {
  if (!sort) {
    return <th className={cn("label-caps px-3 py-3 text-ink-soft", className)}>{label}</th>;
  }
  const active = sort.field === sortKey;
  return (
    <th
      className={cn("px-3 py-3", className)}
      aria-sort={active ? (sort.ascending ? "ascending" : "descending") : "none"}
    >
      <SortButton label={label} sortKey={sortKey} active={active} ascending={sort.ascending} />
    </th>
  );
}

function SortButton({
  label,
  sortKey,
  active,
  ascending,
}: {
  label: string;
  sortKey: string;
  active: boolean;
  ascending: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function toggle() {
    // A fresh column starts descending — newest, highest, last — and only clicking the column
    // that is already active flips it.
    const href = hrefWith(pathname, params, {
      sort: sortKey,
      dir: active && !ascending ? "asc" : null,
      page: null,
    });
    router.replace(href as never);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "label-caps inline-flex items-center gap-1 transition-colors hover:text-ink",
        active ? "text-ink" : "text-ink-soft",
      )}
    >
      {label}
      <ChevronsUpDown className="h-3 w-3" />
    </button>
  );
}
