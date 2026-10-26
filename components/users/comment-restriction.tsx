"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LockOpen } from "lucide-react";
import { liftCommentRestrictionAction } from "@/app/(admin)/users/actions";
import { Field } from "@/components/ui/row-detail";
import type { CommentRestrictionResponse } from "@/lib/api/types";
import { formatDateTime, timeLeft } from "@/lib/format";
import { commentStanding } from "@/lib/moderation";

/**
 * Whether an account may comment, and the strikes behind it. Lifting is offered whenever there is
 * anything to clear, not only during a restriction: a bad term can restrict accounts that did
 * nothing wrong, and the strikes it left behind would bring the next restriction sooner.
 *
 * Confirmed but not explained: there is no reason box, because there is no audit row to keep one.
 */
export function CommentRestriction({
  restriction,
  subject,
  now,
}: {
  restriction: CommentRestrictionResponse;
  /** "@handle", for the confirmation. */
  subject: string;
  /** The page's clock — the mock one in mock mode — so the server and the browser agree on what is left. */
  now: number;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();
  const { restrictedUntil, lifts } = commentStanding(restriction, now);

  function lift() {
    startSubmit(async () => {
      const outcome = await liftCommentRestrictionAction(
        restriction.userId,
        lifts === "restriction",
      );
      setResult(outcome.message);
      if (outcome.ok) {
        setConfirming(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px] xl:grid-cols-4">
        <Field label="Status" wide>
          {restrictedUntil ? (
            <span className="text-danger">
              Restricted until {formatDateTime(restrictedUntil)} · {timeLeft(restrictedUntil, now)}{" "}
              left
            </span>
          ) : (
            "Allowed"
          )}
        </Field>
        <Field label="Comment strikes">
          <Count value={restriction.strikes} />
        </Field>
        <Field label="Restrictions in a row">
          <Count value={restriction.step} />
        </Field>
      </dl>

      {lifts && !confirming ? (
        <button
          type="button"
          onClick={() => {
            setConfirming(true);
            setResult(null);
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[12px] transition-colors hover:bg-surface"
        >
          <LockOpen className="h-3.5 w-3.5" />
          {lifts === "restriction" ? "Lift restriction" : "Clear strikes"}
        </button>
      ) : null}

      {lifts && confirming ? (
        <div className="space-y-2 rounded-lg border border-line bg-surface-muted px-3 py-2.5">
          <p className="text-[12px] text-ink-soft">
            {lifts === "restriction"
              ? `${subject} can comment again straight away, and their strikes and restrictions in a row start over.`
              : `${subject}'s strikes and restrictions in a row start over: restricting them again takes a fresh run of strikes, and starts from the shortest.`}{" "}
            Logged by interaction-service, not in the Audit Log.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={lift}
              disabled={submitting}
              className="rounded-md bg-accent px-3 py-2 text-[12px] font-medium text-on-accent transition-colors hover:bg-accent-strong disabled:opacity-40"
            >
              {submitting
                ? "Submitting..."
                : lifts === "restriction"
                  ? "Confirm lift"
                  : "Confirm clear"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-md border border-line bg-surface px-3 py-2 text-[12px] transition-colors hover:bg-canvas"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {result ? <p className="text-[12px] text-ink-soft">{result}</p> : null}
    </div>
  );
}

function Count({ value }: { value: number }) {
  return value === 0 ? (
    <span className="text-ink-faint">none</span>
  ) : (
    <span className="figure">{value}</span>
  );
}
