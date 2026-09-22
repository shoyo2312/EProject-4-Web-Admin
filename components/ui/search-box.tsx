"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The search box the directories share. Filtering happens on the server — every list here is
 * paged, so narrowing the rows already fetched would read as a platform-wide search while being
 * "the matches among these twenty-five" — so the box drives the URL, and the commit is debounced
 * because every keystroke would otherwise be a round trip through the gateway.
 *
 * `query` is what the URL currently says; the box owns the text being typed until it settles.
 */
export function SearchBox({
  query,
  onCommit,
  placeholder,
  full,
}: {
  query: string;
  /** Called with the trimmed term once typing settles. */
  onCommit: (term: string) => void;
  placeholder: string;
  /** Fills its container instead of taking the directory header's fixed width. */
  full?: boolean;
}) {
  const [term, setTerm] = useState(query);
  // Held in a ref so that a caller passing an inline arrow — all of them do — does not restart
  // the debounce on every one of its own renders.
  const commit = useRef(onCommit);
  useEffect(() => {
    commit.current = onCommit;
  });

  useEffect(() => {
    // Trimmed on both sides of the compare: the URL holds the trimmed term, so a trailing
    // space would otherwise read as a change and re-commit what is already there.
    if (term.trim() === query) return;
    const timer = setTimeout(() => commit.current(term.trim()), 350);
    return () => clearTimeout(timer);
  }, [term, query]);

  return (
    <label
      className={cn(
        "flex items-center gap-2 rounded-lg border border-line bg-surface-muted px-2.5 py-1.5",
        full ? "w-full" : "w-[180px] lg:w-[240px]",
      )}
    >
      <Search className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
      <input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:text-ink-faint"
      />
    </label>
  );
}
