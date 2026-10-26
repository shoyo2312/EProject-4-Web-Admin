import type { OutboxBacklog, OutboxBacklogResponse } from "@/lib/api/types";
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
