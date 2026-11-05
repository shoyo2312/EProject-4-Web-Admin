"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Gavel } from "lucide-react";
import { resolveQueueAction } from "@/app/(admin)/moderation/reports/actions";
import { ResolveForm } from "@/components/moderation/resolve-form";
import { SeverityBadge } from "@/components/moderation/severity-badge";
import type { ModerationActionType } from "@/lib/api/types";
import { plural, relativeTime } from "@/lib/format";
import type { ReportedComment } from "@/lib/moderation";
import { useBulkPropagation } from "@/lib/use-propagation";

/**
 * What a list of reported comments says after a decision. Held above the rows, because a decided
 * row leaves the list on the next render and would take its own message with it.
 *
 * The reports close at once, so the first refresh drops the row. A removal lands only once
 * interaction-service consumes the event, and the later refreshes are what show it in the thread.
 */
export function useDecisionNotice() {
  const router = useRouter();
  const { watch } = useBulkPropagation();
  const [notice, setNotice] = useState<string | null>(null);

  return {
    notice,
    decided(message: string, targetId: string) {
      setNotice(message);
      router.refresh();
      watch([[targetId, false]]);
    },
  };
}

/**
 * Why a comment is in front of the moderator, and the decision on it: the same form and the same
 * write as a row of the Reports Queue. Deciding here means reading the comment first, which the
 * queue only offers one click further in.
 */
export function ReportDecision({
  reported,
  onDecided,
  children,
}: {
  reported: ReportedComment;
  onDecided: (message: string, targetId: string) => void;
  /** The comment being judged, between the reason for looking at it and the decision. */
  children: ReactNode;
}) {
  const { report, targetId } = reported;
  const [deciding, setDeciding] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();

  function submit(action: ModerationActionType, reason: string, banDays: number | null) {
    startSubmit(async () => {
      const outcome = await resolveQueueAction("COMMENT", targetId, action, reason, banDays);
      if (outcome.ok) {
        setDeciding(false);
        onDecided(outcome.message, targetId);
      } else {
        setFailure(outcome.message);
      }
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 pt-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
          <SeverityBadge severity={report.severity} />
          <span className="font-medium text-ink">{report.latestReason}</span>
          {/* The first report: the oldest one is what has actually been left waiting. */}
          <span className="text-ink-faint">
            {report.reportCount} {plural(report.reportCount, "report")} · first reported{" "}
            {relativeTime(report.firstReportedAt)}
          </span>
        </div>
        <button
          type="button"
          aria-expanded={deciding}
          onClick={() => {
            setDeciding((open) => !open);
            setFailure(null);
          }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12px] transition-colors hover:bg-canvas"
        >
          <Gavel className="h-3.5 w-3.5" />
          Decide
        </button>
      </div>

      {children}

      {deciding ? (
        <div className="animate-reveal mx-5 mb-3 rounded-lg border border-line bg-surface p-3">
          <p className="mb-2 text-[12px] text-ink-faint">
            {report.reportCount === 1
              ? "Closes the one report against this comment."
              : `Closes all ${report.reportCount} reports against this comment.`}
          </p>
          <ResolveForm
            targetType="COMMENT"
            reporterReason={report.latestReason}
            submitting={submitting}
            onSubmit={submit}
            onCancel={() => setDeciding(false)}
          />
        </div>
      ) : null}

      {failure ? <p className="mx-5 mb-3 text-[12px] text-danger">{failure}</p> : null}
    </div>
  );
}
