import Link from "next/link";
import type { UploaderRecord } from "@/app/(admin)/moderation/review/actions";
import { Card, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/row-detail";
import { UserStatusBadge } from "@/components/ui/status-badge";
import { formatCompact, formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Who uploaded the video and their record so far — a first upload and an account with three
 * takedowns are not the same call on the same score.
 */
export function UploaderPanel({
  ownerId,
  handle,
  record,
  failed,
  onRetry,
}: {
  ownerId: string;
  /** From the batch's one handle lookup, so the name shows before the record arrives. */
  handle: string | undefined;
  /** Null while it loads, and when it could not be loaded. */
  record: UploaderRecord | null;
  failed: boolean;
  onRetry: () => void;
}) {
  const name = record?.handle ? `@${record.handle}` : (handle ?? `#${ownerId.slice(-8)}`);
  const loading = !record && !failed;

  return (
    <Card>
      <CardHeader
        title="Uploader"
        hint="The account behind this upload and its record so far. A dash is a figure that could not be read, not a zero."
        actions={
          <Link
            href={`/users/${ownerId}` as never}
            className="text-[12px] text-ink-soft underline-offset-4 hover:underline"
          >
            Open account →
          </Link>
        }
      />
      <div className="space-y-3 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[14px] font-medium">{name}</span>
          {record?.status ? <UserStatusBadge status={record.status} dense /> : null}
          {record?.joinedAt ? (
            <span className="text-[12px] text-ink-faint">joined {formatDate(record.joinedAt)}</span>
          ) : null}
        </div>

        {failed ? (
          <p className="text-[12px] text-ink-faint">
            Couldn&apos;t load this account&apos;s record.{" "}
            <button
              type="button"
              onClick={onRetry}
              className="underline underline-offset-4 hover:text-ink"
            >
              Try again
            </button>
          </p>
        ) : (
          <dl className="grid grid-cols-3 gap-x-4 gap-y-2.5 text-[13px]">
            <Count label="Followers" value={record?.followers} loading={loading} compact />
            <Count label="Uploads" value={record?.uploads} loading={loading} />
            <Count label="Taken down" value={record?.takenDown} loading={loading} warn />
            <Count label="Auto-removed" value={record?.autoRemoved} loading={loading} warn />
            <Count label="Bans" value={record?.bans} loading={loading} warn />
            <Count label="Reports against" value={record?.reports} loading={loading} warn />
          </dl>
        )}
      </div>
    </Card>
  );
}

function Count({
  label,
  value,
  loading,
  compact,
  warn,
}: {
  label: string;
  value: number | null | undefined;
  loading: boolean;
  compact?: boolean;
  /** Anything above zero is part of a record worth noticing. */
  warn?: boolean;
}) {
  return (
    <Field label={label}>
      {loading ? (
        <span className="text-ink-faint">…</span>
      ) : value == null ? (
        <span className="text-ink-faint">—</span>
      ) : (
        <span className={cn("figure", warn && value > 0 && "text-danger")}>
          {compact ? formatCompact(value) : formatNumber(value)}
        </span>
      )}
    </Field>
  );
}
