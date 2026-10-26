import type {
  OutboxBacklog,
  OutboxBacklogResponse,
  TextModerationStatusResponse,
} from "@/lib/api/types";
import { formatSpan, plural } from "@/lib/format";
import type { Tone } from "@/lib/tone";

/**
 * The OutboxStuck alert's line (scripts/monitoring/alerts.yml): the oldest event has waited five
 * minutes for the broker. Under it a backlog is a busy outbox; over it, one nothing is draining.
 */
export const OUTBOX_STUCK_AFTER_SECONDS = 300;

/** How long the oldest pending event has waited: "12s", "16m", "3h". */
export function formatWait(seconds: number | null): string {
  if (seconds === null) return "unknown";
  if (seconds <= 0) return "—";
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s`;
  return formatSpan(seconds * 1000);
}

/** Read off the age, not the count: a count cannot tell a busy outbox from a stuck one. */
export function outboxState(
  outbox: Pick<OutboxBacklog, "pending" | "oldestPendingAgeSeconds">,
): { tone: Tone; label: string } {
  if (outbox.pending === null || outbox.oldestPendingAgeSeconds === null) {
    return { tone: "warn", label: "Cannot count" };
  }
  if (outbox.oldestPendingAgeSeconds > OUTBOX_STUCK_AFTER_SECONDS) return { tone: "bad", label: "Stuck" };
  if (outbox.pending > 0) return { tone: "ok", label: "Draining" };
  return { tone: "ok", label: "Empty" };
}

export function outboxHealth(services: OutboxBacklogResponse[]): { tone: Tone; text: string } {
  const outboxes = services.flatMap((service) => service.outboxes);
  const stuck = outboxes.filter((outbox) => outboxState(outbox).label === "Stuck").length;
  if (stuck > 0) {
    return {
      tone: "bad",
      text: `${stuck} ${plural(stuck, "outbox", "outboxes")} stuck — the oldest event has waited over 5 minutes for Kafka.`,
    };
  }
  const unreachable = services.filter((service) => !service.reachable).length;
  const uncounted = outboxes.filter((outbox) => outboxState(outbox).label === "Cannot count").length;
  const problems = [
    unreachable > 0 ? `${unreachable} ${plural(unreachable, "service")} did not answer` : null,
    uncounted > 0 ? `${uncounted} ${plural(uncounted, "outbox", "outboxes")} could not be counted` : null,
  ].filter((problem): problem is string => problem !== null);
  if (problems.length > 0) return { tone: "warn", text: `${problems.join("; ")}.` };
  return { tone: "ok", text: "Every outbox is draining." };
}

/** TEXT_MODERATION_ENFORCE: the word list and the spam rules. */
export function rulesEnforcement(status: TextModerationStatusResponse): { tone: Tone; label: string } {
  if (!status.reachable) return { tone: "warn", label: "Did not answer" };
  if (status.enforce === null) return { tone: "neutral", label: "Not reported" };
  return status.enforce ? { tone: "ok", label: "Enforced" } : { tone: "warn", label: "Recording only" };
}

/** TEXT_CLASSIFIER_ENFORCE, which only means something for a classifier that is asked at all. */
export function classifierEnforcement(status: TextModerationStatusResponse): { tone: Tone; label: string } {
  if (!status.reachable) return { tone: "warn", label: "Did not answer" };
  if (status.classifierEnabled === null) return { tone: "neutral", label: "Not reported" };
  if (!status.classifierEnabled) return { tone: "neutral", label: "Off" };
  return status.classifierEnforce ? { tone: "ok", label: "Enforced" } : { tone: "warn", label: "Recording only" };
}

export function textModerationHealth(statuses: TextModerationStatusResponse[]): { tone: Tone; text: string } {
  const recording = statuses
    .filter((status) => status.enforce === false || (status.classifierEnabled === true && status.classifierEnforce === false))
    .map((status) => status.service);
  if (recording.length > 0) {
    return {
      tone: "warn",
      text: `${recording.join(", ")} ${recording.length === 1 ? "records" : "record"} verdicts without acting on all of them.`,
    };
  }
  const silent = statuses.filter((status) => !status.reachable || status.enforce === null).map((status) => status.service);
  if (silent.length > 0) return { tone: "neutral", text: `No report from ${silent.join(", ")}.` };
  return { tone: "ok", text: "Every service acts on what it finds." };
}

/**
 * Whether the services that reported a list are screening with different ones. Admin terms reach
 * each service within a minute, so this is a moment's lag — or a service that stopped polling.
 */
export function listsDiffer(statuses: Pick<TextModerationStatusResponse, "version">[]): boolean {
  return new Set(statuses.map((status) => status.version).filter((version) => version !== null)).size > 1;
}
