"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import { ResolveForm } from "@/components/moderation/resolve-form";
import type { ReportSortField } from "@/lib/moderation";
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
type TargetFilter = ReportTargetType | "ALL";

/**
 * What the server was asked for, echoed back so the controls can show it. Present only where
 * the ledger is paged and the backend does the narrowing; the dashboard's eight-row card passes
 * nothing and draws no controls, because there is nothing there worth filtering.
 */
export interface ReportsFilter {
  status: StatusFilter;
  targetType: TargetFilter;
  sort: ReportSortField;
  ascending: boolean;
}

const COLUMNS = 7;

const STATUS_FILTERS = [
  { value: "ALL" as const, label: "All" },
  { value: "PENDING" as const, label: "Pending" },
  { value: "RESOLVED" as const, label: "Resolved" },
  { value: "DISMISSED" as const, label: "Dismissed" },
];

const TARGET_FILTERS = [
  { value: "ALL" as const, label: "Any" },
  { value: "VIDEO" as const, label: "Videos" },
  { value: "USER" as const, label: "Accounts" },
  { value: "COMMENT" as const, label: "Comments" },
];

export function ReportsTable({
  reports,
  title = "Reports Queue",
  limit,
  footerHref,
  filter,
}: {
  reports: ReportResponse[];
  /** The ledger sits under the real queue on the Reports page, where both titles would read alike. */
  title?: string;
  /** Dashboard shows a slice; the Reports Queue page shows everything. */
  limit?: number;
  footerHref?: string;
  /**
   * Given by a page that fetched this ledger filtered and ordered server-side. It turns the
   * controls on — they write to the URL and the next render is a fresh query. Without it the
   * table is a read-only card: a status tab over one page would claim to be a platform total.
   */
  filter?: ReportsFilter;
}) {
  const belowXl = useBelowXl();
  const [query, setQuery] = useState("");

  /**
   * Status, target and ordering are the server's answer already. The box is the one control
   * that cannot be: admin-service's listing takes no search term, so this narrows the rows on
   * screen and says so — hence "on this page" rather than "Search reports", which is what a
   * moderator would reasonably read as "in the ledger".
   *
   * ponytail: a `q` on `GET /api/v1/admin/reports` matching the reason and the target id is
   * what would make it a real search. Worth it the first time someone has to find one report
   * by id across pages.
   */
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matching = needle
      ? reports.filter((report) => {
          const handle = MOCK_REPORTER_HANDLES[report.reporterId] ?? "";
          return (
            report.id.includes(needle)
            || report.targetId.includes(needle)
            || report.targetType.toLowerCase().includes(needle)
            || report.reason.toLowerCase().includes(needle)
            || handle.toLowerCase().includes(needle)
          );
        })
      : reports;
    return limit ? matching.slice(0, limit) : matching;
  }, [reports, query, limit]);

  return (
    <Card>
      <CardHeader
        title={title}
        hint="GET /api/v1/admin/reports — resolve writes a moderation action and emits a Kafka event"
        actions={
          filter ? (
            <>
              <label className="flex w-[180px] items-center gap-2 rounded-lg border border-line bg-surface-muted px-2.5 py-1.5 lg:w-[240px]">
                <Search className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter rows on this page..."
                  className="min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:text-ink-faint"
                />
              </label>
              <LedgerControls filter={filter} />
            </>
          ) : (
            <CardMenuButton />
          )
        }
      />

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px] xl:min-w-[880px]">
          <thead>
            <tr className="border-b border-line text-left">
              <SortableHeader
                label="ID"
                sortKey="id"
                filter={filter}
                className="hidden pl-5 xl:table-cell"
              />
              <th className="label-caps hidden px-3 py-3 text-ink-soft xl:table-cell">Reporter</th>
              <SortableHeader
                label="Target"
                sortKey="targetType"
                filter={filter}
                className="pl-5 xl:pl-3"
              />
              <th className="label-caps hidden px-3 py-3 text-ink-soft xl:table-cell">Reason</th>
              <SortableHeader label="Status" sortKey="status" filter={filter} />
              <SortableHeader label="Created" sortKey="createdAt" filter={filter} />
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
  const [resolving, setResolving] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();

  const pending = report.status === "PENDING";
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

  function submit(action: ModerationActionType, reason: string) {
    startSubmit(async () => {
      const outcome = await resolveReportAction(report.id, action, reason);
      setResult(outcome.message);
      if (outcome.ok) {
        setResolving(false);
        // The report's own status is written synchronously, so one re-read shows it. The
        // enforcement it triggers lands on the target's service later, which is what the
        // returned message says rather than a spinner that lies.
        router.refresh();
      }
    });
  }

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
                setResolving((open) => !open);
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

      {resolving ? (
        <tr className="border-b border-line bg-surface-muted">
          <td colSpan={COLUMNS} className="px-5 py-3">
            <ResolveForm
              targetType={report.targetType}
              reporterReason={report.reason}
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

/**
 * The status and target tabs, as navigation.
 *
 * No Suspense boundary around the `useSearchParams` here, unlike `Pager` and `PageHeader`: this
 * table only ever renders inside a page that already awaits `searchParams` and is therefore
 * dynamic, so a boundary buys no static generation — and one placed here does not hydrate at
 * all, leaving tabs that render but never navigate. The directory tables call the hook the same
 * bare way, for the same reason.
 */
function LedgerControls({ filter }: { filter: ReportsFilter }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [navigating, startNavigation] = useTransition();

  function go(next: URLSearchParams) {
    // Back to page one: page 3 of the previous result set is not page 3 of this one, and is
    // usually past its end.
    next.delete("page");
    const query = next.toString();
    startNavigation(() =>
      router.replace((query ? `${pathname}?${query}` : pathname) as never),
    );
  }

  /** Built from the current params, so changing one control never drops the others. */
  function withParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    return next;
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", navigating && "opacity-50")}>
      <Segmented
        options={TARGET_FILTERS}
        value={filter.targetType}
        onChange={(value) => go(withParam("target", value === "ALL" ? null : value))}
      />
      <Segmented
        options={STATUS_FILTERS}
        value={filter.status}
        onChange={(value) => go(withParam("status", value === "ALL" ? null : value))}
      />
    </div>
  );
}

/**
 * A plain header when the table has no `filter`, and a navigating one when it does. Sorting a
 * page client-side could only reorder the twenty-five rows that already won, which is a
 * different list from "the oldest reports on the platform" while looking exactly like it.
 */
function SortableHeader({
  label,
  sortKey,
  filter,
  className,
}: {
  label: string;
  sortKey: ReportSortField;
  filter?: ReportsFilter;
  className?: string;
}) {
  if (!filter) {
    return (
      <th className={cn("label-caps px-3 py-3 text-ink-soft", className)}>{label}</th>
    );
  }
  return (
    <th
      className={cn("px-3 py-3", className)}
      aria-sort={
        filter.sort === sortKey
          ? filter.ascending
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      <SortButton label={label} sortKey={sortKey} filter={filter} />
    </th>
  );
}

function SortButton({
  label,
  sortKey,
  filter,
}: {
  label: string;
  sortKey: ReportSortField;
  filter: ReportsFilter;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const active = filter.sort === sortKey;

  function toggle() {
    const next = new URLSearchParams(params);
    next.delete("page");
    next.set("sort", sortKey);
    // A fresh column starts descending — newest, highest, last — and only clicking the column
    // that is already active flips it.
    if (active && !filter.ascending) next.set("dir", "asc");
    else next.delete("dir");
    const query = next.toString();
    router.replace((query ? `${pathname}?${query}` : pathname) as never);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "label-caps flex items-center gap-1 transition-colors hover:text-ink",
        active ? "text-ink" : "text-ink-soft",
      )}
    >
      {label}
      <ChevronsUpDown className="h-3 w-3" />
    </button>
  );
}
