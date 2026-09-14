"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, Gavel, Search } from "lucide-react";
import {
  reportTargetDetailAction,
  resolveReportAction,
  type ReportTargetDetail,
} from "@/app/(admin)/moderation/reports/actions";
import { StatusBadge, TargetBadge } from "@/components/ui/badge";
import { Card, CardHeader, CardMenuButton } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Field, RowDetail, expandableRowProps } from "@/components/ui/row-detail";
import { ModerationHistory } from "@/components/moderation/moderation-history";
import type {
  ModerationActionType,
  ReportResponse,
  ReportStatus,
  ReportTargetType,
} from "@/lib/api/types";
import { MOCK_REPORTER_HANDLES } from "@/lib/mock/moderation";
import { formatDate, relativeTime, shortId } from "@/lib/format";
import { useBelowXl } from "@/lib/use-below-xl";
import { cn } from "@/lib/utils";

type StatusFilter = ReportStatus | "ALL";
type SortKey = "id" | "target" | "status" | "createdAt";

const COLUMNS = 7;

const STATUS_FILTERS = [
  { value: "ALL" as const, label: "All" },
  { value: "PENDING" as const, label: "Pending" },
  { value: "RESOLVED" as const, label: "Resolved" },
  { value: "DISMISSED" as const, label: "Dismissed" },
];

/**
 * What a moderator may decide about each kind of target. Narrower than ModerationActionType on
 * purpose: resolving a report copies the report's own targetType onto the action, so offering
 * BAN_USER against a VIDEO would write an audit row no consumer can apply. RESTORE_VIDEO and
 * UNBAN_USER are absent for the same reason — a report is never the thing that undoes an action.
 */
const ACTIONS_BY_TARGET: Record<
  ReportTargetType,
  readonly { value: ModerationActionType; label: string }[]
> = {
  VIDEO: [
    { value: "TAKEDOWN_VIDEO", label: "Take down video" },
    { value: "DISMISS_REPORT", label: "Dismiss report" },
  ],
  COMMENT: [
    { value: "REMOVE_COMMENT", label: "Remove comment" },
    { value: "DISMISS_REPORT", label: "Dismiss report" },
  ],
  USER: [
    { value: "BAN_USER", label: "Ban account" },
    { value: "WARN_USER", label: "Warn account" },
    { value: "DISMISS_REPORT", label: "Dismiss report" },
  ],
};

/**
 * Preset reasons. What ends up in the audit row is this exact string and nothing else, so they are
 * written to read on their own months later. Shortcuts, not a closed list: a preset fills the box
 * and the box stays editable — that is also the "other" case, no second mode to switch into.
 */
const ENFORCE_PRESETS = [
  "Confirmed the reported violation",
  "Repeat offence after an earlier warning",
  "Spam or scam — coordinated posting",
  "Sexual content",
  "Harassment of a named person",
] as const;

const DISMISS_PRESETS = [
  "Reviewed — no policy violation",
  "Duplicate of an earlier report on the same target",
  "Already actioned under another report",
  "Not enough in the report to act on",
] as const;

export function ReportsTable({
  reports,
  limit,
  footerHref,
}: {
  reports: ReportResponse[];
  /** Dashboard shows a slice; the Reports Queue page shows everything. */
  limit?: number;
  footerHref?: string;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({
    key: "createdAt",
    asc: false,
  });
  const belowXl = useBelowXl();

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = reports.filter((report) => {
      if (status !== "ALL" && report.status !== status) return false;
      if (!needle) return true;
      const handle = MOCK_REPORTER_HANDLES[report.reporterId] ?? "";
      return (
        report.id.includes(needle) ||
        report.targetId.includes(needle) ||
        report.targetType.toLowerCase().includes(needle) ||
        report.reason.toLowerCase().includes(needle) ||
        handle.toLowerCase().includes(needle)
      );
    });

    const direction = sort.asc ? 1 : -1;
    const sorted = [...filtered].sort((a, b) => {
      switch (sort.key) {
        case "id":
          return a.id.localeCompare(b.id) * direction;
        case "target":
          return a.targetType.localeCompare(b.targetType) * direction;
        case "status":
          return a.status.localeCompare(b.status) * direction;
        default:
          return a.createdAt.localeCompare(b.createdAt) * direction;
      }
    });

    return limit ? sorted.slice(0, limit) : sorted;
  }, [reports, query, status, sort, limit]);

  return (
    <Card>
      <CardHeader
        title="Reports Queue"
        hint="GET /api/v1/admin/reports — resolve writes a moderation action and emits a Kafka event"
        actions={
          <>
            <label className="flex w-[180px] items-center gap-2 rounded-lg border border-line bg-surface-muted px-2.5 py-1.5 lg:w-[240px]">
              <Search className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search reports..."
                className="min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:text-ink-faint"
              />
            </label>
            <Segmented
              options={STATUS_FILTERS}
              value={status}
              onChange={setStatus}
            />
            <CardMenuButton />
          </>
        }
      />

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px] xl:min-w-[880px]">
          <thead>
            <tr className="border-b border-line text-left">
              <SortableHeader
                label="ID"
                sortKey="id"
                sort={sort}
                onSort={setSort}
                className="hidden pl-5 xl:table-cell"
              />
              <th className="label-caps hidden px-3 py-3 text-ink-soft xl:table-cell">Reporter</th>
              <SortableHeader
                label="Target"
                sortKey="target"
                sort={sort}
                onSort={setSort}
                className="pl-5 xl:pl-3"
              />
              <th className="label-caps hidden px-3 py-3 text-ink-soft xl:table-cell">Reason</th>
              <SortableHeader
                label="Status"
                sortKey="status"
                sort={sort}
                onSort={setSort}
              />
              <SortableHeader
                label="Created"
                sortKey="createdAt"
                sort={sort}
                onSort={setSort}
              />
              <th className="label-caps px-5 py-3 text-right text-ink-soft">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((report) => (
              <ReportRow key={report.id} report={report} belowXl={belowXl} />
            ))}

            {rows.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS} className="px-5 py-10 text-center text-ink-faint">
                  No reports match this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {footerHref ? (
        <div className="border-t border-line px-5 py-3 text-right">
          <Link
            href={footerHref as never}
            className="text-[11px] text-ink-soft underline-offset-4 hover:underline"
          >
            View full queue →
          </Link>
        </div>
      ) : null}
    </Card>
  );
}

