"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gavel } from "lucide-react";
import { reportTargetDetailAction, resolveQueueAction } from "@/app/(admin)/moderation/reports/actions";
import { TargetBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, RowDetail, expandableRowProps } from "@/components/ui/row-detail";
import { ModerationHistory } from "@/components/moderation/moderation-history";
import { ResolveForm } from "@/components/moderation/resolve-form";
import { TargetPreviewLine } from "@/components/moderation/target-preview-line";
import { VideoThumb } from "@/components/videos/video-thumb";
import type { ModerationActionType, ReportGroupResponse } from "@/lib/api/types";
import { formatDateTime, relativeTime } from "@/lib/format";
import { NO_NAMES, targetName, type RowNames } from "@/lib/names";
import { useBelowXl } from "@/lib/use-below-xl";
import { useRowDetail } from "@/lib/use-row-detail";
import { cn } from "@/lib/utils";

const COLUMNS = 6;

/**
 * Severity is 1–10 and means nothing to read as a number mid-scan. Three bands, so a row is
 * either something to open now, something to get to, or something that can wait.
 */
function severityBand(severity: number) {
  if (severity >= 8) return { label: "Critical", className: "border-danger/25 bg-danger-bg text-danger" };
  if (severity >= 5) return { label: "High", className: "border-pending/25 bg-pending-bg text-pending" };
  return { label: "Routine", className: "border-line bg-neutral-bg text-neutral" };
}

/**
 * The moderation worklist: one row per reported target, not per report.
 *
 * <p>No search, no sort, no status tabs — deliberately. The order is computed server-side across
 * the whole table (`reportCount × severity`, longest wait breaking ties) and only the rows that
 * won it are on this page, so a client-side sort could only reshuffle the top twenty-five and
 * hide the fact that the ranking already happened. Looking a specific report up is the report
 * ledger's job; this is the queue, and the queue's answer is "the next thing to decide".
 */
