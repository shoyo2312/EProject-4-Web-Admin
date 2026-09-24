"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, EyeOff, RotateCcw, ShieldCheck } from "lucide-react";
import { moderateUserAction } from "@/app/(admin)/users/actions";
import { moderateVideoAction } from "@/app/(admin)/videos/actions";
import { ReasonForm } from "@/components/moderation/reason-form";
import { Segmented } from "@/components/ui/segmented";
import {
  BAN_DURATIONS,
  PRESET_REASONS,
  banDaysOf,
  type BanDuration,
  type EnforcementAction,
} from "@/lib/moderation";
import { cn } from "@/lib/utils";

const ICONS = {
  ban: Ban,
  unban: ShieldCheck,
  takedown: EyeOff,
  restore: RotateCcw,
} as const;

const BUTTON_LABELS: Record<EnforcementAction, string> = {
  ban: "Ban account",
  unban: "Unban account",
  takedown: "Take down",
  restore: "Restore",
};

/**
 * The one decision a target's own page offers, with the reason that goes into the audit row.
 *
 * The same write the directory tables make — which action it is follows from the target's
 * current state, not from the surface — so the preset wording comes from the same table. What
 * differs here is only that there is one target and no row to collapse back into.
 */
export function EnforcePanel({
  kind,
  targetId,
  action,
  subject,
  blockedReason,
}: {
  kind: "user" | "video";
  targetId: string;
  action: EnforcementAction;
  /** Named in the reason placeholder, so the box says which target it is about. */
  subject: string;
  /**
   * Set when the decision must not be offered at all — banning an admin account locks the
   * console. The button renders disabled and says why rather than disappearing, because a
   * missing button reads as "nothing can be done here".
   */
  blockedReason?: string;
}) {
  const router = useRouter();
  const [reason, setReason] = useState<string | null>(null);
  const [duration, setDuration] = useState<BanDuration>("permanent");
  const [result, setResult] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();

  const Icon = ICONS[action];
  const destructive = action === "ban" || action === "takedown";

  function submit() {
    startSubmit(async () => {
      const outcome =
        kind === "user"
          ? await moderateUserAction(
              targetId,
              action as "ban" | "unban",
              reason ?? "",
              banDaysOf(duration),
            )
          : await moderateVideoAction(
              targetId,
              action as "takedown" | "restore",
              reason ?? "",
            );
      setResult(outcome.message);
      if (outcome.ok) {
        setReason(null);
        // ponytail: one re-read, not the staged retry the directory tables run. The enforcement
        // lands when the owning service consumes the event, so this can legitimately come back
        // showing the old status — which is what the returned message says. Lift REFRESH_AT out
        // of users-table if watching the status flip here turns out to matter.
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      {reason === null ? (
        <button
          type="button"
          disabled={Boolean(blockedReason)}
          title={blockedReason}
          onClick={() => {
            setReason("");
            setResult(null);
          }}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[11px] transition-colors",
            blockedReason
              ? "cursor-not-allowed text-ink-faint"
              : cn("hover:bg-surface", destructive && "text-danger"),
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {BUTTON_LABELS[action]}
        </button>
      ) : (
        <div className="space-y-3">
          {action === "ban" ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="label-caps text-ink-soft">Duration</span>
              <Segmented options={BAN_DURATIONS} value={duration} onChange={setDuration} />
            </div>
          ) : null}
          <ReasonForm
            presets={PRESET_REASONS[action]}
            reason={reason}
            onReason={setReason}
            onSubmit={submit}
            onCancel={() => setReason(null)}
            submitting={submitting}
            placeholder={`Reason for ${BUTTON_LABELS[action].toLowerCase()} — ${subject}`}
            confirmLabel={
              action === "ban" && duration !== "permanent"
                ? `Ban for ${duration}d`
                : `Confirm ${action}`
            }
          />
        </div>
      )}

      {blockedReason ? (
        <p className="text-[11px] text-ink-faint">{blockedReason}</p>
      ) : null}

      {result ? <p className="text-[11px] text-ink-soft">{result}</p> : null}
    </div>
  );
}
