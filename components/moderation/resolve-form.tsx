"use client";

import { useState } from "react";
import type { ModerationActionType, ReportTargetType } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/**
 * What a moderator may decide about each kind of target. Narrower than ModerationActionType on
 * purpose: the decision carries the target's own targetType, so offering BAN_USER against a
 * VIDEO would write an audit row no consumer can apply. RESTORE_VIDEO and UNBAN_USER are absent
 * for the same reason — a report is never the thing that undoes an action.
 */
export const ACTIONS_BY_TARGET: Record<
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

/**
 * The decision form shared by the queue and the report ledger: pick an action, pick or write the
 * reason, confirm. Both surfaces write the same audit row from it, so it lives here rather than
 * being typed out twice and drifting — the presets are the wording that ends up in the log.
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
  onSubmit: (action: ModerationActionType, reason: string) => void;
  onCancel: () => void;
}) {
  const choices = ACTIONS_BY_TARGET[targetType];
  // Mounted only while the form is open, so the first action of this target's list is the
  // initial state and reopening a row starts clean — no reset effect to keep in step.
  const [action, setAction] = useState<ModerationActionType>(choices[0].value);
  const [reason, setReason] = useState("");

  const dismissing = action === "DISMISS_REPORT";
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

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            aria-pressed={reason === preset}
            // Clicking the highlighted chip is how an admin says "not that one", so it clears
            // the box rather than putting back what they just rejected.
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
          onClick={() => onSubmit(action, reason)}
          disabled={submitting || !reason.trim()}
          className="rounded-md bg-ink px-3 py-2 text-[11px] text-surface transition-opacity hover:opacity-85 disabled:opacity-40"
        >
          {submitting
            ? "Submitting..."
            : dismissing
              ? "Confirm dismissal"
              : "Confirm action"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-line bg-surface px-3 py-2 text-[11px] transition-colors hover:bg-canvas"
        >
          Cancel
        </button>
      </div>
    </>
  );
}
