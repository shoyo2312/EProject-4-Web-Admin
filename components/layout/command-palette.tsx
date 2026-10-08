"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Flag, Loader2, Search, UserRound, type LucideIcon } from "lucide-react";
import {
  searchConsoleAction,
  type SearchHit,
  type SearchResults,
} from "@/app/(admin)/actions";
import { VideoThumb } from "@/components/videos/video-thumb";
import { isTypingTarget } from "@/lib/keyboard";
import { matchPages, moveSelection } from "@/lib/search";
import { cn } from "@/lib/utils";
import { NAV_GROUPS } from "./nav-config";

interface Option {
  key: string;
  group: string;
  title: string;
  detail: string | null;
  href: string;
  /** Null draws the video's thumbnail instead. */
  icon: LucideIcon | null;
  thumbnailUrl: string | null;
}

const PAGES = NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => ({
    label: item.label,
    section: group.label,
    href: item.href as string,
    icon: item.icon,
  })),
);

/** How long typing has to pause before the term goes to the gateway. */
const DEBOUNCE_MS = 250;

function focusedElement(): HTMLElement | null {
  return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}

/**
 * The topbar search: one box for jumping to a page, an account, a video or a report, opened with
 * ⌘K / Ctrl+K or "/". Results come from the same server-side filters the directories use, so
 * a hit here is a hit there.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);

  function show() {
    opener.current = focusedElement();
    setOpen(true);
  }

  function hide() {
    setOpen(false);
    // Back to whatever had focus before, so a keyboard user carries on from where they were.
    opener.current?.focus();
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const combo = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      const slash = !open && event.key === "/" && !isTypingTarget(event.target);
      if (!combo && !slash) return;
      event.preventDefault();
      if (open) {
        setOpen(false);
        opener.current?.focus();
      } else {
        opener.current = focusedElement();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={show}
        aria-keyshortcuts="Meta+K Control+K /"
        className="hidden w-[200px] items-center gap-2 rounded-lg border border-line bg-surface-muted px-3 py-2 text-left transition-colors hover:border-line-strong sm:flex lg:w-[320px]"
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
        <span className="min-w-0 flex-1 truncate text-[12px] text-ink-faint">
          Search users, videos, reports...
        </span>
        <kbd className="hidden items-center gap-0.5 rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] text-ink-faint lg:flex">
          ⌘ K
        </kbd>
      </button>
      <button
        type="button"
        onClick={show}
        aria-label="Search"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-soft transition-colors hover:bg-surface-muted sm:hidden"
      >
        <Search className="h-4 w-4" />
      </button>

      {open ? (
        <PaletteDialog
          onClose={hide}
          onOpen={(href) => {
            hide();
            router.push(href as never);
          }}
        />
      ) : null}
    </>
  );
}

function PaletteDialog({
  onClose,
  onOpen,
}: {
  onClose: () => void;
  onOpen: (href: string) => void;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<{ term: string; results: SearchResults } | null>(null);
  const [searching, startSearch] = useTransition();
  const [active, setActive] = useState(0);
  const typed = useRef("");

  useEffect(() => {
    const term = query.trim();
    typed.current = term;
    if (term.length < 2) return;
    const timer = setTimeout(() => {
      startSearch(async () => {
        const results = await searchConsoleAction(term);
        // Answers come back in order, but the box may say something else by now.
        if (typed.current === term) setAnswer({ term, results });
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const term = query.trim();
  const found = term.length >= 2 ? answer : null;
  const options: Option[] = [
    ...matchPages(term, PAGES)
      .slice(0, term ? 4 : PAGES.length)
      .map((page) => ({
        key: `page:${page.href}`,
        group: "Pages",
        title: page.label,
        detail: page.section,
        href: page.href,
        icon: page.icon,
        thumbnailUrl: null,
      })),
    ...(found?.results.users ?? []).map((hit) => fromHit("Accounts", hit, UserRound)),
    ...(found?.results.videos ?? []).map((hit) => fromHit("Videos", hit, null)),
    ...(found?.results.reports ?? []).map((hit) => fromHit("Reports", hit, Flag)),
  ];
  const activeIndex = options.length === 0 ? -1 : Math.min(active, options.length - 1);
  // Last term's results stay up, dimmed, until this term's arrive — rather than flashing empty.
  const stale = found !== null && found.term !== term;
  const nothingFound =
    found !== null &&
    !stale &&
    !searching &&
    found.results.users.length + found.results.videos.length + found.results.reports.length === 0;

  const optionId = (index: number) => `${listId}-${index}`;

  function move(delta: number) {
    const next = moveSelection(activeIndex, delta, options.length);
    setActive(next);
    document.getElementById(optionId(next))?.scrollIntoView({ block: "nearest" });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "Enter") {
      const option = options[activeIndex];
      if (!option) return;
      event.preventDefault();
      onOpen(option.href);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      onMouseDown={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-[12vh]"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search the console"
        onMouseDown={(event) => event.stopPropagation()}
        className="w-full max-w-[560px] overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-ink-faint" />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search accounts, videos and reports, or paste an id..."
            role="combobox"
            aria-expanded={options.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-ink-faint"
          />
          {searching ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-ink-faint" /> : null}
          <kbd className="rounded border border-line bg-surface-muted px-1.5 py-0.5 text-[10px] text-ink-faint">
            Esc
          </kbd>
        </div>

        <div
          id={listId}
          role="listbox"
          aria-label="Results"
          className={cn(
            "max-h-[min(60vh,440px)] overflow-y-auto py-1.5 transition-opacity",
            stale && "opacity-60",
          )}
        >
          {options.map((option, index) => (
            <div key={option.key}>
              {index === 0 || options[index - 1].group !== option.group ? (
                <p className="label-caps px-4 pt-2.5 pb-1 text-[10px] text-ink-faint">
                  {option.group}
                </p>
              ) : null}
              <div
                id={optionId(index)}
                role="option"
                aria-selected={index === activeIndex}
                onMouseMove={() => {
                  if (index !== activeIndex) setActive(index);
                }}
                onClick={() => onOpen(option.href)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 px-4 py-2",
                  index === activeIndex && "bg-surface-muted",
                )}
              >
                {option.icon ? (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line text-ink-soft">
                    <option.icon className="h-3.5 w-3.5" />
                  </span>
                ) : (
                  <VideoThumb src={option.thumbnailUrl} className="h-10 w-8" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium">{option.title}</span>
                  {option.detail ? (
                    <span className="block truncate text-[11px] text-ink-faint">
                      {option.detail}
                    </span>
                  ) : null}
                </span>
              </div>
            </div>
          ))}

          {term.length < 2 ? (
            <p className="px-4 pt-2 pb-2.5 text-[11px] text-ink-faint">
              Type at least two characters to search accounts and videos, or paste a full user,
              video or report id.
            </p>
          ) : nothingFound ? (
            <p className="px-4 pt-2 pb-2.5 text-[11px] text-ink-faint">
              No account, video or report matches &ldquo;{term}&rdquo;.
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[10px] text-ink-faint">
          <span>↑ ↓ to move</span>
          <span>Enter to open</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function fromHit(group: string, hit: SearchHit, icon: LucideIcon | null): Option {
  return {
    key: `${group}:${hit.id}`,
    group,
    title: hit.title,
    detail: hit.detail,
    href: hit.href,
    icon,
    thumbnailUrl: hit.thumbnailUrl,
  };
}
