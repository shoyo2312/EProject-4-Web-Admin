import type {
  DeadLetterBatchReplayResponse,
  DeadLetterRecordResponse,
  DeadLetterReplayOutcome,
  DeadLetterReplayResponse,
  DeadLetterTopicResponse,
} from "@/lib/api/types";
import { plural } from "@/lib/format";
import type { Tone } from "@/lib/tone";

/** A query string rather than a path segment: a topic name is dots all the way through. */
export function deadLetterHref(topic: string): string {
  return `/system/queues/dead-letters?${new URLSearchParams({ topic })}`;
}

/**
 * One line for the card's header. Anything pending is bad news, not a backlog: every record there
 * is an event each consumer of its topic missed, and nothing replays it on its own.
 */
export function deadLetterHealth(topics: Pick<DeadLetterTopicResponse, "pending">[]): {
  tone: Tone;
  text: string;
} {
  const waiting = topics.filter((topic) => topic.pending > 0);
  const pending = waiting.reduce((sum, topic) => sum + topic.pending, 0);
  if (pending === 0) {
    return { tone: "ok", text: topics.length === 0 ? "Nothing has been dead-lettered." : "Nothing pending." };
  }
  return {
    tone: "bad",
    text: `${pending} ${plural(pending, "record")} pending on ${waiting.length} ${plural(waiting.length, "topic")} — fix the cause and deploy before replaying.`,
  };
}

/**
 * What a record's row says about it. The console's own last replay comes first; without one, a
 * record the dlt-replay group has been past was handled by `make dlt-replay ALL=1`, which leaves no
 * trace of what it did.
 */
export function deadLetterStatus(record: Pick<DeadLetterRecordResponse, "pending" | "lastReplay">): {
  tone: Tone;
  label: string;
} {
  switch (record.lastReplay?.outcome) {
    case "REPLAYED":
      return { tone: "ok", label: record.lastReplay.forced ? "Replayed (forced)" : "Replayed" };
    case "ALREADY_REPLAYED":
      return { tone: "ok", label: "Already replayed" };
    case "HELD_BACK":
      return { tone: "warn", label: "Held back" };
    case "NOT_PARKED":
      return { tone: "neutral", label: "Cannot be replayed" };
  }
  return record.pending
    ? { tone: "bad", label: "Pending" }
    : { tone: "neutral", label: "Handled from the CLI" };
}

/** The sentence a replay ends with. */
export function replayOutcomeText(result: Pick<DeadLetterReplayResponse, "outcome" | "detail">): string {
  switch (result.outcome) {
    case "REPLAYED":
      return `Replayed to ${result.detail}. Every consumer of the topic receives it again; those that handled it before drop it.`;
    case "HELD_BACK":
      return `Held back: ${result.detail}. Replaying it now would land it after that event — replay anyway only if that order is right.`;
    case "ALREADY_REPLAYED":
      return `Already replayed, as ${result.detail}.`;
    case "NOT_PARKED":
      return "Not replayed: the record has no kafka_dlt-original-* headers, so nothing says which topic it came from.";
    case "NOT_FOUND":
      return "Not replayed: the record is no longer on the topic.";
  }
}

const BATCH_PARTS: [DeadLetterReplayOutcome, string][] = [
  ["REPLAYED", "replayed"],
  ["HELD_BACK", "held back"],
  ["ALREADY_REPLAYED", "already replayed"],
  ["NOT_PARKED", "not replayable"],
];

/** What a replay of the pending records did, and whether another one is needed. */
export function batchReplaySummary(response: DeadLetterBatchReplayResponse): string {
  if (response.results.length === 0) {
    return response.stillPending > 0
      ? `Nothing was replayed before time ran out — ${response.stillPending} ${plural(response.stillPending, "record")} still pending.`
      : "Nothing was pending.";
  }
  const counts = new Map<DeadLetterReplayOutcome, number>();
  for (const result of response.results) {
    counts.set(result.outcome, (counts.get(result.outcome) ?? 0) + 1);
  }
  const parts = BATCH_PARTS.filter(([outcome]) => counts.has(outcome)).map(
    ([outcome, label]) => `${counts.get(outcome)} ${label}`,
  );
  const sentence = parts.join(", ");
  const held = counts.has("HELD_BACK")
    ? " Held-back records stay listed: replay each on its own once you have read what holds it."
    : "";
  const left =
    response.stillPending > 0
      ? ` ${response.stillPending} ${plural(response.stillPending, "record")} still pending — replay again to carry on.`
      : "";
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.${held}${left}`;
}
