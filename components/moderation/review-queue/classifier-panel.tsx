import { Card, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/row-detail";
import type { ModerationSummary } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { heldBecause, type ReviewLines } from "@/lib/review";
import { cn } from "@/lib/utils";

/**
 * Why the classifier held this video and how close a call it was: the highest frame's score on the
 * 0–1 scale the thresholds are set on, with the review and reject lines drawn across it. Only a
 * summary exists — video-service stores the highest score and the frame count, not every frame's.
 */
export function ClassifierPanel({
  moderation,
  lines,
}: {
  moderation: ModerationSummary | null;
  lines: ReviewLines | null;
}) {
  return (
    <Card>
      <CardHeader
        title="Why it was held"
        hint="The classifier's own account of this video. The lines are today's thresholds, the ones Settings shows."
      />
      <div className="space-y-4 px-5 py-4">
        <p className="text-[12px] text-ink-soft">{heldBecause(moderation, lines)}</p>

        {/* No scored frames — a check that did not finish, or a file with nothing to sample — has
            no score worth drawing: 0.000 on 0/0 frames would read as a clean pass. */}
        {moderation && moderation.totalFrames > 0 ? (
          <>
            <ScoreScale score={moderation.maxScore} lines={lines} />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[12px] sm:grid-cols-4">
              <Field label="Label">{moderation.label ?? "—"}</Field>
              {/* Raw rather than a percentage: the lines are configured on this same 0–1 scale. */}
              <Field label="Highest frame">
                <span className="figure">{moderation.maxScore.toFixed(3)}</span>
              </Field>
              <Field label="Frames flagged">
                <span className="figure">{moderation.suspiciousFrames}</span> of{" "}
                <span className="figure">{moderation.totalFrames}</span>
              </Field>
              <Field label="Checked">{formatDateTime(moderation.checkedAt)}</Field>
              <Field label="Model" wide>
                {moderation.model ?? "unknown"} · {moderation.modelVersion ?? "unversioned"}
              </Field>
            </dl>
          </>
        ) : moderation ? (
          <p className="text-[11px] text-ink-faint">
            Checked {formatDateTime(moderation.checkedAt)}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

function ScoreScale({ score, lines }: { score: number; lines: ReviewLines | null }) {
  const at = (value: number) => `${Math.min(Math.max(value, 0), 1) * 100}%`;
  const fill = !lines
    ? "bg-ink-soft"
    : score >= lines.rejectAt
      ? "bg-danger"
      : score >= lines.reviewAt
        ? "bg-pending"
        : "bg-success";

  return (
    <div
      role="img"
      aria-label={
        lines
          ? `Highest frame ${score.toFixed(2)} on a 0 to 1 scale; review line ${lines.reviewAt.toFixed(2)}, reject line ${lines.rejectAt.toFixed(2)}.`
          : `Highest frame ${score.toFixed(2)} on a 0 to 1 scale.`
      }
    >
      <div className="relative h-2 rounded-full bg-neutral-bg">
        <span className={cn("absolute inset-y-0 left-0 rounded-full", fill)} style={{ width: at(score) }} />
        {lines ? (
          <>
            <span className="absolute -inset-y-1 w-px bg-ink-soft" style={{ left: at(lines.reviewAt) }} />
            <span className="absolute -inset-y-1 w-px bg-ink-soft" style={{ left: at(lines.rejectAt) }} />
          </>
        ) : null}
      </div>
      <div className="relative mt-1.5 h-4 text-[10px] text-ink-faint">
        <span className="absolute left-0">0</span>
        {lines ? (
          <>
            <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: at(lines.reviewAt) }}>
              review {lines.reviewAt.toFixed(2)}
            </span>
            <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: at(lines.rejectAt) }}>
              reject {lines.rejectAt.toFixed(2)}
            </span>
          </>
        ) : null}
        <span className="absolute right-0">1</span>
      </div>
    </div>
  );
}
