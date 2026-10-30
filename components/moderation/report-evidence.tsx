"use client";

import { useEffect } from "react";
import { reportEvidenceAction } from "@/app/(admin)/moderation/reports/actions";
import type { ReportEvidenceResponse } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { describeEvidence } from "@/lib/report-evidence";
import { useRowDetail } from "@/lib/use-row-detail";
import { cn } from "@/lib/utils";

/**
 * The messages one direct-message report was filed with, in the order they were sent. Read when this
 * mounts — which is when someone opens the report — so a page of reports never loads a private chat
 * it was not asked about. It shows what was captured when the report was filed, not what the
 * conversation says now, and only the messages the reporter picked.
 */
export function ReportEvidence({ reportId }: { reportId: string }) {
  const evidence = useRowDetail<ReportEvidenceResponse>(() => reportEvidenceAction(reportId));
  const { toggle, open } = evidence;

  useEffect(() => {
    if (!open) toggle();
    // Opened once, on mount; the hook keeps the answer and `retry` asks again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (evidence.loading || (!evidence.data && !evidence.failed)) {
    return <p className="text-[11px] text-ink-faint">Loading the reported messages…</p>;
  }
  if (evidence.failed || !evidence.data) {
    return (
      <p role="alert" className="text-[11px] text-ink-soft">
        The reported messages could not be loaded.{" "}
        <button type="button" onClick={evidence.retry} className="underline underline-offset-4">
          Retry
        </button>
      </p>
    );
  }
  if (evidence.data.messages.length === 0) {
    return <p className="text-[11px] text-ink-faint">No messages were attached to this report.</p>;
  }

  const { messages, capturedAt } = evidence.data;
  return (
    <div>
      {capturedAt ? (
        <p className="mb-2 text-[11px] text-ink-faint">
          Captured {formatDateTime(capturedAt)} · {messages.length}{" "}
          {messages.length === 1 ? "message" : "messages"}
        </p>
      ) : null}
      <ol className="space-y-1.5">
        {messages.map((message) => {
          const reported = message.role === "REPORTED";
          return (
            <li
              key={message.messageId}
              className={cn(
                "rounded-md border px-3 py-2 text-[12px]",
                reported ? "border-line bg-surface" : "border-line/60 bg-surface-muted text-ink-soft",
              )}
            >
              <p className="mb-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-faint">
                <span className={cn("font-medium", reported ? "text-ink" : "text-ink-soft")}>
                  {reported ? "Reported account" : "Reporter"}
                </span>
                <span>{formatDateTime(message.sentAt)}</span>
                <span>{message.type}</span>
              </p>
              <p className="break-words whitespace-pre-wrap">{describeEvidence(message)}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
