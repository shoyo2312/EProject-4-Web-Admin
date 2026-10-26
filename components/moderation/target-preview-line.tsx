import Link from "next/link";
import type { TargetPreview } from "@/lib/api/previews";

/**
 * What a report or an audit row points at, in one line: a video title, a @handle or the comment
 * text, with a link to open it. Shared by the report queue, the report ledger and the audit log.
 *
 * Two kinds of nothing, told apart: a target the lookup answered for but cannot read back — a
 * taken-down video, a deleted account, which a moderator needs to know before acting again — and a
 * lookup that never answered, which says nothing about the target at all.
 */
export function TargetPreviewLine({
  preview,
  loading,
  failed,
  missing,
  onRetry,
}: {
  preview: TargetPreview | null;
  loading: boolean;
  /** The lookup itself failed. */
  failed: boolean;
  /** What to say when the lookup answered and the target cannot be read back. */
  missing: string;
  onRetry?: () => void;
}) {
  if (loading) return <span className="text-ink-faint">Loading target…</span>;

  if (failed) {
    return (
      <span className="text-ink-faint">
        Couldn&apos;t load the target.{" "}
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="underline underline-offset-4 hover:text-ink"
          >
            Try again
          </button>
        ) : null}
      </span>
    );
  }

  if (!preview) return <span className="text-ink-faint">{missing}</span>;

  return (
    <span className="flex flex-wrap items-baseline gap-x-2">
      <span>{preview.title}</span>
      {preview.detail ? (
        <span className="text-[12px] text-ink-faint">· {preview.detail}</span>
      ) : null}
      {preview.href ? (
        <Link
          href={preview.href as never}
          className="text-[12px] text-ink-soft underline-offset-4 hover:underline"
        >
          open →
        </Link>
      ) : null}
    </span>
  );
}
