"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { replayPendingAction } from "@/app/(admin)/system/queues/dead-letters/actions";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Up to this many per click — admin-service's batch. Each one reads its original partition to the end. */
const BATCH = 50;

/**
 * Every pending record of one DLT, in batches. Never forced: a record held back by a later event
 * under its key needs someone to read what that event is, and stays for a replay of its own.
 */
export function ReplayPending({ topic, originTopic, pending }: { topic: string; originTopic: string; pending: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();

  function replay() {
    startSubmit(async () => {
      const result = await replayPendingAction(topic);
      setOutcome(result.message);
      setConfirming(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2 border-t border-line px-5 py-4 text-[13px]">
      {confirming ? (
        <>
          <p className="text-ink-soft">
            Send {pending > BATCH ? `the next ${BATCH} of ${formatNumber(pending)}` : `all ${formatNumber(pending)}`}{" "}
            pending {pending === 1 ? "record" : "records"} back to <span className="font-medium">{originTopic}</span>?
            Every consumer group on it receives them again. A record whose topic has a later event under its key is
            held back, not forced. Only do this once the fix for what parked them is deployed.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={replay}
              disabled={submitting}
              className="rounded-md bg-accent px-3 py-2 text-[12px] font-medium text-on-accent transition-colors hover:bg-accent-strong disabled:opacity-40"
            >
              {submitting ? "Replaying..." : "Confirm replay"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={submitting}
              className="rounded-md border border-line bg-surface px-3 py-2 text-[12px] transition-colors hover:bg-canvas"
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          disabled={pending === 0}
          onClick={() => {
            setConfirming(true);
            setOutcome(null);
          }}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[12px] transition-colors",
            pending === 0 ? "cursor-not-allowed text-ink-faint" : "hover:bg-surface",
          )}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Replay pending records
        </button>
      )}
      {outcome ? <p className="text-[12px] text-ink-soft">{outcome}</p> : null}
    </div>
  );
}
