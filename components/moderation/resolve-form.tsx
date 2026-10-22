"use client";

import { useState } from "react";
import { ReasonForm } from "@/components/moderation/reason-form";
import { Segmented } from "@/components/ui/segmented";
import type { ModerationActionType, ReportTargetType } from "@/lib/api/types";
import { BAN_DURATIONS, banDaysOf, type BanDuration } from "@/lib/moderation";
import { cn } from "@/lib/utils";

/**
 * What a moderator may decide about each kind of target. Narrower than ModerationActionType on
 * purpose: the decision carries the target's own targetType, so offering BAN_USER against a
 * VIDEO would write an audit row no consumer can apply. RESTORE_VIDEO and UNBAN_USER are absent
 * for the same reason — a report is never the thing that undoes an action.
 *
 * WARN_USER is the one every target offers: the warning carries the reported target and
 * notification-service finds the person behind it — the account itself, the video's owner, the
 * comment's author. It leaves the target up and still closes every report standing against it,
 * so it is instead of a takedown or a removal, not on top of one.
 */
export const ACTIONS_BY_TARGET: Record<
  ReportTargetType,
  readonly { value: ModerationActionType; label: string }[]
> = {
  VIDEO: [
    { value: "TAKEDOWN_VIDEO", label: "Take down video" },
    { value: "WARN_USER", label: "Warn owner" },
    { value: "DISMISS_REPORT", label: "Dismiss report" },
  ],
  COMMENT: [
    { value: "REMOVE_COMMENT", label: "Remove comment" },
    { value: "WARN_USER", label: "Warn author" },
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

export const DISMISS_PRESETS = [
  "Reviewed — no policy violation",
  "Duplicate of an earlier report on the same target",
  "Already actioned under another report",
  "Not enough in the report to act on",
] as const;

/**
 * The decision form shared by the queue and the report ledger: pick an action, then the reason
 * strip every enforcement uses. Both surfaces write the same audit row from it, so it lives here
 * rather than being typed out twice and drifting — the presets are the wording that ends up in
 * the log.
 */
export function ResolveForm({
  targetType,
  reporterReason,
  submitting,
  onSubmit,
  onCancel,
}: {
  targetType: ReportTargetType;
  /** The reporter's own scenario label, offered as the first preset for an enforcement. */
  reporterReason: string;
  submitting: boolean;
  /** `banDays` is null for a permanent ban and for every action that is not a ban. */
  onSubmit: (action: ModerationActionType, reason: string, banDays: number | null) => void;
  onCancel: () => void;
}) {
  const choices = ACTIONS_BY_TARGET[targetType];
  // Mounted only while the form is open, so the first action of this target's list is the
  // initial state and reopening a row starts clean — no reset effect to keep in step.
  const [action, setAction] = useState<ModerationActionType>(choices[0].value);
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState<BanDuration>("permanent");

  const dismissing = action === "DISMISS_REPORT";
  const banning = action === "BAN_USER";
  const presets = dismissing
    ? [...DISMISS_PRESETS]
    : // The reporter's own words first: most enforcements agree with the report, and retyping
      // what it already says is how audit rows end up saying "spam".
      [reporterReason, ...ENFORCE_PRESETS];

  return (
    <>
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

      {banning ? (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="label-caps text-ink-soft">Duration</span>
          <Segmented options={BAN_DURATIONS} value={duration} onChange={setDuration} />
        </div>
      ) : null}

      <ReasonForm
        presets={presets}
        reason={reason}
        onReason={setReason}
        onSubmit={() => onSubmit(action, reason, banning ? banDaysOf(duration) : null)}
        onCancel={onCancel}
        submitting={submitting}
        placeholder="Reason — the audit row is this string and nothing else, so write what you saw"
        confirmLabel={
          dismissing
            ? "Confirm dismissal"
            : banning && duration !== "permanent"
              ? `Ban for ${duration}d`
              : "Confirm action"
        }
      />
    </>
  );
}
