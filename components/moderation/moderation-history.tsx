import type { ModerationActionResponse } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { ACTION_LABELS } from "@/lib/labels";

/**
 * The moderation trail for one user or video, shown inside an expanded table row: how many
 * reports stand against the target, then every recorded action newest-first. Purely presentational
 * — the parent row owns the fetch (a server action) and passes the result in.
 *
 * Null is "could not be read" and says so. Shown as zero reports and no actions, it read as a
 * clean record exactly when nothing had been checked.
 */
export function ModerationHistory({
  reportCount,
  actions,
  handles = {},
  loading,
  onRetry,
}: {
  reportCount: number | null;
  actions: ModerationActionResponse[] | null;
  /** adminId → @handle. An admin missing from it is shown by the tail of their id. */
  handles?: Record<string, string>;
  loading: boolean;
  /** Offered when neither half could be read. */
  onRetry?: () => void;
}) {
  if (loading) {
    return <p className="text-[11px] text-ink-faint">Loading moderation history…</p>;
  }

  if (reportCount === null && actions === null) {
    return (
      <p className="text-[11px] text-ink-faint">
        Couldn&apos;t load the moderation history.{" "}
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="underline underline-offset-4 hover:text-ink"
          >
            Try again
          </button>
        ) : null}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {reportCount === null ? (
        <p className="text-[11px] text-ink-faint">Couldn&apos;t count the reports against this target.</p>
      ) : (
        <p className="text-[11px] text-ink-soft">
          <span className="font-medium">{reportCount}</span> report
          {reportCount === 1 ? "" : "s"} filed against this target
        </p>
      )}

      {actions === null ? (
        <p className="text-[11px] text-ink-faint">Couldn&apos;t load the actions taken on it.</p>
      ) : actions.length > 0 ? (
        <ul className="space-y-1">
          {actions.map((action) => (
            <li
              key={action.id}
              className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px]"
            >
              <span className="rounded border border-line bg-surface px-1.5 py-0.5 font-medium">
                {ACTION_LABELS[action.actionType]}
              </span>
              <span className="text-ink-soft">{action.reason}</span>
              <span className="text-ink-faint">
                · by {handles[action.adminId] ?? `admin #${action.adminId.slice(-6)}`} ·{" "}
                {formatDateTime(action.createdAt)}
                {action.reportId ? ` · report #${action.reportId.slice(-6)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-ink-faint">No moderation actions recorded.</p>
      )}
    </div>
  );
}