function ReportRow({
  report,
  belowXl,
}: {
  report: ReportResponse;
  /** Below xl the secondary columns are dropped, so the expand row carries them instead. */
  belowXl: boolean;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState(false);
  const [target, setTarget] = useState<ReportTargetDetail | null>(null);
  const [targetLoading, setTargetLoading] = useState(false);
  /** Null while the resolve form is closed; the chosen action once it is open. */
  const [action, setAction] = useState<ModerationActionType | null>(null);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();

  const pending = report.status === "PENDING";
  const choices = ACTIONS_BY_TARGET[report.targetType];
  const reporter = MOCK_REPORTER_HANDLES[report.reporterId]
    ? `@${MOCK_REPORTER_HANDLES[report.reporterId]}`
    : `#${report.reporterId.slice(-6)}`;

  function toggleDetail() {
    const opening = !detail;
    setDetail(opening);
    // Fetched once per row and kept: what a report points at does not change while the admin
    // scans the queue, and re-fetching on every toggle would be three calls per click.
    if (opening && !target && !targetLoading) {
      setTargetLoading(true);
      reportTargetDetailAction(report.targetType, report.targetId)
        .then(setTarget)
        .finally(() => setTargetLoading(false));
    }
  }

  function submit() {
    if (!action) return;
    startSubmit(async () => {
      const outcome = await resolveReportAction(report.id, action, reason);
      setResult(outcome.message);
      if (outcome.ok) {
        setAction(null);
        // The report's own status is written synchronously, so one re-read shows it. The
        // enforcement it triggers lands on the target's service later, which is what the
        // returned message says rather than a spinner that lies.
        router.refresh();
      }
    });
  }

  const presets = action === "DISMISS_REPORT" ? DISMISS_PRESETS : ENFORCE_PRESETS;

  return (
    <Fragment>
      <tr
        {...expandableRowProps(toggleDetail, detail)}
        className={cn(
          "cursor-pointer border-b border-line transition-colors last:border-b-0 hover:bg-surface-muted",
          // Closed reports recede — the queue is about what still needs work
          !pending && "text-ink-faint",
        )}
      >
        <td className="figure hidden py-3 pl-5 pr-3 whitespace-nowrap xl:table-cell">
          #{shortId(report.id.slice(-8), 8)}
        </td>
        <td className="hidden px-3 py-3 whitespace-nowrap xl:table-cell">
          {/* Live data carries only a reporterId — user-service has no batch
              handle lookup yet, so fall back to the id tail. */}
          {reporter}
        </td>
        <td className="py-3 pl-5 pr-3 whitespace-nowrap xl:pl-3">
          <TargetBadge type={report.targetType} id={report.targetId} />
        </td>
        <td className="hidden max-w-[260px] truncate px-3 py-3 xl:table-cell" title={report.reason}>
          {report.reason}
        </td>
        <td className="px-3 py-3">
          <StatusBadge status={report.status} />
        </td>
        <td className="px-3 py-3 whitespace-nowrap text-ink-faint">
          {relativeTime(report.createdAt)}
        </td>
        <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
          {pending ? (
            <button
              type="button"
              onClick={() => {
                if (action !== null) {
                  setAction(null);
                  return;
                }
                setAction(choices[0].value);
                setReason("");
                setResult(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[11px] transition-colors hover:bg-surface"
            >
              <Gavel className="h-3.5 w-3.5" />
              Resolve
            </button>
          ) : (
            <span className="text-[11px] text-ink-faint">
              {report.resolvedAt ? relativeTime(report.resolvedAt) : "closed"}
            </span>
          )}
        </td>
      </tr>

      {detail ? (
        <RowDetail colSpan={COLUMNS}>
          {/* The columns the table drops below xl, so nothing is unreachable on a narrow screen. */}
          {belowXl ? (
            <>
              <Field label="Report ID">#{report.id.slice(-12)}</Field>
              <Field label="Reporter">{reporter}</Field>
              <Field label="Reason" wide>
                {report.reason}
              </Field>
            </>
          ) : null}
          <Field label="Target">
            {report.targetType} · {report.targetId}
          </Field>
          <Field label="Created">{formatDate(report.createdAt)}</Field>
          {report.resolvedBy ? (
            <Field label="Resolved by">#{report.resolvedBy.slice(-8)}</Field>
          ) : null}
          {report.resolvedAt ? (
            <Field label="Resolved at">{formatDate(report.resolvedAt)}</Field>
          ) : null}

          {/* What is actually being judged. A target with no preview is still worth showing as
              such: it means no endpoint will serve it back — a taken-down video, a deleted
              account — which is itself information a moderator needs before acting again. */}
          <Field label="Reported content" wide>
            {targetLoading && !target ? (
              <span className="text-ink-faint">Loading target…</span>
            ) : target?.preview ? (
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span>{target.preview.title}</span>
                {target.preview.detail ? (
                  <span className="text-[11px] text-ink-faint">· {target.preview.detail}</span>
                ) : null}
                {target.preview.href ? (
                  <Link
                    href={target.preview.href as never}
                    className="text-[11px] text-ink-soft underline-offset-4 hover:underline"
                  >
                    open →
                  </Link>
                ) : null}
              </span>
            ) : (
              <span className="text-ink-faint">
                Not available — the target is not readable through the console (removed, private,
                or no longer there).
              </span>
            )}
          </Field>

          <Field label="Moderation history" wide>
            <ModerationHistory
              reportCount={target?.reportCount ?? null}
              actions={target?.actions ?? null}
              loading={targetLoading && !target}
            />
          </Field>
        </RowDetail>
      ) : null}

      {action !== null ? (
        <tr className="border-b border-line bg-surface-muted">
          <td colSpan={COLUMNS} className="px-5 py-3">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {choices.map((choice) => (
                <button
                  key={choice.value}
                  type="button"
                  aria-pressed={action === choice.value}
                  onClick={() => setAction(choice.value)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-[11px] transition-colors",
                    action === choice.value
                      ? "border-ink bg-ink text-surface"
                      : "border-line bg-surface text-ink-soft hover:bg-canvas",
                  )}
                >
                  {choice.label}
                </button>
              ))}
            </div>

            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {/* The reporter's own words first, for an enforcement: most of them agree with the
                  report, and retyping what it already says is how audit rows end up saying "spam". */}
              {(action === "DISMISS_REPORT"
                ? [...presets]
                : [report.reason, ...presets]
              ).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={reason === preset}
                  // Clicking the highlighted chip is how an admin says "not that one", so it
                  // clears the box rather than putting back what they just rejected.
                  onClick={() => setReason((current) => (current === preset ? "" : preset))}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                    reason === preset
                      ? "border-ink bg-ink text-surface"
                      : "border-line bg-surface text-ink-soft hover:bg-canvas",
                  )}
                >
                  {preset}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setReason("")}
                className="rounded-full border border-dashed border-line px-2.5 py-1 text-[11px] text-ink-faint transition-colors hover:bg-canvas"
              >
                Other…
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason — the audit row is this string and nothing else, so write what you saw"
                className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-[11px] outline-none placeholder:text-ink-faint"
              />
              <button
                type="button"
                onClick={submit}
                disabled={submitting || !reason.trim()}
                className="rounded-md bg-ink px-3 py-2 text-[11px] text-surface transition-opacity hover:opacity-85 disabled:opacity-40"
              >
                {submitting
                  ? "Submitting..."
                  : action === "DISMISS_REPORT"
                    ? "Confirm dismissal"
                    : "Confirm action"}
              </button>
              <button
                type="button"
                onClick={() => setAction(null)}
                className="rounded-md border border-line bg-surface px-3 py-2 text-[11px] transition-colors hover:bg-canvas"
              >
                Cancel
              </button>
            </div>
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

function SortableHeader({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; asc: boolean };
  onSort: (sort: { key: SortKey; asc: boolean }) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;
  return (
    <th className={cn("px-3 py-3", className)}>
      <button
        type="button"
        onClick={() => onSort({ key: sortKey, asc: active ? !sort.asc : false })}
        className={cn(
          "label-caps flex items-center gap-1 transition-colors hover:text-ink",
          active ? "text-ink" : "text-ink-soft",
        )}
      >
        {label}
        <ChevronsUpDown className="h-3 w-3" />
      </button>
    </th>
  );
}
