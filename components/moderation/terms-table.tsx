"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Trash2 } from "lucide-react";
import { removeTermAction } from "@/app/(admin)/moderation/terms/actions";
import { Card, CardHeader } from "@/components/ui/card";
import { SearchBox } from "@/components/ui/search-box";
import { Segmented } from "@/components/ui/segmented";
import type { ModerationTermAction, ModerationTermResponse } from "@/lib/api/types";
import { formatDateTime, relativeTime } from "@/lib/format";
import { TERM_ACTION_LABELS, categoryLabel, statusTabs } from "@/lib/labels";
import { TERM_ACTIONS } from "@/lib/list-filters";
import { matchesAnyDiacritics } from "@/lib/moderation-terms";
import { hrefWith } from "@/lib/url";
import { cn } from "@/lib/utils";

type ActionFilter = ModerationTermAction | "ALL";

const ACTION_FILTERS = statusTabs(TERM_ACTIONS, TERM_ACTION_LABELS);

/** Status colours, read as what a match does: waits for a person, is refused, or is let through. */
const ACTION_STYLES: Record<ModerationTermAction, string> = {
  HOLD: "border-pending/25 bg-pending-bg text-pending",
  REJECT: "border-danger/25 bg-danger-bg text-danger",
  EXEMPT: "border-line bg-neutral-bg text-neutral",
};

const COLUMNS = 5;

export function TermsTable({
  terms,
  handles,
  query,
  action,
  now,
}: {
  terms: ModerationTermResponse[];
  /** adminId → @handle, for "Added by". */
  handles: Record<string, string>;
  query: string;
  action: ActionFilter;
  /** The page's clock — the mock one in mock mode — so "2h ago" agrees with the fixtures. */
  now: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [navigating, startNavigation] = useTransition();
  // Here rather than on the row: a removed term leaves the list, and its row with it.
  const [notice, setNotice] = useState<string | null>(null);

  function go(term: string, next: ActionFilter) {
    const href = hrefWith(pathname, params, {
      q: term || null,
      action: next === "ALL" ? null : next,
      page: null,
    });
    // Kept in place: the list sits under the form and the preview, and a filter that jumped to the
    // top of the page would leave the rows it just filtered out of sight.
    startNavigation(() => router.replace(href as never, { scroll: false }));
  }

  const filtered = Boolean(query) || action !== "ALL";

  return (
    <Card>
      <CardHeader
        title="Admin terms"
        hint="Live terms, newest first. A removal reaches every service within a minute. Changes are not in the Audit Log — this list, with who added each term, is the record."
        actions={
          <>
            <SearchBox query={query} onCommit={(term) => go(term, action)} placeholder="Search terms..." />
            <Segmented options={ACTION_FILTERS} value={action} onChange={(next) => go(query, next)} />
          </>
        }
      />

      {notice ? (
        <p className="border-b border-line px-5 py-2 text-[12px] text-ink-soft">{notice}</p>
      ) : null}

      <div className={cn("overflow-x-auto transition-opacity", navigating && "opacity-50")}>
        <table className="w-full border-collapse text-[13px] xl:min-w-[760px]">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="label px-5 py-3 text-ink-soft">Term</th>
              <th className="label px-3 py-3 text-ink-soft">Action</th>
              <th className="label px-3 py-3 text-ink-soft">Category</th>
              <th className="label px-3 py-3 text-ink-soft">Added</th>
              <th className="label px-5 py-3 text-right text-ink-soft">Remove</th>
            </tr>
          </thead>
          <tbody>
            {terms.map((term) => (
              <TermRow
                key={term.id}
                term={term}
                addedBy={handles[term.createdBy]}
                now={now}
                onRemoved={setNotice}
              />
            ))}

            {terms.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS} className="px-5 py-10 text-center text-ink-faint">
                  {filtered
                    ? "No terms match this filter."
                    : "No admin terms yet — every service screens with the shipped list as it is."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function TermRow({
  term,
  addedBy,
  now,
  onRemoved,
}: {
  term: ModerationTermResponse;
  addedBy: string | undefined;
  now: number;
  onRemoved: (message: string) => void;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();
  const exempt = term.action === "EXEMPT";

  function remove() {
    startSubmit(async () => {
      const outcome = await removeTermAction(term.id, term.term, term.action);
      if (outcome.ok) {
        onRemoved(outcome.message);
        router.refresh();
      } else {
        setFailure(outcome.message);
      }
    });
  }

  return (
    <>
      <tr className="border-b border-line align-top last:border-b-0">
        <td className="px-5 py-3">
          <span className="font-medium wrap-anywhere">{term.term}</span>
          <span className="ml-2 text-[11px] text-ink-faint">
            {matchesAnyDiacritics(term.term) ? "any diacritics" : "exact diacritics"}
          </span>
          {term.note ? (
            <p className="mt-0.5 max-w-[420px] text-[12px] text-ink-soft wrap-anywhere">{term.note}</p>
          ) : null}
        </td>
        <td className="px-3 py-3">
          <span
            className={cn(
              "inline-flex rounded-md border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
              ACTION_STYLES[term.action],
            )}
          >
            {TERM_ACTION_LABELS[term.action]}
          </span>
        </td>
        <td className="px-3 py-3 whitespace-nowrap">
          {term.category ? (
            categoryLabel(term.category)
          ) : (
            <span className="text-ink-faint" title="An exempted term flags nothing">
              —
            </span>
          )}
        </td>
        <td className="px-3 py-3 whitespace-nowrap text-ink-soft" title={formatDateTime(term.createdAt)}>
          {addedBy ?? <span className="figure">#{term.createdBy.slice(-6)}</span>}
          <span className="text-ink-faint"> · {relativeTime(term.createdAt, now)}</span>
        </td>
        <td className="px-5 py-3 text-right">
          <button
            type="button"
            disabled={confirming}
            onClick={() => {
              setConfirming(true);
              setFailure(null);
            }}
            aria-label={`Remove ${term.term}`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[12px] transition-colors",
              confirming ? "cursor-not-allowed text-ink-faint" : "text-danger hover:bg-surface",
            )}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
        </td>
      </tr>

      {confirming ? (
        <tr className="border-b border-line bg-surface-muted">
          <td colSpan={COLUMNS} className="px-5 py-3">
            <p className="mb-2 text-[12px] text-ink-soft">
              {exempt
                ? `Remove the exemption? The shipped term “${term.term}” matches again within a minute.`
                : `Remove “${term.term}”? Every service stops matching it within a minute.`}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={remove}
                disabled={submitting}
                className="rounded-md bg-accent px-3 py-2 text-[12px] font-medium text-on-accent transition-colors hover:bg-accent-strong disabled:opacity-40"
              >
                {submitting ? "Submitting..." : "Confirm removal"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-md border border-line bg-surface px-3 py-2 text-[12px] transition-colors hover:bg-canvas"
              >
                Cancel
              </button>
            </div>
            {failure ? <p className="mt-2 text-[12px] text-ink-soft">{failure}</p> : null}
          </td>
        </tr>
      ) : null}
    </>
  );
}