export function ReportQueueTable({
  groups,
  total,
  names = NO_NAMES,
}: {
  groups: ReportGroupResponse[];
  /** Every target waiting, not just the ones on this page. */
  total: number;
  /** Reported accounts and videos by name, resolved by the page in one batch each. */
  names?: RowNames;
}) {
  const belowXl = useBelowXl();

  return (
    <Card>
      <CardHeader
        title="Queue"
        hint={
          total > groups.length
            ? `Top ${groups.length} of ${total} targets waiting — ranked by report count × severity`
            : "One row per reported target, ranked by report count × severity. Deciding a row closes every report against it."
        }
      />

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px] xl:min-w-[880px]">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="label-caps px-5 py-3 text-ink-soft">Target</th>
              <th className="label-caps px-3 py-3 text-ink-soft">Reports</th>
              <th className="label-caps px-3 py-3 text-ink-soft">Severity</th>
              <th className="label-caps hidden px-3 py-3 text-ink-soft xl:table-cell">
                Latest reason
              </th>
              <th className="label-caps px-3 py-3 text-ink-soft">Waiting</th>
              <th className="label-caps px-5 py-3 text-right text-ink-soft">Actions</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <QueueRow
                key={`${group.targetType}:${group.targetId}`}
                group={group}
                names={names}
                belowXl={belowXl}
              />
            ))}

            {groups.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS} className="px-5 py-10 text-center text-ink-faint">
                  Nothing waiting. Every reported target has been decided.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function QueueRow({
  group,
  names,
  belowXl,
}: {
  group: ReportGroupResponse;
  names: RowNames;
  /** Below xl the reason column is dropped, so the expand row carries it instead. */
  belowXl: boolean;
}) {
  const router = useRouter();
  const detail = useRowDetail(() => reportTargetDetailAction(group.targetType, group.targetId));
  const [resolving, setResolving] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();

  const band = severityBand(group.severity);

  function submit(action: ModerationActionType, reason: string, banDays: number | null) {
    startSubmit(async () => {
      const outcome = await resolveQueueAction(
        group.targetType,
        group.targetId,
        action,
        reason,
        banDays,
      );
      setResult(outcome.message);
      if (outcome.ok) {
        setResolving(false);
        // The reports close synchronously, so one re-read drops this row off the queue. The
        // enforcement lands on the target's service later, which is what the returned message
        // says rather than a spinner that lies.
        router.refresh();
      }
    });
  }

  return (
    <Fragment>
      <tr
        {...expandableRowProps(detail.toggle, detail.open)}
        className="cursor-pointer border-b border-line transition-colors last:border-b-0 hover:bg-surface-muted"
      >
        <td className="py-3 pl-5 pr-3">
          {/* A poster frame for a reported video: the worklist is scanned, not read. */}
          <span className="inline-flex items-center gap-2.5">
            {group.targetType === "VIDEO" ? (
              <VideoThumb
                src={names.videos[group.targetId]?.thumbnailUrl ?? null}
                className="h-9 w-6"
              />
            ) : null}
            <TargetBadge
              type={group.targetType}
              id={group.targetId}
              name={targetName(names, group.targetType, group.targetId)}
            />
          </span>
        </td>
        <td className="figure px-3 py-3 whitespace-nowrap">
          {group.reportCount}
          <span className="ml-1 text-[11px] text-ink-faint">
            {group.reportCount === 1 ? "report" : "reports"}
          </span>
        </td>
        <td className="px-3 py-3">
          <span
            className={cn(
              "inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-medium",
              band.className,
            )}
          >
            {band.label}
          </span>
        </td>
        <td
          className="hidden max-w-[260px] truncate px-3 py-3 xl:table-cell"
          title={group.latestReason}
        >
          {group.latestReason}
        </td>
        {/* Since the first report, not the last: the oldest one is what has actually been left
            waiting, and it is the tie-break the server ranks by. */}
        <td className="px-3 py-3 whitespace-nowrap text-ink-faint">
          {relativeTime(group.firstReportedAt)}
        </td>
        <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => {
              setResolving((open) => !open);
              setResult(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[11px] transition-colors hover:bg-surface"
          >
            <Gavel className="h-3.5 w-3.5" />
            Decide
          </button>
        </td>
      </tr>

      {detail.open ? (
        <RowDetail colSpan={COLUMNS}>
          {belowXl ? (
            <Field label="Latest reason" wide>
              {group.latestReason}
            </Field>
          ) : null}
          <Field label="Target">
            {group.targetType} · {group.targetId}
          </Field>
          <Field label="First reported">{formatDateTime(group.firstReportedAt)}</Field>
          <Field label="Last reported">{formatDateTime(group.lastReportedAt)}</Field>
          <Field label="Rank">
            {group.reportCount} × severity {group.severity} = {group.priority}
          </Field>

          {/* What is actually being judged. A target with no preview is still worth showing as
              such: it means no endpoint will serve it back — a taken-down video, a deleted
              account — which is itself information a moderator needs before acting again. */}
          <Field label="Reported content" wide>
            <TargetPreviewLine
              preview={detail.data?.preview ?? null}
              loading={detail.loading}
              failed={detail.failed}
              missing="Not available — the target is not readable through the console (removed, private, or no longer there)."
            />
          </Field>

          <Field label="Moderation history" wide>
            <ModerationHistory
              reportCount={detail.data?.reportCount ?? null}
              actions={detail.data?.actions ?? null}
              handles={detail.data?.handles}
              loading={detail.loading}
              onRetry={detail.retry}
            />
          </Field>
        </RowDetail>
      ) : null}

      {resolving ? (
        <tr className="border-b border-line bg-surface-muted">
          <td colSpan={COLUMNS} className="px-5 py-3">
            <p className="mb-2 text-[11px] text-ink-faint">
              {group.reportCount === 1
                ? "Closes the one report against this target."
                : `Closes all ${group.reportCount} reports against this target.`}
            </p>
            <ResolveForm
              targetType={group.targetType}
              reporterReason={group.latestReason}
              submitting={submitting}
              onSubmit={submit}
              onCancel={() => setResolving(false)}
            />
          </td>
        </tr>
      ) : null}

      {result ? (
        <tr className="border-b border-line last:border-b-0">
          <td colSpan={COLUMNS} className="px-5 pb-3 text-[11px] text-ink-soft">
            {result}
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}
