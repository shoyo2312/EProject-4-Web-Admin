import type { ModerationActionResponse } from "@/lib/api/types";
import { formatDate } from "@/lib/format";

/**
 * The moderation trail for one user or video, shown inside an expanded table row: how many
 * reports stand against the target, then every recorded action newest-first. Purely presentational
 * — the parent row owns the fetch (a server action) and passes the result in.
 */
export function ModerationHistory({
  reportCount,
  actions,
  loading,
}: {
  reportCount: number | null;
  actions: ModerationActionResponse[] | null;
  loading: boolean;
}) {
  if (loading) {
    return <p className="text-[11px] text-ink-faint">Loading moderation history…</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-ink-soft">
        <span className="font-medium">{reportCount ?? 0}</span> report
        {reportCount === 1 ? "" : "s"} filed against this target
      </p>

      {actions && actions.length > 0 ? (
        <ul className="space-y-1">
          {actions.map((action) => (
            <li
              key={action.id}
              className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px]"
            >
              <span className="rounded border border-line bg-surface px-1.5 py-0.5 font-medium tracking-wide">
                {action.actionType}
              </span>
              <span className="text-ink-soft">{action.reason}</span>
              <span className="text-ink-faint">
                · admin #{action.adminId.slice(-6)} · {formatDate(action.createdAt)}
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
