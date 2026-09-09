"use client";

import { CalendarDays, ChevronDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { GRANULARITIES, type Granularity } from "@/lib/api/window";
import { formatDate } from "@/lib/format";

export interface HeaderFilterConfig {
  /** Bucket size for the page's charts. Omitted on pages that only show lists. */
  granularity?: Granularity;
  asOf: string;
  /** Newest date with data — the mock clock in mock mode, today otherwise. */
  latest: string;
}

/**
 * State lives in the URL rather than in component state so a filtered view survives a
 * reload and can be pasted to someone else. Server components re-run on the change,
 * which is what refetches the narrower window.
 */
export function HeaderFilters({ granularity, asOf, latest }: HeaderFilterConfig) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function setParam(key: string, value: string, isDefault: boolean) {
    const next = new URLSearchParams(params);
    // A parameter sitting at its default is noise in the address bar, and it makes the
    // "is anything filtered" check below unreliable.
    if (isDefault) next.delete(key);
    else next.set(key, value);
    const query = next.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname));
  }

  const dimmed = pending ? "opacity-60" : "";

  return (
    <>
      {granularity ? (
        <div className={`relative ${dimmed}`}>
          <select
            value={granularity}
            aria-label="Bucket size"
            onChange={(e) =>
              setParam("g", e.target.value, e.target.value === "daily")
            }
            className="appearance-none rounded-lg border border-line bg-surface py-2 pr-8 pl-3 text-[12px] transition-colors hover:bg-surface-muted"
          >
            {GRANULARITIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
        </div>
      ) : null}

      {/* The browser draws the text inside a date input from its own locale, and no
          attribute reliably overrides that — lang="en-GB" is honoured by some builds and
          ignored by others. So the native field is laid transparently over the button and
          only supplies the calendar; the text underneath is ours, always DD/MM/YYYY. */}
      <div
        className={`relative flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-[12px] transition-colors focus-within:bg-surface-muted hover:bg-surface-muted ${dimmed}`}
      >
        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
        <span aria-hidden>{formatDate(asOf)}</span>
        <input
          type="date"
          value={asOf}
          max={latest}
          aria-label="Show data up to"
          onClick={(e) => {
            // A click lands on the transparent field, which focuses it without opening
            // anything in most browsers; showPicker is what actually raises the calendar.
            try {
              e.currentTarget.showPicker();
            } catch {
              // Unsupported, or blocked outside a user gesture — the field still takes
              // typed input and the browser's own affordance still works.
            }
          }}
          onChange={(e) =>
            // Clearing the field yields "", which must land back on the newest data
            // rather than on an empty window.
            setParam("asOf", e.target.value || latest, !e.target.value || e.target.value === latest)
          }
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </div>
    </>
  );
}
