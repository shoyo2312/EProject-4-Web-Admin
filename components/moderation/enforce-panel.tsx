"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  CheckCircle2,
  EyeOff,
  LogOut,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
  XCircle,
} from "lucide-react";
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
  warn: TriangleAlert,
  revokeSessions: LogOut,
  takedown: EyeOff,
  restore: RotateCcw,
  approve: CheckCircle2,
  reject: XCircle,
} as const;

const BUTTON_LABELS: Record<EnforcementAction, string> = {
  ban: "Ban account",
  unban: "Unban account",
  warn: "Warn account",
  revokeSessions: "Sign out everywhere",
  takedown: "Take down",
  restore: "Restore",
  approve: "Approve",
  reject: "Reject",
};

const CONFIRM_LABELS: Record<EnforcementAction, string> = {
  ban: "Confirm ban",
  unban: "Confirm unban",
  warn: "Send warning",
  revokeSessions: "Confirm sign-out",
  takedown: "Confirm takedown",
  restore: "Confirm restore",
  approve: "Confirm approval",
  reject: "Confirm rejection",
};

/**
 * The decisions a target's own page offers, each with the reason that goes into the audit row.
 *
 * The same writes the directory tables make — which ban or takedown it is follows from the
 * target's current state, not from the surface — so the preset wording comes from the same
 * table. One form is open at a time: two half-written reasons side by side invite submitting the
 * wrong one.
 */
export function EnforcePanel({
  kind,
  targetId,
  actions,
  subject,
  blocked,
}: {
  kind: "user" | "video";
  targetId: string;
  /** The decisions to offer, in button order. */
  actions: readonly EnforcementAction[];
  /** Named in the reason placeholder, so the box says which target it is about. */
  subject: string;
  /**
   * Why a decision must not be offered at all — banning an admin account locks the console. The
   * button renders disabled and says why rather than disappearing, because a missing button reads
   * as "nothing can be done here".
   */
  blocked?: Partial<Record<EnforcementAction, string>>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<EnforcementAction | null>(null);
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState<BanDuration>("permanent");
  const [result, setResult] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();

  function submit(action: EnforcementAction) {
    startSubmit(async () => {
      const outcome =
        kind === "user"
          ? await moderateUserAction(
              targetId,
              action as "ban" | "unban" | "warn" | "revokeSessions",
              reason,
              action === "ban" ? banDaysOf(duration) : null,
            )
          : await moderateVideoAction(
              targetId,
              action as "takedown" | "restore" | "approve" | "reject",
              reason,
            );
      setResult(outcome.message);
      if (outcome.ok) {
        setOpen(null);
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
      {open === null ? (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => {
            const Icon = ICONS[action];
            const why = blocked?.[action];
            return (
              <button
                key={action}
                type="button"
                disabled={Boolean(why)}
                title={why}
                onClick={() => {
                  setOpen(action);
                  setReason("");
                  setDuration("permanent");
                  setResult(null);
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[12px] transition-colors",
                  why
                    ? "cursor-not-allowed text-ink-faint"
                    : cn(
                        "hover:bg-surface",
                        (action === "ban" || action === "takedown" || action === "reject")
                          && "text-danger",
                        action === "approve" && "text-success",
                      ),
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {BUTTON_LABELS[action]}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {open === "ban" ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="label text-ink-soft">Duration</span>
              <Segmented options={BAN_DURATIONS} value={duration} onChange={setDuration} />
            </div>
          ) : null}
          <ReasonForm
            presets={PRESET_REASONS[open]}
            reason={reason}
            onReason={setReason}
            onSubmit={() => submit(open)}
            onCancel={() => setOpen(null)}
            submitting={submitting}
            placeholder={`Reason for ${BUTTON_LABELS[open].toLowerCase()} — ${subject}`}
            confirmLabel={
              open === "ban" && duration !== "permanent"
                ? `Ban for ${duration}d`
                : CONFIRM_LABELS[open]
            }
          />
        </div>
      )}

      {actions.map((action) =>
        blocked?.[action] ? (
          <p key={action} className="text-[12px] text-ink-faint">
            {blocked[action]}
          </p>
        ) : null,
      )}

      {result ? <p className="text-[12px] text-ink-soft">{result}</p> : null}
    </div>
  );
}
