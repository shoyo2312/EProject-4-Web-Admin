"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { replayDeadLetterAction } from "@/app/(admin)/system/queues/dead-letters/actions";
import { Card, CardHeader } from "@/components/ui/card";
import type { DeadLetterRecordResponse } from "@/lib/api/types";
import { deadLetterStatus } from "@/lib/dead-letters";
import { formatDateTime, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ToneBadge } from "./tone-badge";

const COLUMNS = 6;

/** The newest records of one DLT, each with a replay of its own. */
export function DeadLetterRecords({
  topic,
  originTopic,
  records,
  handles,
  now,
}: {
  topic: string;
  originTopic: string;
  records: DeadLetterRecordResponse[];
  /** adminId → @handle, for who replayed a record last. */
  handles: Record<string, string>;
  /** The page's clock — the mock one in mock mode — so "2h ago" agrees with the fixtures. */
  now: number;
}) {
  return (
    <Card>
      <CardHeader
        title="Newest records"
        hint="Fifty at most, newest first. The payload is not shown: it is an event's content, and what decides a replay is where and why it failed."
      />

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px] xl:min-w-[980px]">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="label-caps px-5 py-3 text-ink-soft">Parked</th>
              <th className="label-caps px-3 py-3 text-ink-soft">Failed in</th>
              <th className="label-caps px-3 py-3 text-ink-soft">Event</th>
              <th className="label-caps px-3 py-3 text-ink-soft">Why</th>
              <th className="label-caps px-3 py-3 text-ink-soft">State</th>
              <th className="label-caps px-5 py-3 text-right text-ink-soft">Replay</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <RecordRow
                key={`${record.partition}:${record.offset}`}
                topic={topic}
                originTopic={originTopic}
                record={record}
                replayedBy={record.lastReplay ? handles[record.lastReplay.adminId] : undefined}
                now={now}
              />
            ))}

            {records.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS} className="px-5 py-10 text-center text-ink-faint">
                  Retention has dropped every record on this topic.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function RecordRow({
  topic,
  originTopic,
  record,
  replayedBy,
  now,
}: {
  topic: string;
  originTopic: string;
  record: DeadLetterRecordResponse;
  replayedBy: string | undefined;
  now: number;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();
  const status = deadLetterStatus(record);
  const last = record.lastReplay;
  const heldBack = last?.outcome === "HELD_BACK";
  // Nothing says which topic it would go back to.
  const replayable = record.origin !== null;

  function replay(force: boolean) {
    startSubmit(async () => {
      const result = await replayDeadLetterAction(topic, record.partition, record.offset, force);
      setOutcome(result.message);
      setConfirming(false);
      router.refresh();
    });
  }

  return (
    <>
      <tr className="border-b border-line align-top last:border-b-0">
        <td className="px-5 py-3 whitespace-nowrap text-ink-soft" title={formatDateTime(record.parkedAt)}>
          {relativeTime(record.parkedAt, now)}
          <p className="figure text-[11px] text-ink-faint">
            {record.partition}:{record.offset}
          </p>
        </td>
        <td className="px-3 py-3">
          <span className="font-medium">{record.consumerGroup ?? "—"}</span>
          <p className="text-[11px] text-ink-faint wrap-anywhere">{record.origin ?? "no origin headers"}</p>
        </td>
        <td className="px-3 py-3">
          {record.eventType ?? <span className="text-ink-faint">no eventType</span>}
          <p className="figure text-[11px] text-ink-faint wrap-anywhere">key {record.key ?? "—"}</p>
        </td>
        <td className="max-w-[360px] px-3 py-3 text-[11px] text-ink-soft wrap-anywhere">
          {record.error ?? <span className="text-ink-faint">no exception recorded</span>}
        </td>
        <td className="px-3 py-3">
          <ToneBadge tone={status.tone}>{status.label}</ToneBadge>
          {last ? (
            <p className="mt-1 text-[11px] whitespace-nowrap text-ink-faint" title={formatDateTime(last.at)}>
              {replayedBy ?? `#${last.adminId.slice(-6)}`} · {relativeTime(last.at, now)}
            </p>
          ) : null}
        </td>
        <td className="px-5 py-3 text-right">
          {replayable ? (
            <button
              type="button"
              disabled={confirming}
              onClick={() => {
                setConfirming(true);
                setOutcome(null);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[11px] transition-colors",
                confirming ? "cursor-not-allowed text-ink-faint" : "hover:bg-surface",
              )}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Replay
            </button>
          ) : null}
        </td>
      </tr>

      {heldBack && last.detail ? (
        <tr className="border-b border-line bg-surface-muted">
          <td colSpan={COLUMNS} className="px-5 py-2 text-[11px] text-ink-soft">
            Held back: {last.detail}. Replaying it lands it after that event, so it can undo what that
            event did — a takedown replayed after its restore takes the video down again.
          </td>
        </tr>
      ) : null}

      {confirming ? (
        <tr className="border-b border-line bg-surface-muted">
          <td colSpan={COLUMNS} className="px-5 py-3">
            <p className="mb-2 text-[11px] text-ink-soft">
              Send this {record.eventType ?? "record"} back to{" "}
              <span className="font-medium">{originTopic}</span>? Every consumer group on it receives it again; those
              that handled it before drop it.
              {heldBack
                ? " It was held back last time: replay it anyway only if it is right for it to come after that event."
                : " If a later event under the same key is there, it is held back rather than sent."}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => replay(false)}
                disabled={submitting}
                className="rounded-md bg-ink px-3 py-2 text-[11px] text-surface transition-opacity hover:opacity-85 disabled:opacity-40"
              >
                {submitting ? "Replaying..." : "Replay"}
              </button>
              {heldBack ? (
                <button
                  type="button"
                  onClick={() => replay(true)}
                  disabled={submitting}
                  className="rounded-md border border-danger/40 bg-surface px-3 py-2 text-[11px] text-danger transition-colors hover:bg-danger-bg disabled:opacity-40"
                >
                  Replay anyway
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={submitting}
                className="rounded-md border border-line bg-surface px-3 py-2 text-[11px] transition-colors hover:bg-canvas"
              >
                Cancel
              </button>
            </div>
          </td>
        </tr>
      ) : null}

      {outcome ? (
        <tr className="border-b border-line">
          <td colSpan={COLUMNS} className="px-5 py-2 text-[11px] text-ink-soft">
            {outcome}
          </td>
        </tr>
      ) : null}
    </>
  );
}
