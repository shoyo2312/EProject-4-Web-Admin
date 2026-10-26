import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/row-detail";
import type { DataExportSummaryResponse } from "@/lib/api/types";
import { type DataExportHealth, dataExportHealth, dataExportScope } from "@/lib/data-exports";
import { formatDateTime, formatNumber, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const HEALTH_STYLES: Record<DataExportHealth["tone"], string> = {
  ok: "border-success/25 bg-success-bg text-success",
  warn: "border-pending/25 bg-pending-bg text-pending",
  bad: "border-danger/25 bg-danger-bg text-danger",
};

const COLUMNS = 5;

/**
 * "Download your data" as user-service's worker gets through it: what is waiting, what is stuck,
 * what is taking space, and what it gave up on — with who asked, so a failure can be followed up.
 */
export function DataExportCard({
  summary,
  handles,
  now,
}: {
  summary: DataExportSummaryResponse;
  /** userId → @handle for the failures. */
  handles: Record<string, string>;
  /** The page's clock — the mock one in mock mode — so "2h ago" agrees with the fixtures. */
  now: number;
}) {
  const health = dataExportHealth(summary);

  return (
    <Card>
      <CardHeader
        title="Download your data"
        hint="Archives user-service builds in the background when an owner asks for a copy of their data. A failed build is retried after a 10-minute lease and given up on after 3 attempts; a ready file is kept 4 days."
        actions={
          <span
            className={cn(
              "inline-flex rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
              HEALTH_STYLES[health.tone],
            )}
          >
            {health.text}
          </span>
        }
      />

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 border-b border-line px-5 py-4 text-[13px] xl:grid-cols-4">
        <Field label="Processing">
          <span className="figure">{formatNumber(summary.processing)}</span>
          {summary.oldestProcessingSince ? (
            <span className="text-ink-faint" title={formatDateTime(summary.oldestProcessingSince)}>
              {" "}
              · oldest {relativeTime(summary.oldestProcessingSince, now)}
            </span>
          ) : null}
        </Field>
        <Field label="Stalled">
          <span className={cn("figure", summary.stalled > 0 && "text-danger")}>
            {formatNumber(summary.stalled)}
          </span>
          <span className="text-ink-faint"> — waiting over 30 minutes</span>
        </Field>
        <Field label="Ready files">
          <span className="figure">{formatNumber(summary.readyFiles)}</span>
          <span className="text-ink-faint"> in MinIO</span>
        </Field>
        <Field label="Failed">
          <span className={cn("figure", summary.failed > 0 && "text-pending")}>
            {formatNumber(summary.failed)}
          </span>
          <span className="text-ink-faint"> in 7 days</span>
        </Field>
      </dl>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px] xl:min-w-[760px]">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="label px-5 py-3 text-ink-soft">Account</th>
              <th className="label px-3 py-3 text-ink-soft">Asked for</th>
              <th className="label px-3 py-3 text-ink-soft">Attempts</th>
              <th className="label px-3 py-3 text-ink-soft">Requested</th>
              <th className="label px-5 py-3 text-ink-soft">Failed</th>
            </tr>
          </thead>
          <tbody>
            {summary.recentFailures.map((failure) => (
              <tr key={failure.id} className="border-b border-line align-top last:border-b-0">
                <td className="px-5 py-3">
                  <Link href={`/users/${failure.userId}` as never} className="font-medium hover:underline">
                    {handles[failure.userId] ?? <span className="figure">#{failure.userId.slice(-6)}</span>}
                  </Link>
                </td>
                <td className="px-3 py-3 text-ink-soft">
                  {dataExportScope(failure.categories)}
                  <span className="text-ink-faint"> · {failure.format}</span>
                </td>
                <td className="figure px-3 py-3">{failure.attempts}</td>
                <td className="px-3 py-3 whitespace-nowrap text-ink-soft" title={formatDateTime(failure.requestedAt)}>
                  {relativeTime(failure.requestedAt, now)}
                </td>
                <td className="px-5 py-3 whitespace-nowrap text-ink-soft" title={formatDateTime(failure.failedAt)}>
                  {relativeTime(failure.failedAt, now)}
                </td>
              </tr>
            ))}

            {summary.recentFailures.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS} className="px-5 py-10 text-center text-ink-faint">
                  No failed requests in the last 7 days.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
