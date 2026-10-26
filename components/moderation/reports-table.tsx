"use client";

import { Fragment, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Gavel } from "lucide-react";
import { reportTargetDetailAction, resolveReportAction } from "@/app/(admin)/moderation/reports/actions";
import { StatusBadge, TargetBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { SearchBox } from "@/components/ui/search-box";
import { SortableHeader } from "@/components/ui/sortable-header";
import { Segmented } from "@/components/ui/segmented";
import { Field, RowDetail, expandableRowProps } from "@/components/ui/row-detail";
import { ModerationHistory } from "@/components/moderation/moderation-history";
import { ResolveForm } from "@/components/moderation/resolve-form";
import { TargetPreviewLine } from "@/components/moderation/target-preview-line";
import type { ReportSortField } from "@/lib/list-filters";
import type {
  ModerationActionType,
  ReportResponse,
  ReportStatus,
  ReportTargetType,
} from "@/lib/api/types";
import { formatDateTime, relativeTime, shortId } from "@/lib/format";
import { REPORT_STATUS_LABELS, statusTabs } from "@/lib/labels";
import { NO_NAMES, targetName, type RowNames } from "@/lib/names";
import { hrefWith } from "@/lib/url";
import { useBelowXl } from "@/lib/use-below-xl";
import { useRowDetail } from "@/lib/use-row-detail";
import { cn } from "@/lib/utils";

type StatusFilter = ReportStatus | "ALL";
type TargetFilter = ReportTargetType | "ALL";

/**
 * What the server was asked for, echoed back so the controls can show it. Present only where
 * the ledger is paged and the backend does the narrowing; the dashboard's eight-row card passes
 * nothing and draws no controls, because there is nothing there worth filtering.
 */
export interface ReportsFilter {
  query: string;
  status: StatusFilter;
  targetType: TargetFilter;
  sort: ReportSortField;
  ascending: boolean;
}

const COLUMNS = 7;

const STATUS_FILTERS = statusTabs(["PENDING", "RESOLVED", "DISMISSED"], REPORT_STATUS_LABELS);

const TARGET_FILTERS = [
  { value: "ALL" as const, label: "Any" },
  { value: "VIDEO" as const, label: "Videos" },
  { value: "USER" as const, label: "Accounts" },
  { value: "COMMENT" as const, label: "Comments" },
];

export function ReportsTable({
  reports,
  names = NO_NAMES,
  title = "Reports Queue",
  limit,
  footerHref,
  filter,
}: {
  reports: ReportResponse[];
  /** Reporters, resolvers and targets by name, resolved by the page in one batch each. */
  names?: RowNames;
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
  const rows = limit ? reports.slice(0, limit) : reports;
  const order = filter && { field: filter.sort, ascending: filter.ascending };

  return (
    <Card>
      <CardHeader
        title={title}
        hint={
          filter
            ? "Every report filed in the selected period. Resolving one records the decision in the audit log and closes that report."
            : "The newest reports. Resolving one records the decision in the audit log and closes that report."
        }
        actions={filter ? <LedgerControls filter={filter} /> : null}
      />

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px] xl:min-w-[880px]">
          <thead>
            <tr className="border-b border-line text-left">
              <SortableHeader
                label="ID"
                sortKey="id"
                sort={order}
                className="hidden pl-5 xl:table-cell"
              />
              <th className="label hidden px-3 py-3 text-ink-soft xl:table-cell">Reporter</th>
              <SortableHeader
                label="Target"
                sortKey="targetType"
                sort={order}
                className="pl-5 xl:pl-3"
              />
              <th className="label hidden px-3 py-3 text-ink-soft xl:table-cell">Reason</th>
              <SortableHeader label="Status" sortKey="status" sort={order} />
              <SortableHeader label="Created" sortKey="createdAt" sort={order} />
              <th className="label px-5 py-3 text-right text-ink-soft">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((report) => (
              <ReportRow key={report.id} report={report} names={names} belowXl={belowXl} />
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
            className="text-[12px] text-ink-soft underline-offset-4 hover:underline"
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
  names,
  belowXl,
}: {
  report: ReportResponse;
  names: RowNames;
  /** Below xl the secondary columns are dropped, so the expand row carries them instead. */
  belowXl: boolean;
}) {
  const router = useRouter();
  const detail = useRowDetail(() => reportTargetDetailAction(report.targetType, report.targetId));
  const [resolving, setResolving] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();

  const pending = report.status === "PENDING";
  const reporter = names.handles[report.reporterId] ?? `#${report.reporterId.slice(-6)}`;

  function submit(action: ModerationActionType, reason: string, banDays: number | null) {
    startSubmit(async () => {
      const outcome = await resolveReportAction(report.id, action, reason, banDays);
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
        {...expandableRowProps(detail.toggle, detail.open)}
        className={cn(
          "cursor-pointer border-b border-line transition-colors last:border-b-0 hover:bg-surface-muted",
          // Closed reports recede — the queue is about what still needs work
          !pending && "text-ink-faint",
        )}
      >
        <td className="figure hidden py-3 pl-5 pr-3 whitespace-nowrap xl:table-cell">
          #{shortId(report.id.slice(-8), 8)}
        </td>
        <td className="hidden px-3 py-3 whitespace-nowrap xl:table-cell">{reporter}</td>
        <td className="py-3 pl-5 pr-3 xl:pl-3">
          <TargetBadge
            type={report.targetType}
            id={report.targetId}
            name={targetName(names, report.targetType, report.targetId)}
          />
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
              className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[12px] transition-colors hover:bg-surface"
            >
              <Gavel className="h-3.5 w-3.5" />
              Resolve
            </button>
          ) : (
            <span className="text-[12px] text-ink-faint">
              {report.resolvedAt ? relativeTime(report.resolvedAt) : "closed"}
            </span>
          )}
        </td>
      </tr>

      {detail.open ? (
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
          <Field label="Created">{formatDateTime(report.createdAt)}</Field>
          {report.resolvedBy ? (
            <Field label="Resolved by">
              {names.handles[report.resolvedBy] ?? `#${report.resolvedBy.slice(-8)}`}
            </Field>
          ) : null}
          {report.resolvedAt ? (
            <Field label="Resolved at">{formatDateTime(report.resolvedAt)}</Field>
          ) : null}

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
          <td colSpan={COLUMNS} className="px-5 pb-3 text-[12px] text-ink-soft">
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

  function go(key: string, value: string | null) {
    const href = hrefWith(pathname, params, { [key]: value, page: null });
    startNavigation(() => router.replace(href as never));
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", navigating && "opacity-50")}>
      {/* The search is the server's too, like every other control here: narrowing the page on
          screen would answer "the matches among these twenty-five" while reading as the ledger. */}
      <SearchBox
        query={filter.query}
        onCommit={(term) => go("q", term || null)}
        placeholder="Search reason or id..."
      />
      <Segmented
        options={TARGET_FILTERS}
        value={filter.targetType}
        onChange={(value) => go("target", value === "ALL" ? null : value)}
      />
      <Segmented
        options={STATUS_FILTERS}
        value={filter.status}
        onChange={(value) => go("status", value === "ALL" ? null : value)}
      />
    </div>
  );
}
