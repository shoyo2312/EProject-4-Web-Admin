"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useTransition } from "react";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Page state lives in the URL, like every other filter in the console: the lists are server
 * components, so moving a page is a navigation that refetches rather than client state over
 * rows already in the browser. That also makes a page shareable and survivable across a reload.
 */
export function Pager(props: PagerProps) {
  // useSearchParams opts the subtree into client rendering; the boundary keeps that from
  // forcing the whole list page out of static generation — same reason PageHeader has one.
  return (
    <Suspense fallback={null}>
      <PagerControls {...props} />
    </Suspense>
  );
}

interface PagerProps {
  /** Zero-based, as Spring numbers it. */
  page: number;
  totalPages: number;
  total: number;
  size: number;
  /** Plural noun for the count line — "users", "videos". */
  label: string;
}

function PagerControls({
  page,
  totalPages,
  total,
  size,
  label,
}: PagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function go(next: number) {
    const query = new URLSearchParams(params);
    // Page 0 is the default; leaving ?page=0 in the bar is noise.
    // One-based in the URL — page 1 is what the pager is showing, not an index.
    if (next <= 0) query.delete("page");
    else query.set("page", String(next + 1));
    const search = query.toString();
    startTransition(() =>
      router.replace(search ? `${pathname}?${search}` : pathname),
    );
  }

  const first = total === 0 ? 0 : page * size + 1;
  const last = Math.min(total, page * size + size);
  const atStart = page <= 0;
  const atEnd = page >= totalPages - 1;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-1 py-1 text-[11px] text-ink-soft",
        pending && "opacity-60",
      )}
    >
      <p>
        {total === 0 ? (
          <>No {label}</>
        ) : (
          <>
            {formatNumber(first)}–{formatNumber(last)} of{" "}
            <span className="text-ink">{formatNumber(total)}</span> {label}
          </>
        )}
      </p>

      <div className="flex items-center gap-1">
        <span className="mr-1 tabular-nums">
          Page {page + 1} of {Math.max(totalPages, 1)}
        </span>
        <PagerButton label="Previous page" disabled={atStart} onClick={() => go(page - 1)}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </PagerButton>
        <PagerButton label="Next page" disabled={atEnd} onClick={() => go(page + 1)}>
          <ChevronRight className="h-3.5 w-3.5" />
        </PagerButton>
      </div>
    </div>
  );
}

function PagerButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md border border-line transition-colors",
        disabled ? "cursor-not-allowed text-ink-faint" : "hover:bg-surface",
      )}
    >
      {children}
    </button>
  );
}
