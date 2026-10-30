"use client";

import { useEffect, useState } from "react";
import { queueReportsAction, type QueueReports } from "@/app/(admin)/moderation/reports/actions";
import { ReportEvidence } from "@/components/moderation/report-evidence";
import type { ReportTargetType } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { isDirectMessage, sourceLabel } from "@/lib/report-evidence";
import { useRowDetail } from "@/lib/use-row-detail";

/**
 * The reports one queue row stands for, each with its own reporter, reason and evidence. The row's
 * decision closes all of them, so this is also the list of what Ban, Warn and Dismiss will close.
 */
export function QueueReportList({
  targetType,
  targetId,
}: {
  targetType: ReportTargetType;
  targetId: string;
}) {
  const list = useRowDetail<QueueReports>(() => queueReportsAction(targetType, targetId));
  const { toggle, open } = list;
  useEffect(() => {
    if (!open) toggle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (list.failed) {
    return (
      <p role="alert" className="text-[11px] text-ink-soft">
        The reports could not be loaded.{" "}
        <button type="button" onClick={list.retry} className="underline underline-offset-4">
          Retry
        </button>
      </p>
    );
  }
  if (!list.data) return <p className="text-[11px] text-ink-faint">Loading the reports…</p>;
  if (list.data.reports.length === 0) {
    return <p className="text-[11px] text-ink-faint">No pending reports.</p>;
  }

  return (
    <ul className="space-y-2">
      {list.data.reports.map((report) => (
        <ReportItem
          key={report.id}
          report={report}
          reporter={list.data?.handles[report.reporterId] ?? `#${report.reporterId.slice(-6)}`}
        />
      ))}
    </ul>
  );
}

function ReportItem({
  report,
  reporter,
}: {
  report: QueueReports["reports"][number];
  reporter: string;
}) {
  const [showing, setShowing] = useState(false);
  const dm = isDirectMessage(report);
  return (
    <li className="rounded-md border border-line bg-surface px-3 py-2 text-[12px]">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">#{report.id.slice(-8)}</span>
        <span>{reporter}</span>
        <span className="text-ink-soft">{report.reason}</span>
        <span className="text-ink-faint">{sourceLabel(report)}</span>
        <span className="text-ink-faint">{formatDateTime(report.createdAt)}</span>
        {dm ? (
          <button
            type="button"
            aria-expanded={showing}
            onClick={() => setShowing((open) => !open)}
            className="ml-auto rounded-md border border-line px-2 py-1 text-[11px] hover:bg-surface-muted"
          >
            {showing ? "Hide messages" : "View messages"}
          </button>
        ) : null}
      </p>
      {dm && showing ? (
        <div className="mt-2">
          <ReportEvidence reportId={report.id} />
        </div>
      ) : null}
    </li>
  );
}
